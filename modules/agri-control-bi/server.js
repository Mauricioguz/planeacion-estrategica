const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Habilitar JSON de tamaño amplio para soportar imágenes base64 de análisis de suelo
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar tablas de Base de Datos
async function initDb() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(sql);
      console.log("Esquema SQL cargado exitosamente.");
    } else {
      console.warn("ADVERTENCIA: No se encontró schema.sql. Las tablas no se inicializaron.");
    }
  } catch (err) {
    console.error("Error inicializando base de datos:", err.message);
  }
}

/* ==========================================================================
   REST API ENDPOINTS
   ========================================================================== */

// 1. LOTES
app.get('/api/lotes', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, nombre, cultivo, cultivo2, cultivo3, area::float, etapa, etapa3,
              fecha_siembra AS "fechaSiembra", fecha_siembra2 AS "fechaSiembra2", fecha_siembra3 AS "fechaSiembra3",
              COALESCE(arboles1, 0)::int AS "arboles1",
              COALESCE(distancia_surco1, 0)::float AS "distanciaSurco1",
              COALESCE(distancia_planta1, 0)::float AS "distanciaPlanta1",
              COALESCE(arboles_pendientes1, 0)::int AS "arbolesPendientes1",
              COALESCE(arboles2, 0)::int AS "arboles2",
              COALESCE(distancia_surco2, 0)::float AS "distanciaSurco2",
              COALESCE(distancia_planta2, 0)::float AS "distanciaPlanta2",
              COALESCE(arboles_pendientes2, 0)::int AS "arbolesPendientes2",
              COALESCE(arboles3, 0)::int AS "arboles3",
              COALESCE(distancia_surco3, 0)::float AS "distanciaSurco3",
              COALESCE(distancia_planta3, 0)::float AS "distanciaPlanta3",
              COALESCE(arboles_pendientes3, 0)::int AS "arbolesPendientes3",
              COALESCE(arboles_pendientes, 0)::int AS "arbolesPendientes"
       FROM lotes ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lotes', async (req, res) => {
  const { 
    id, nombre, cultivo, cultivo2 = null, cultivo3 = null, area, etapa, etapa3 = null,
    fechaSiembra = null, fechaSiembra2 = null, fechaSiembra3 = null,
    arboles1 = 0, distanciaSurco1 = 0, distanciaPlanta1 = 0, arbolesPendientes1 = 0,
    arboles2 = 0, distanciaSurco2 = 0, distanciaPlanta2 = 0, arbolesPendientes2 = 0,
    arboles3 = 0, distanciaSurco3 = 0, distanciaPlanta3 = 0, arbolesPendientes3 = 0,
    arbolesPendientes = 0
  } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO lotes(
        id, nombre, cultivo, cultivo2, cultivo3, area, etapa, etapa3,
        fecha_siembra, fecha_siembra2, fecha_siembra3,
        arboles1, distancia_surco1, distancia_planta1, arboles_pendientes1,
        arboles2, distancia_surco2, distancia_planta2, arboles_pendientes2,
        arboles3, distancia_surco3, distancia_planta3, arboles_pendientes3,
        arboles_pendientes
      ) 
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) 
      RETURNING *,
        fecha_siembra AS "fechaSiembra", fecha_siembra2 AS "fechaSiembra2", fecha_siembra3 AS "fechaSiembra3",
        arboles1, distancia_surco1 AS "distanciaSurco1", distancia_planta1 AS "distanciaPlanta1", arboles_pendientes1 AS "arbolesPendientes1",
        arboles2, distancia_surco2 AS "distanciaSurco2", distancia_planta2 AS "distanciaPlanta2", arboles_pendientes2 AS "arbolesPendientes2",
        arboles3, distancia_surco3 AS "distanciaSurco3", distancia_planta3 AS "distanciaPlanta3", arboles_pendientes3 AS "arbolesPendientes3",
        arboles_pendientes AS "arbolesPendientes"`,
      [
        id, nombre, cultivo, cultivo2, cultivo3, area, etapa, etapa3,
        fechaSiembra, fechaSiembra2, fechaSiembra3,
        parseInt(arboles1) || 0, parseFloat(distanciaSurco1) || 0, parseFloat(distanciaPlanta1) || 0, parseInt(arbolesPendientes1) || 0,
        parseInt(arboles2) || 0, parseFloat(distanciaSurco2) || 0, parseFloat(distanciaPlanta2) || 0, parseInt(arbolesPendientes2) || 0,
        parseInt(arboles3) || 0, parseFloat(distanciaSurco3) || 0, parseFloat(distanciaPlanta3) || 0, parseInt(arbolesPendientes3) || 0,
        parseInt(arbolesPendientes) || 0
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lotes/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    nombre, cultivo, cultivo2 = null, cultivo3 = null, area, etapa, etapa3 = null,
    fechaSiembra = null, fechaSiembra2 = null, fechaSiembra3 = null,
    arboles1 = 0, distanciaSurco1 = 0, distanciaPlanta1 = 0, arbolesPendientes1 = 0,
    arboles2 = 0, distanciaSurco2 = 0, distanciaPlanta2 = 0, arbolesPendientes2 = 0,
    arboles3 = 0, distanciaSurco3 = 0, distanciaPlanta3 = 0, arbolesPendientes3 = 0,
    arbolesPendientes = 0
  } = req.body;
  try {
    const result = await db.query(
      `UPDATE lotes 
       SET nombre=$1, cultivo=$2, cultivo2=$3, cultivo3=$4, area=$5, etapa=$6, etapa3=$7,
           fecha_siembra=$8, fecha_siembra2=$9, fecha_siembra3=$10,
           arboles1=$11, distancia_surco1=$12, distancia_planta1=$13, arboles_pendientes1=$14,
           arboles2=$15, distancia_surco2=$16, distancia_planta2=$17, arboles_pendientes2=$18,
           arboles3=$19, distancia_surco3=$20, distancia_planta3=$21, arboles_pendientes3=$22,
           arboles_pendientes=$23
       WHERE id=$24 
       RETURNING *,
         fecha_siembra AS "fechaSiembra", fecha_siembra2 AS "fechaSiembra2", fecha_siembra3 AS "fechaSiembra3",
         arboles1, distancia_surco1 AS "distanciaSurco1", distancia_planta1 AS "distanciaPlanta1", arboles_pendientes1 AS "arbolesPendientes1",
         arboles2, distancia_surco2 AS "distanciaSurco2", distancia_planta2 AS "distanciaPlanta2", arboles_pendientes2 AS "arbolesPendientes2",
         arboles3, distancia_surco3 AS "distanciaSurco3", distancia_planta3 AS "distanciaPlanta3", arboles_pendientes3 AS "arbolesPendientes3",
         arboles_pendientes AS "arbolesPendientes"`,
      [
        nombre, cultivo, cultivo2, cultivo3, area, etapa, etapa3,
        fechaSiembra, fechaSiembra2, fechaSiembra3,
        parseInt(arboles1) || 0, parseFloat(distanciaSurco1) || 0, parseFloat(distanciaPlanta1) || 0, parseInt(arbolesPendientes1) || 0,
        parseInt(arboles2) || 0, parseFloat(distanciaSurco2) || 0, parseFloat(distanciaPlanta2) || 0, parseInt(arbolesPendientes2) || 0,
        parseInt(arboles3) || 0, parseFloat(distanciaSurco3) || 0, parseFloat(distanciaPlanta3) || 0, parseInt(arbolesPendientes3) || 0,
        parseInt(arbolesPendientes) || 0,
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/lotes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM lotes WHERE id=$1', [id]);
    res.json({ message: 'Lote eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ACTIVIDADES
app.get('/api/actividades', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, lote_id AS "loteId", cultivo_objetivo AS "cultivoObjetivo", tipo, 
              producto_nombre AS "productoNombre", cantidad::float, unidad, fecha, personal, 
              etapa, dosificacion, metodo, cumplida, notas 
       FROM actividades`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/actividades', async (req, res) => {
  const { id, loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO actividades(id, lote_id, cultivo_objetivo, tipo, producto_nombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas) 
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [id, loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/actividades/:id', async (req, res) => {
  const { id } = req.params;
  const { loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas } = req.body;
  try {
    const result = await db.query(
      `UPDATE actividades 
       SET lote_id=$1, cultivo_objetivo=$2, tipo=$3, producto_nombre=$4, cantidad=$5, unidad=$6, fecha=$7, personal=$8, etapa=$9, dosificacion=$10, metodo=$11, cumplida=$12, notas=$13 
       WHERE id=$14 RETURNING *`,
      [loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/actividades/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM actividades WHERE id=$1', [id]);
    res.json({ message: 'Actividad eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ESTUDIOS DE SUELO
app.get('/api/suelos', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, lote_id AS "loteId", titulo, fecha, notas, imagen_base64 AS "imagenBase64" 
       FROM estudios_suelo`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suelos', async (req, res) => {
  const { id, loteId, titulo, fecha, notas, imagenBase64 } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO estudios_suelo(id, lote_id, titulo, fecha, notas, imagen_base64) 
       VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, loteId, titulo, fecha, notas, imagenBase64]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/suelos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM estudios_suelo WHERE id=$1', [id]);
    res.json({ message: 'Estudio de suelo eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CLIMA
app.get('/api/clima', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT temporada, temperatura_promedio AS "temperaturaPromedio", humedad_promedio AS "humedadPromedio" 
       FROM clima WHERE id=1`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clima', async (req, res) => {
  const { temporada, temperaturaPromedio, humedadPromedio } = req.body;
  try {
    const result = await db.query(
      `UPDATE clima 
       SET temporada=$1, temperatura_promedio=$2, humedad_promedio=$3 
       WHERE id=1 RETURNING *`,
      [temporada, temperaturaPromedio, humedadPromedio]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DOSIFICACIONES HISTORICAS (PRESETS)
app.get('/api/dosificaciones', async (req, res) => {
  try {
    const result = await db.query('SELECT producto, dosificacion, metodo FROM dosificaciones_historicas');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dosificaciones', async (req, res) => {
  const { producto, dosificacion, metodo } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO dosificaciones_historicas(producto, dosificacion, metodo) 
       VALUES($1, $2, $3) 
       ON CONFLICT (producto) DO UPDATE SET dosificacion=$2, metodo=$3 
       RETURNING *`,
      [producto, dosificacion, metodo]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. OPERARIOS / PERSONAL
app.get('/api/personal', async (req, res) => {
  try {
    const result = await db.query('SELECT nombre FROM personal');
    const nombres = result.rows.map(row => row.nombre);
    res.json(nombres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/personal', async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO personal(nombre) VALUES($1) ON CONFLICT (nombre) DO NOTHING RETURNING *',
      [nombre]
    );
    res.json({ message: 'Personal agregado', row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/personal/:nombre', async (req, res) => {
  const { nombre } = req.params;
  try {
    await db.query('DELETE FROM personal WHERE nombre=$1', [nombre]);
    res.json({ message: 'Personal eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Catch-all route to serve index.html for navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`Servidor de AgriControl BI corriendo en puerto ${PORT}`);
  // Intentar conectar a la BD
  await initDb();
});
