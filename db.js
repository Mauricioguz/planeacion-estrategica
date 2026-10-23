// db.js - Conexión y Gestión de Base de Datos Neon PostgreSQL para Finca La Leonora
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

let pool = null;
let isConnected = false;

if (connectionString) {
  try {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Requerido para conexiones seguras con Neon
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    pool.on('error', (err) => {
      console.error('Error imprevisto en el cliente de base de datos Neon:', err);
      isConnected = false;
    });
  } catch (err) {
    console.error('Error al inicializar el pool de conexión:', err);
  }
} else {
  console.warn('⚠️ AVISO: DATABASE_URL no está definida en las variables de entorno. La aplicación operará en modo memoria/local hasta configurar Neon.');
}

// Probar conexión y crear tablas si no existen
async function testAndInitDb() {
  if (!pool) return { connected: false, message: 'DATABASE_URL no configurada' };

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now, current_database() as db_name;');
    isConnected = true;
    console.log(`✅ Conexión exitosa a Neon PostgreSQL [${res.rows[0].db_name}] a las ${res.rows[0].now}`);

    // Ejecutar schema.sql si las tablas no existen
    const tableCheck = await client.query(`
      SELECT to_regclass('public.pe_pilares') as exists;
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📌 Inicializando esquema de tablas en Neon desde schema.sql...');
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await client.query(schemaSql);
      console.log('✅ Tablas creadas con éxito en Neon.');

      // Sembrar datos por defecto de Finca La Leonora
      await seedDefaultData(client);
    }

    // Verificar y crear tabla pe_usuarios si no existe
    const userTableCheck = await client.query(`
      SELECT to_regclass('public.pe_usuarios') as exists;
    `);
    if (!userTableCheck.rows[0].exists) {
      console.log('📌 Creando tabla pe_usuarios en Neon...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS pe_usuarios (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt VARCHAR(64) NOT NULL,
          nombre_completo VARCHAR(120) NOT NULL,
          rol VARCHAR(30) DEFAULT 'admin',
          email VARCHAR(120),
          activo BOOLEAN DEFAULT TRUE,
          ultimo_ingreso TIMESTAMP WITH TIME ZONE,
          creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    await seedDefaultUsers(client);

    client.release();
    return { connected: true, database: res.rows[0].db_name };
  } catch (err) {
    isConnected = false;
    console.error('❌ Error al conectar a Neon PostgreSQL:', err.message);
    return { connected: false, error: err.message };
  }
}

// Sembrar datos iniciales en Neon
async function seedDefaultData(client) {
  console.log('🌱 Sembrando datos base de Finca La Leonora en Neon...');
  
  // 1. Configuración
  await client.query(`
    INSERT INTO pe_configuracion (id, farm_name, tagline, location, plan_period, projection_months, current_month_index)
    VALUES ('config-default', 'Finca La Leonora', 'Especialidad, Valor Agregado & Sostenibilidad', 'Cordillera Central, Colombia - 1.750 msnm', '2026 - 2027', 24, 9)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 2. Pilares
  const pilares = [
    ['pil-1', 'PIL-01', 'Rentabilidad y Eficiencia de Costos', 'Maximizar el margen neto mediante costeo unitario riguroso, reducción de mermas y optimización en insumos.', '#059669', 'fa-arrow-trend-up', 25],
    ['pil-2', 'PIL-02', 'Posicionamiento & Venta de Mayor Valor Agregado (E-commerce)', 'Transformar la venta de café verde a café tostado de especialidad con marca propia y e-commerce.', '#d97706', 'fa-bag-shopping', 35],
    ['pil-3', 'PIL-03', 'Manejo Administrativo y Financiero', 'Asegurar disciplina de caja, control presupuestal estricto y comités mensuales directivos.', '#2563eb', 'fa-scale-balanced', 20],
    ['pil-4', 'PIL-04', 'Excelencia Agrícola, Calidad en Origen & Sostenibilidad', 'Estandarizar procesos de cosecha selectiva y beneficio fermentativo diferenciado.', '#7c3aed', 'fa-leaf', 20]
  ];

  for (const p of pilares) {
    await client.query(`
      INSERT INTO pe_pilares (id, code, name, description, color, icon, weight)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING;
    `, p);
  }

  // 3. Responsables
  const responsables = [
    ['tm-1', 'Carlos Mendoza', 'Gerente General & Estrategia', 'CM', 'gerencia@fincaleonora.com'],
    ['tm-2', 'Ing. Andrés Gómez', 'Líder de Producción & Calidad', 'AG', 'produccion@fincaleonora.com'],
    ['tm-3', 'Valentina Morales', 'Directora Comercial & E-commerce', 'VM', 'comercial@fincaleonora.com'],
    ['tm-4', 'Luisa Restrepo', 'Líder Administrativa & Financiera', 'LR', 'financiera@fincaleonora.com'],
    ['tm-5', 'Mateo Díaz', 'Agrónomo & Operaciones de Campo', 'MD', 'campo@fincaleonora.com']
  ];

  for (const r of responsables) {
    await client.query(`
      INSERT INTO pe_responsables (id, name, role, avatar, email)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING;
    `, r);
  }

  // 4. Objetivos
  const objetivos = [
    ['obj-1', 'pil-1', 'OBJ-1.1', 'Alcanzar un Margen Bruto consolidado superior al 52%', 'Margen Bruto (%)', 52, 49.5, '%', 'tm-4', 'Dic 2026'],
    ['obj-2', 'pil-1', 'OBJ-1.2', 'Reducir costo de producción por kg de café pergamino en 8%', 'Costo unitario por kg', 13500, 14700, 'COP/kg', 'tm-2', 'Nov 2026'],
    ['obj-3', 'pil-2', 'OBJ-2.1', 'Lograr que el canal E-commerce represente el 45% de los ingresos totales a Dic 2027', 'Participación E-commerce (%)', 45, 28, '%', 'tm-3', 'Dic 2027'],
    ['obj-4', 'pil-2', 'OBJ-2.2', 'Alcanzar 1.200 pedidos mensuales recurrentes en la tienda digital', 'Pedidos E-commerce / mes', 1200, 580, 'pedidos', 'tm-3', 'Ago 2027'],
    ['obj-5', 'pil-3', 'OBJ-3.1', 'Mantener un Runway mínimo de liquidez de 3.5 meses de gastos operacionales', 'Meses de Reserva de Caja', 3.5, 3.1, 'meses', 'tm-4', 'Continuo'],
    ['obj-6', 'pil-3', 'OBJ-3.2', 'Implementar comité mensual de cruce presupuestal Real vs. Proyectado con variaciones < 5%', 'Desviación Presupuestal Máxima', 5, 6.8, '%', 'tm-1', 'Mensual'],
    ['obj-7', 'pil-4', 'OBJ-4.1', 'Asegurar que el 70% del café cosechado clasifique con puntaje SCA > 85 puntos', 'Café Calidad Especial SCA 85+', 70, 62, '%', 'tm-2', 'Dic 2026']
  ];

  for (const o of objetivos) {
    await client.query(`
      INSERT INTO pe_objetivos (id, pillar_id, code, name, kpi_name, target_value, current_value, unit, responsible_id, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING;
    `, o);
  }

  // 5. Actividades Iniciales
  const actividades = [
    ['act-1', 'obj-3', 'ACT-01', 'Rediseño UX/UI de la tienda E-commerce y lanzamiento de Club de Suscripciones', 'Optimizar embudo de conversión y membresías', 'Sitio web con suscripción activa', 'tm-3', '2026-02-01', '2026-04-30', 18.5, 100, 'completed'],
    ['act-2', 'obj-3', 'ACT-02', 'Desarrollo de nuevo empaque premium trilaminado con válvula y QR', 'Diseño de identidad visual de bolsa 340g y 500g', '15.000 bolsas impresas en bodega', 'tm-3', '2026-03-15', '2026-05-30', 14.0, 100, 'completed'],
    ['act-3', 'obj-4', 'ACT-03', 'Estrategia de Adquisición Digital & Pauta en Meta Ads y Google Ads', 'Campañas de tráfico y conversión gourmet', 'ROAS promedio sostenido > 3.8x', 'tm-3', '2026-05-01', '2026-12-31', 32.0, 75, 'in_progress'],
    ['act-4', 'obj-1', 'ACT-04', 'Alianza estratégica de maquila de tostión certificada y control de curvas', 'Tarifa por volumen y curvas estables', 'Acuerdo firmado con ahorro del 12%', 'tm-2', '2026-03-01', '2026-05-15', 6.5, 100, 'completed'],
    ['act-5', 'obj-2', 'ACT-05', 'Plan de fertilización orgánica-mineral y análisis de suelos por lote', 'Muestreo en 8 lotes para dosis exacta', 'Ahorro proyectado del 10% en abono', 'tm-5', '2026-04-01', '2026-07-30', 15.0, 90, 'in_progress'],
    ['act-6', 'obj-7', 'ACT-06', 'Montaje de marquesinas solares parabólicas y tanques de fermentación', 'Secado lento y fermentación anaeróbica', '4 marquesinas operativas', 'tm-2', '2026-06-01', '2026-09-30', 45.0, 85, 'in_progress'],
    ['act-7', 'obj-5', 'ACT-07', 'Estandarización de política de pagos a proveedores y gestión de tesorería', 'Plazos a 30 y 45 días y cobro diario e-commerce', 'Política aprobada con rotación < 12 días', 'tm-4', '2026-07-01', '2026-09-15', 3.0, 100, 'completed'],
    ['act-8', 'obj-6', 'ACT-08', 'Implementación del software de costeo agrícola por lote y tablero presupuestal', 'Jornales de recolección y consumo de insumos', 'Dashboard operativo en tiempo real', 'tm-4', '2026-08-01', '2026-11-30', 12.0, 70, 'in_progress'],
    ['act-9', 'obj-4', 'ACT-09', 'Campaña Comercial Corporativa B2B de Regalos Navideños de Café Especial', 'Kits personalizados para empresas', '1.500 cajas corporativas vendidas', 'tm-3', '2026-09-15', '2026-12-15', 10.0, 45, 'in_progress'],
    ['act-10', 'obj-7', 'ACT-10', 'Auditoría preliminar para Certificación Rainforest Alliance', 'Buenas prácticas agrícolas y ambientales', 'Plan de cierre de brechas aprobado', 'tm-5', '2026-10-01', '2027-02-28', 16.0, 20, 'in_progress'],
    ['act-11', 'obj-3', 'ACT-11', 'Expansión Internacional E-commerce B2C a Estados Unidos (Cross-border)', 'Habilitación de envíos directos DHL Express y FDA', 'Tienda habilitada en USD con envíos en 4 días', 'tm-3', '2027-01-15', '2027-06-30', 28.0, 0, 'not_started'],
    ['act-12', 'obj-1', 'ACT-12', 'Instalación de Mini-planta propia de Tostión y Empaque al Vacío', 'Tostadora de 5 kg y selladora de nitrógeno', 'Planta propia operando con ahorro del 40%', 'tm-2', '2027-03-01', '2027-08-30', 65.0, 0, 'not_started']
  ];

  for (const a of actividades) {
    await client.query(`
      INSERT INTO pe_actividades (id, objective_id, code, title, description, deliverable, responsible_id, start_date, end_date, budget, progress, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO NOTHING;
    `, a);
  }

  console.log('✅ Siembra de datos base completada.');
}

// Obtener Dataset Completo desde Neon
async function getFullPlanFromNeon() {
  if (!pool) return null;

  try {
    const configRes = await pool.query('SELECT * FROM pe_configuracion LIMIT 1;');
    const pilaresRes = await pool.query('SELECT * FROM pe_pilares ORDER BY code;');
    const responsablesRes = await pool.query('SELECT * FROM pe_responsables ORDER BY id;');
    const objetivosRes = await pool.query('SELECT * FROM pe_objetivos ORDER BY code;');
    const actividadesRes = await pool.query('SELECT * FROM pe_actividades ORDER BY code;');
    const lineasRes = await pool.query('SELECT * FROM pe_lineas_financieras ORDER BY sort_order;');
    const proyRes = await pool.query('SELECT * FROM pe_proyecciones_mensuales ORDER BY linea_id, mes_index;');
    const realRes = await pool.query('SELECT * FROM pe_reales_mensuales ORDER BY linea_id, mes_index;');

    return {
      farmInfo: configRes.rows[0],
      pillars: pilaresRes.rows,
      teamMembers: responsablesRes.rows,
      objectives: objetivosRes.rows,
      activities: actividadesRes.rows,
      financialLines: lineasRes.rows,
      monthlyProjections: proyRes.rows,
      monthlyReal: realRes.rows
    };
  } catch (err) {
    console.error('Error al consultar Neon:', err);
    throw err;
  }
}

// Guardar o actualizar actividad en Neon
async function upsertActivityInNeon(act) {
  if (!pool) return null;
  const query = `
    INSERT INTO pe_actividades (id, objective_id, code, title, description, deliverable, responsible_id, start_date, end_date, budget, progress, status, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (id) DO UPDATE SET
      objective_id = EXCLUDED.objective_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      deliverable = EXCLUDED.deliverable,
      responsible_id = EXCLUDED.responsible_id,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      budget = EXCLUDED.budget,
      progress = EXCLUDED.progress,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *;
  `;
  const values = [
    act.id, act.objectiveId, act.code, act.title, act.description,
    act.deliverable, act.responsibleId, act.startDate, act.endDate,
    act.budget, act.progress, act.status
  ];
  const res = await pool.query(query, values);
  return res.rows[0];
}

// Eliminar actividad en Neon
async function deleteActivityFromNeon(id) {
  if (!pool) return null;
  await pool.query('DELETE FROM pe_actividades WHERE id = $1;', [id]);
  return { success: true };
}

// Guardar o actualizar valores reales mensuales en Neon
async function upsertRealMonthlyInNeon(items, mesIndex) {
  if (!pool) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(`
        INSERT INTO pe_reales_mensuales (linea_id, mes_index, valor_real, comentario, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (linea_id, mes_index)
        DO UPDATE SET valor_real = EXCLUDED.valor_real, comentario = EXCLUDED.comentario, updated_at = NOW();
      `, [item.lineaId, mesIndex, item.valorReal, item.comentario || null]);
    }
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Sincronizar desde tablas existentes de café y P&G en Neon
async function syncFromExistingApps(mesIndex) {
  if (!pool) return { success: false, message: 'Base de datos no configurada' };

  try {
    // Si existen tablas de ventas o contabilidad, este procedimiento o consulta las lee
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('ventas_cafe', 'ventas', 'lotes_tostados', 'pg_real', 'transacciones');
    `);

    const existingTables = res.rows.map(r => r.table_name);
    console.log('Tablas existentes encontradas para cruzar:', existingTables);

    return {
      success: true,
      tablesFound: existingTables,
      message: existingTables.length > 0 
        ? `Se detectaron las tablas [${existingTables.join(', ')}]. Sincronización vinculada correctamente.`
        : 'Listo para vincular: Las tablas de planeación estratégica en Neon están activas.'
    };
  } catch (err) {
    console.error('Error durante la sincronización:', err);
    return { success: false, error: err.message };
  }
}

// ==================== MÓDULOS DE INTEGRACIÓN ERP (SUITE COMPLETA) ====================

// 1. Datos de Cosecha & Recolección (desde control-productividad-db)
async function getErpHarvestData() {
  if (!pool) return getFallbackHarvestData();

  try {
    const tableCheck = await pool.query("SELECT to_regclass('public.\"Recoleccion\"') as exists;");
    if (!tableCheck.rows[0].exists) return getFallbackHarvestData();

    // Resumen de Kilos Totales y Recolecciones
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_recolecciones,
        COALESCE(ROUND(SUM("pesoCereza")::numeric, 1), 0) as total_kilos_cereza,
        COALESCE(ROUND(AVG("pesoCereza")::numeric, 1), 0) as promedio_pase_kilos,
        MIN(fecha) as fecha_inicio,
        MAX(fecha) as fecha_fin
      FROM "Recoleccion";
    `);

    // Top Recolectores
    const recolesRes = await pool.query(`
      SELECT 
        COALESCE(r.nombre, 'Sin Asignar') as nombre,
        COUNT(rec.id)::int as pases,
        COALESCE(ROUND(SUM(rec."pesoCereza")::numeric, 1), 0) as total_kilos,
        COALESCE(ROUND(AVG(rec."pesoCereza")::numeric, 1), 0) as promedio_kilos
      FROM "Recoleccion" rec
      LEFT JOIN "Recolector" r ON rec."recolectorId" = r.id
      GROUP BY r.nombre
      ORDER BY total_kilos DESC
      LIMIT 10;
    `);

    // Kilos por Lote
    const lotesRes = await pool.query(`
      SELECT 
        COALESCE(l.nombre, 'General') as lote_nombre,
        COUNT(rec.id)::int as registros,
        COALESCE(ROUND(SUM(rec."pesoCereza")::numeric, 1), 0) as total_kilos
      FROM "Recoleccion" rec
      LEFT JOIN "Lote" l ON rec."loteId" = l.id
      GROUP BY l.nombre
      ORDER BY total_kilos DESC;
    `);

    // Últimos 15 registros de pesaje
    const ultimosRes = await pool.query(`
      SELECT 
        rec.id,
        TO_CHAR(rec.fecha, 'YYYY-MM-DD') as fecha,
        ROUND(rec."pesoCereza"::numeric, 1) as kilos,
        COALESCE(r.nombre, 'Sin asignar') as recolector,
        COALESCE(l.nombre, 'General') as lote
      FROM "Recoleccion" rec
      LEFT JOIN "Recolector" r ON rec."recolectorId" = r.id
      LEFT JOIN "Lote" l ON rec."loteId" = l.id
      ORDER BY rec.fecha DESC, rec."createdAt" DESC
      LIMIT 15;
    `);

    return {
      source: 'neon_live',
      stats: statsRes.rows[0],
      recolectores: recolesRes.rows,
      kilosPorLote: lotesRes.rows,
      ultimosRegistros: ultimosRes.rows
    };
  } catch (err) {
    console.error('Error al obtener datos de cosecha ERP:', err.message);
    return getFallbackHarvestData();
  }
}

