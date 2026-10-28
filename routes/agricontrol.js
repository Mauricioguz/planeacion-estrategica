// routes/agricontrol.js - Endpoints nativos de AgriControl BI conectados a Neon PostgreSQL
const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper para queries usando el pool de db.js
async function query(text, params) {
  if (db.pool) {
    return await db.pool.query(text, params);
  }
  throw new Error('Base de datos no conectada');
}

// 1. LOTES
router.get('/lotes', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nombre, cultivo, cultivo2, area::float, etapa, 
              fecha_siembra AS "fechaSiembra", fecha_siembra2 AS "fechaSiembra2" 
       FROM lotes ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lotes', async (req, res) => {
  const { id, nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2 } = req.body;
  try {
    const result = await query(
      `INSERT INTO lotes(id, nombre, cultivo, cultivo2, area, etapa, fecha_siembra, fecha_siembra2) 
       VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/lotes/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2 } = req.body;
  try {
    const result = await query(
      `UPDATE lotes 
       SET nombre=$1, cultivo=$2, cultivo2=$3, area=$4, etapa=$5, fecha_siembra=$6, fecha_siembra2=$7 
       WHERE id=$8 RETURNING *`,
      [nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lotes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM lotes WHERE id=$1', [id]);
    res.json({ message: 'Lote eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ACTIVIDADES
router.get('/actividades', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, lote_id AS "loteId", cultivo_objetivo AS "cultivoObjetivo", tipo, 
              producto_nombre AS "productoNombre", cantidad::float, unidad, fecha, personal, 
              etapa, dosificacion, metodo, cumplida, notas 
       FROM actividades ORDER BY fecha DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/actividades', async (req, res) => {
  const { id, loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas } = req.body;
  try {
    const result = await query(
      `INSERT INTO actividades(id, lote_id, cultivo_objetivo, tipo, producto_nombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas) 
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [id, loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/actividades/:id', async (req, res) => {
  const { id } = req.params;
  const { loteId, cultivoObjetivo, tipo, productoNombre, cantidad, unidad, fecha, personal, etapa, dosificacion, metodo, cumplida, notas } = req.body;
  try {
    const result = await query(
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

router.delete('/actividades/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM actividades WHERE id=$1', [id]);
    res.json({ message: 'Actividad eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ESTUDIOS DE SUELO
router.get('/suelos', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, lote_id AS "loteId", titulo, fecha, notas, imagen_base64 AS "imagenBase64" 
       FROM estudios_suelo ORDER BY fecha DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suelos', async (req, res) => {
  const { id, loteId, titulo, fecha, notas, imagenBase64 } = req.body;
  try {
    const result = await query(
      `INSERT INTO estudios_suelo(id, lote_id, titulo, fecha, notas, imagen_base64) 
       VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, loteId, titulo, fecha, notas, imagenBase64]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/suelos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM estudios_suelo WHERE id=$1', [id]);
    res.json({ message: 'Estudio de suelo eliminado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CLIMA
router.get('/clima', async (req, res) => {
  try {
    const result = await query(
      `SELECT temporada, temperatura_promedio AS "temperaturaPromedio", humedad_promedio AS "humedadPromedio" 
       FROM clima WHERE id=1`
    );
    res.json(result.rows[0] || { temporada: 'sequia', temperaturaPromedio: 28, humedadPromedio: 60 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/clima', async (req, res) => {
  const { temporada, temperaturaPromedio, humedadPromedio } = req.body;
  try {
    const result = await query(
      `INSERT INTO clima (id, temporada, temperatura_promedio, humedad_promedio)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET 
         temporada = EXCLUDED.temporada,
         temperatura_promedio = EXCLUDED.temperatura_promedio,
         humedad_promedio = EXCLUDED.humedad_promedio
       RETURNING *`,
      [temporada, temperaturaPromedio, humedadPromedio]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DOSIFICACIONES HISTORICAS (PRESETS)
router.get('/dosificaciones', async (req, res) => {
  try {
    const result = await query('SELECT producto, dosificacion, metodo FROM dosificaciones_historicas');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/dosificaciones', async (req, res) => {
  const { producto, dosificacion, metodo } = req.body;
  try {
    const result = await query(
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
router.get('/personal', async (req, res) => {
  try {
    const result = await query('SELECT nombre FROM personal ORDER BY nombre ASC');
    const nombres = result.rows.map(row => row.nombre);
    res.json(nombres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/personal', async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await query(
      'INSERT INTO personal(nombre) VALUES($1) ON CONFLICT (nombre) DO NOTHING RETURNING *',
      [nombre]
    );
    res.json({ message: 'Personal agregado', row: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/personal/:nombre', async (req, res) => {
  const { nombre } = req.params;
  try {
    await query('DELETE FROM personal WHERE nombre=$1', [nombre]);
    res.json({ message: 'Personal eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
