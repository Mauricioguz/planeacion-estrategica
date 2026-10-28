// routes/productividad.js - Endpoints nativos de Control de Productividad (Cosecha, Báscula, Procesos, Bodega)
const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper para queries usando el pool central de Neon
async function query(text, params) {
  if (db.pool) {
    return await db.pool.query(text, params);
  }
  throw new Error('Base de datos no conectada');
}

// Generador de ID compatible con Prisma CUID
function generateCuid() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// 1. BOOTSTRAP: Cargar Lotes, Recolectores y Estadísticas completas
router.get('/bootstrap', async (req, res) => {
  try {
    const [lotesRes, recolectoresRes, harvestData, procesosLavadoRes, procesosFermentacionRes, salidasBodegaRes] = await Promise.all([
      query('SELECT id, nombre, "numeroArboles", "rendimientoTeorico" FROM "Lote" ORDER BY nombre ASC'),
      query('SELECT id, nombre, documento, activo FROM "Recolector" ORDER BY activo DESC, nombre ASC'),
      db.getErpHarvestData(),
      query(`
        SELECT p.id, TO_CHAR(p.fecha, 'YYYY-MM-DD') as fecha, p."loteId", l.nombre as lote,
               p."pesoCerezaProcesada", p."pesoCafeMojado", p."pesoPasillaMojada", p."pesoCafeSeco", p."pesoPasillaSeca"
        FROM "ProcesoLavado" p
        LEFT JOIN "Lote" l ON p."loteId" = l.id
        ORDER BY p.fecha DESC, p."createdAt" DESC
        LIMIT 20
      `),
      query(`
        SELECT p.id, TO_CHAR(p.fecha, 'YYYY-MM-DD') as fecha, p."loteId", l.nombre as lote,
               p."pesoCerezaTotal", p."diasFermentacion", p."pesoCafeSeco", p."pesoFlotesSegunda", p."pesoCerezaSeleccionada"
        FROM "ProcesoFermentacion" p
        LEFT JOIN "Lote" l ON p."loteId" = l.id
        ORDER BY p.fecha DESC, p."createdAt" DESC
        LIMIT 20
      `),
      query(`
        SELECT s.id, TO_CHAR(s.fecha, 'YYYY-MM-DD') as fecha, s.cantidad, s.tipo, s.destino, s."metodoBeneficio", s.notas
        FROM "SalidaBodega" s
        ORDER BY s.fecha DESC, s."createdAt" DESC
        LIMIT 20
      `)
    ]);

    res.json({
      success: true,
      lotes: lotesRes.rows,
      recolectores: recolectoresRes.rows,
      harvest: harvestData,
      procesosLavado: procesosLavadoRes.rows,
      procesosFermentacion: procesosFermentacionRes.rows,
      salidasBodega: salidasBodegaRes.rows
    });
  } catch (err) {
    console.error('Error en bootstrap productividad:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. REGISTRAR PESAJE EN BÁSCULA (RECOLECCIÓN)
router.post('/recoleccion', async (req, res) => {
  const { fecha, pesoCereza, recolectorId, loteId } = req.body;
  if (!pesoCereza || !recolectorId || !loteId) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: pesoCereza, recolectorId, loteId' });
  }

  const id = generateCuid();
  const fechaObj = fecha ? new Date(fecha) : new Date();

  try {
    const result = await query(`
      INSERT INTO "Recoleccion" (id, fecha, "pesoCereza", "recolectorId", "loteId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, fecha, "pesoCereza", "recolectorId", "loteId"
    `, [id, fechaObj, parseFloat(pesoCereza), recolectorId, loteId]);

    // Obtener nombres para respuesta inmediata
    const details = await query(`
      SELECT rec.id, TO_CHAR(rec.fecha, 'YYYY-MM-DD') as fecha, ROUND(rec."pesoCereza"::numeric, 1) as kilos,
             COALESCE(r.nombre, 'Sin asignar') as recolector,
             COALESCE(l.nombre, 'General') as lote
      FROM "Recoleccion" rec
      LEFT JOIN "Recolector" r ON rec."recolectorId" = r.id
      LEFT JOIN "Lote" l ON rec."loteId" = l.id
      WHERE rec.id = $1
    `, [id]);

    res.status(201).json({
      success: true,
      message: 'Pesaje registrado exitosamente en Neon',
      pesaje: details.rows[0]
    });
  } catch (err) {
    console.error('Error registrando recolección:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. ELIMINAR PESAJE (Corrección de error en báscula)
router.delete('/recoleccion/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM "Recoleccion" WHERE id = $1', [id]);
    res.json({ success: true, message: 'Pesaje eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CREAR NUEVO RECOLECTOR
router.post('/recolector', async (req, res) => {
  const { nombre, documento, activo } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del recolector es obligatorio' });
  }

  const id = generateCuid();
  try {
    const result = await query(`
      INSERT INTO "Recolector" (id, nombre, documento, activo, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [id, nombre.toUpperCase().trim(), documento || null, activo !== false]);

    res.status(201).json({
      success: true,
      message: 'Recolector creado exitosamente',
      recolector: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. REGISTRAR PROCESO DE LAVADO
router.post('/lavado', async (req, res) => {
  const { fecha, loteId, pesoCerezaProcesada, pesoCafeMojado, pesoPasillaMojada, pesoCafeSeco, pesoPasillaSeca } = req.body;
  if (!loteId || !pesoCerezaProcesada) {
    return res.status(400).json({ error: 'loteId y pesoCerezaProcesada son obligatorios' });
  }

  const id = generateCuid();
  const fechaObj = fecha ? new Date(fecha) : new Date();

  try {
    const result = await query(`
      INSERT INTO "ProcesoLavado" (id, fecha, "loteId", "pesoCerezaProcesada", "pesoCafeMojado", "pesoPasillaMojada", "pesoCafeSeco", "pesoPasillaSeca", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      id, fechaObj, loteId,
      parseFloat(pesoCerezaProcesada),
      pesoCafeMojado ? parseFloat(pesoCafeMojado) : null,
      pesoPasillaMojada ? parseFloat(pesoPasillaMojada) : null,
      pesoCafeSeco ? parseFloat(pesoCafeSeco) : null,
      pesoPasillaSeca ? parseFloat(pesoPasillaSeca) : null
    ]);

    res.status(201).json({
      success: true,
      message: 'Proceso de lavado registrado exitosamente',
      proceso: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. REGISTRAR PROCESO DE FERMENTACIÓN
router.post('/fermentacion', async (req, res) => {
  const { fecha, loteId, pesoCerezaTotal, diasFermentacion, pesoCafeSeco, pesoFlotesSegunda, pesoCerezaSeleccionada } = req.body;
  if (!loteId || !pesoCerezaTotal || diasFermentacion === undefined) {
    return res.status(400).json({ error: 'loteId, pesoCerezaTotal y diasFermentacion son obligatorios' });
  }

  const id = generateCuid();
  const fechaObj = fecha ? new Date(fecha) : new Date();

  try {
    const result = await query(`
      INSERT INTO "ProcesoFermentacion" (id, fecha, "loteId", "pesoCerezaTotal", "diasFermentacion", "pesoCafeSeco", "pesoFlotesSegunda", "pesoCerezaSeleccionada", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      id, fechaObj, loteId,
      parseFloat(pesoCerezaTotal),
      parseInt(diasFermentacion),
      pesoCafeSeco ? parseFloat(pesoCafeSeco) : null,
      pesoFlotesSegunda ? parseFloat(pesoFlotesSegunda) : null,
      pesoCerezaSeleccionada ? parseFloat(pesoCerezaSeleccionada) : null
    ]);

    res.status(201).json({
      success: true,
      message: 'Proceso de fermentación registrado exitosamente',
      proceso: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. REGISTRAR SALIDA DE BODEGA (PERGAMINO SECO)
router.post('/bodega', async (req, res) => {
  const { fecha, cantidad, tipo, destino, metodoBeneficio, notas } = req.body;
  if (!cantidad || !tipo || !destino) {
    return res.status(400).json({ error: 'cantidad, tipo y destino son obligatorios' });
  }

  const id = generateCuid();
  const fechaObj = fecha ? new Date(fecha) : new Date();

  try {
    const result = await query(`
      INSERT INTO "SalidaBodega" (id, fecha, cantidad, tipo, destino, "metodoBeneficio", notas, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [
      id, fechaObj,
      parseFloat(cantidad),
      tipo,
      destino,
      metodoBeneficio || null,
      notas || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Salida de bodega registrada exitosamente',
      salida: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