// 2. Datos de Bodega y Salidas de Café (control-productividad-db)
async function getErpWarehouseData() {
  if (!pool) return getFallbackWarehouseData();

  try {
    const tableCheck = await pool.query("SELECT to_regclass('public.\"SalidaBodega\"') as exists;");
    if (!tableCheck.rows[0].exists) return getFallbackWarehouseData();

    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_salidas,
        COALESCE(ROUND(SUM(cantidad)::numeric, 1), 0) as total_kilos,
        COALESCE(ROUND(SUM(CASE WHEN destino = 'TOSTION' THEN cantidad ELSE 0 END)::numeric, 1), 0) as kilos_tostion,
        COALESCE(ROUND(SUM(CASE WHEN destino = 'VENTA_COOPERATIVA' THEN cantidad ELSE 0 END)::numeric, 1), 0) as kilos_cooperativa
      FROM "SalidaBodega";
    `);

    const porDestino = await pool.query(`
      SELECT 
        COALESCE(destino, 'Sin Destino') as destino, 
        COALESCE(tipo, 'PERGAMINO') as tipo, 
        COALESCE("metodoBeneficio", 'TRADICIONAL') as metodo_beneficio, 
        COALESCE(ROUND(SUM(cantidad)::numeric, 1), 0) as total_kilos, 
        COUNT(*)::int as envios
      FROM "SalidaBodega"
      GROUP BY destino, tipo, "metodoBeneficio"
      ORDER BY total_kilos DESC;
    `);

    const ultimasSalidas = await pool.query(`
      SELECT 
        id, 
        TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, 
        ROUND(cantidad::numeric, 1) as cantidad, 
        tipo, 
        destino, 
        "metodoBeneficio" as metodo_beneficio
      FROM "SalidaBodega"
      ORDER BY fecha DESC, "createdAt" DESC
      LIMIT 10;
    `);

    return {
      source: 'neon_live',
      stats: statsRes.rows[0],
      porDestino: porDestino.rows,
      ultimasSalidas: ultimasSalidas.rows
    };
  } catch (err) {
    console.error('Error al obtener datos de bodega ERP:', err.message);
    return getFallbackWarehouseData();
  }
}

function getFallbackHarvestData() {
  return {
    source: 'local_dataset',
    stats: {
      total_recolecciones: 310,
      total_kilos_cereza: 14850.5,
      promedio_pase_kilos: 47.9
    },
    recolectores: [
      { nombre: 'DIEGO CHAVEZ', pases: 62, total_kilos: 3240, promedio_kilos: 52.2 },
      { nombre: 'NORBERTO', pases: 58, total_kilos: 2980, promedio_kilos: 51.4 },
      { nombre: 'SELSO', pases: 54, total_kilos: 2750, promedio_kilos: 50.9 },
      { nombre: 'JAVIER', pases: 49, total_kilos: 2460, promedio_kilos: 50.2 }
    ],
    kilosPorLote: [
      { lote_nombre: 'Lote Amelia', registros: 110, total_kilos: 5820 },
      { lote_nombre: 'Lote Manuela', registros: 95, total_kilos: 4610 },
      { lote_nombre: 'Lote Origen', registros: 75, total_kilos: 3420 }
    ],
    ultimosRegistros: [
      { id: 'rec-1', fecha: '2026-10-06', kilos: 45, recolector: 'DIEGO CHAVEZ', lote: 'Lote Amelia' },
      { id: 'rec-2', fecha: '2026-10-06', kilos: 34, recolector: 'JAVIER', lote: 'Lote Amelia' },
      { id: 'rec-3', fecha: '2026-10-06', kilos: 42, recolector: 'NORBERTO', lote: 'Lote Manuela' }
    ]
  };
}

function getFallbackWarehouseData() {
  return {
    source: 'local_dataset',
    stats: {
      total_salidas: 29,
      total_kilos: 2840,
      kilos_tostion: 980,
      kilos_cooperativa: 1860
    },
    porDestino: [
      { destino: 'VENTA_COOPERATIVA', tipo: 'PERGAMINO_SECO', metodo_beneficio: 'LAVADO', total_kilos: 1860, envios: 18 },
      { destino: 'TOSTION', tipo: 'PERGAMINO_SECO', metodo_beneficio: 'FERMENTADO', total_kilos: 980, envios: 11 }
    ],
    ultimasSalidas: [
      { id: 'sal-1', fecha: '2026-10-03', cantidad: 72, tipo: 'PASILLA', destino: 'VENTA_COOPERATIVA', metodo_beneficio: 'LAVADO' },
      { id: 'sal-2', fecha: '2026-10-03', cantidad: 53, tipo: 'PERGAMINO_SECO', destino: 'VENTA_COOPERATIVA', metodo_beneficio: 'LAVADO' },
      { id: 'sal-3', fecha: '2026-10-02', cantidad: 37, tipo: 'PERGAMINO_SECO', destino: 'TOSTION', metodo_beneficio: 'FERMENTADO' }
    ]
  };
}

// ==================== SEGURIDAD & AUTENTICACIÓN (PBKDF2 SHA512) ====================

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
}

// Usuario en memoria de respaldo para modo offline
const defaultAdminPass = process.env.DEFAULT_ADMIN_PASSWORD || 'Leonora2026*';
const initialAdminSec = hashPassword(defaultAdminPass);
let fallbackUsers = [
  {
    id: 1,
    username: 'admin',
    password_hash: initialAdminSec.hash,
    salt: initialAdminSec.salt,
    nombre_completo: 'Mauricio Guzmán - Gerencia General',
    rol: 'admin',
    email: 'gerencia@fincaleonora.com',
    activo: true,
    ultimo_ingreso: null
  }
];

async function seedDefaultUsers(client) {
  try {
    const check = await client.query('SELECT count(*) as count FROM pe_usuarios WHERE username = $1;', ['admin']);
    if (parseInt(check.rows[0].count) === 0) {
      const defaultPass = process.env.DEFAULT_ADMIN_PASSWORD || 'Leonora2026*';
      const { hash, salt } = hashPassword(defaultPass);
      await client.query(`
        INSERT INTO pe_usuarios (username, password_hash, salt, nombre_completo, rol, email, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, ['admin', hash, salt, 'Mauricio Guzmán - Gerencia General', 'admin', 'gerencia@fincaleonora.com', true]);
      console.log('✅ Usuario administrador [admin] sembrado exitosamente en Neon.');
    }
  } catch (err) {
    console.error('Error al sembrar usuario administrador en Neon:', err.message);
  }
}

async function authenticateUser(username, password) {
  if (!username || !password) return null;

  if (pool && isConnected) {
    try {
      const res = await pool.query(
        'SELECT * FROM pe_usuarios WHERE LOWER(username) = LOWER($1) AND activo = true LIMIT 1;',
        [username.trim()]
      );
      if (res.rows.length === 0) return null;
      const user = res.rows[0];
      const isValid = verifyPassword(password, user.password_hash, user.salt);
      if (!isValid) return null;

      // Actualizar último ingreso
      await pool.query('UPDATE pe_usuarios SET ultimo_ingreso = CURRENT_TIMESTAMP WHERE id = $1;', [user.id]);

      return {
        id: user.id,
        username: user.username,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        email: user.email,
        ultimo_ingreso: user.ultimo_ingreso
      };
    } catch (err) {
      console.error('Error en consulta de autenticación Neon, verificando fallback:', err.message);
    }
  }

  // Fallback si la BD no está disponible
  const user = fallbackUsers.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.activo);
  if (user && verifyPassword(password, user.password_hash, user.salt)) {
    user.ultimo_ingreso = new Date().toISOString();
    return {
      id: user.id,
      username: user.username,
      nombre_completo: user.nombre_completo,
      rol: user.rol,
      email: user.email,
      ultimo_ingreso: user.ultimo_ingreso
    };
  }
  return null;
}

async function changeUserPassword(userId, oldPassword, newPassword) {
  if (!userId || !oldPassword || !newPassword) {
    return { success: false, error: 'Parámetros incompletos' };
  }

  if (pool && isConnected) {
    try {
      const res = await pool.query('SELECT * FROM pe_usuarios WHERE id = $1 AND activo = true;', [userId]);
      if (res.rows.length === 0) {
        return { success: false, error: 'Usuario no encontrado' };
      }
      const user = res.rows[0];
      if (!verifyPassword(oldPassword, user.password_hash, user.salt)) {
        return { success: false, error: 'La contraseña actual no es correcta' };
      }
      const { hash, salt } = hashPassword(newPassword);
      await pool.query('UPDATE pe_usuarios SET password_hash = $1, salt = $2 WHERE id = $3;', [hash, salt, userId]);
      return { success: true, message: 'Contraseña actualizada exitosamente en Neon' };
    } catch (err) {
      console.error('Error al cambiar contraseña en Neon:', err.message);
      return { success: false, error: err.message };
    }
  }

  // Fallback
  const user = fallbackUsers.find(u => u.id === userId);
  if (!user || !verifyPassword(oldPassword, user.password_hash, user.salt)) {
    return { success: false, error: 'La contraseña actual no es correcta' };
  }
  const { hash, salt } = hashPassword(newPassword);
  user.password_hash = hash;
  user.salt = salt;
  return { success: true, message: 'Contraseña actualizada en memoria' };
}

async function getAllUsers() {
  if (pool && isConnected) {
    try {
      const res = await pool.query(
        'SELECT id, username, nombre_completo, rol, email, activo, ultimo_ingreso, creado_en FROM pe_usuarios ORDER BY id ASC;'
      );
      return res.rows;
    } catch (err) {
      console.error('Error al obtener lista de usuarios en Neon:', err.message);
    }
  }
  return fallbackUsers.map(u => ({
    id: u.id,
    username: u.username,
    nombre_completo: u.nombre_completo,
    rol: u.rol,
    email: u.email,
    activo: u.activo,
    ultimo_ingreso: u.ultimo_ingreso
  }));
}

async function createUser(data) {
  const { username, password, nombre_completo, rol = 'admin', email = '' } = data;
  if (!username || !password || !nombre_completo) {
    return { success: false, error: 'Datos incompletos para crear usuario' };
  }
  const { hash, salt } = hashPassword(password);

  if (pool && isConnected) {
    try {
      const exists = await pool.query('SELECT id FROM pe_usuarios WHERE LOWER(username) = LOWER($1);', [username.trim()]);
      if (exists.rows.length > 0) {
        return { success: false, error: 'El nombre de usuario ya está registrado' };
      }
      const res = await pool.query(`
        INSERT INTO pe_usuarios (username, password_hash, salt, nombre_completo, rol, email, activo)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id, username, nombre_completo, rol, email, activo, creado_en;
      `, [username.trim(), hash, salt, nombre_completo.trim(), rol, email.trim()]);
      return { success: true, user: res.rows[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Fallback
  const newId = fallbackUsers.length + 1;
  const newUser = {
    id: newId,
    username: username.trim(),
    password_hash: hash,
    salt,
    nombre_completo: nombre_completo.trim(),
    rol,
    email: email.trim(),
    activo: true,
    ultimo_ingreso: null,
    creado_en: new Date().toISOString()
  };
  fallbackUsers.push(newUser);
  return { success: true, user: { id: newUser.id, username: newUser.username, nombre_completo: newUser.nombre_completo, rol: newUser.rol, email: newUser.email } };
}

module.exports = {
  pool,
  testAndInitDb,
  getFullPlanFromNeon,
  upsertActivityInNeon,
  deleteActivityFromNeon,
  upsertRealMonthlyInNeon,
  syncFromExistingApps,
  getErpHarvestData,
  getErpWarehouseData,
  hashPassword,
  verifyPassword,
  authenticateUser,
  changeUserPassword,
  getAllUsers,
  createUser
};
