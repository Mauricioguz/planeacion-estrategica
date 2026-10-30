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
      `SELECT id, nombre, cultivo, cultivo2, area::float, etapa, 
              fecha_siembra AS "fechaSiembra", fecha_siembra2 AS "fechaSiembra2",
              COALESCE(arboles1, 0)::int AS "arboles1",
              COALESCE(distancia_surco1, 0)::float AS "distanciaSurco1",
              COALESCE(distancia_planta1, 0)::float AS "distanciaPlanta1",
              COALESCE(arboles2, 0)::int AS "arboles2",
              COALESCE(distancia_surco2, 0)::float AS "distanciaSurco2",
              COALESCE(distancia_planta2, 0)::float AS "distanciaPlanta2"
       FROM lotes ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lotes', async (req, res) => {
  const { 
    id, nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2,
    arboles1 = 0, distanciaSurco1 = 0, distanciaPlanta1 = 0,
    arboles2 = 0, distanciaSurco2 = 0, distanciaPlanta2 = 0
  } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO lotes(
        id, nombre, cultivo, cultivo2, area, etapa, fecha_siembra, fecha_siembra2,
        arboles1, distancia_surco1, distancia_planta1, arboles2, distancia_surco2, distancia_planta2
      ) 
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
      RETURNING *,
        fecha_siembra AS "fechaSiembra", fecha_siembra2 AS "fechaSiembra2",
        arboles1, distancia_surco1 AS "distanciaSurco1", distancia_planta1 AS "distanciaPlanta1",
        arboles2, distancia_surco2 AS "distanciaSurco2", distancia_planta2 AS "distanciaPlanta2"`,
      [
        id, nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2,
        parseInt(arboles1) || 0, parseFloat(distanciaSurco1) || 0, parseFloat(distanciaPlanta1) || 0,
        parseInt(arboles2) || 0, parseFloat(distanciaSurco2) || 0, parseFloat(distanciaPlanta2) || 0
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
    nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2,
    arboles1 = 0, distanciaSurco1 = 0, distanciaPlanta1 = 0,
    arboles2 = 0, distanciaSurco2 = 0, distanciaPlanta2 = 0
  } = req.body;
  try {
    const result = await db.query(
      `UPDATE lotes 
       SET nombre=$1, cultivo=$2, cultivo2=$3, area=$4, etapa=$5, fecha_siembra=$6, fecha_siembra2=$7,
           arboles1=$8, distancia_surco1=$9, distancia_planta1=$10,
           arboles2=$11, distancia_surco2=$12, distancia_planta2=$13
       WHERE id=$14 
       RETURNING *,
         fecha_siembra AS "fechaSiembra", fecha_siembra2 AS "fechaSiembra2",
         arboles1, distancia_surco1 AS "distanciaSurco1", distancia_planta1 AS "distanciaPlanta1",
         arboles2, distancia_surco2 AS "distanciaSurco2", distancia_planta2 AS "distanciaPlanta2"`,
      [
        nombre, cultivo, cultivo2, area, etapa, fechaSiembra, fechaSiembra2,
        parseInt(arboles1) || 0, parseFloat(distanciaSurco1) || 0, parseFloat(distanciaPlanta1) || 0,
        parseInt(arboles2) || 0, parseFloat(distanciaSurco2) || 0, parseFloat(distanciaPlanta2) || 0,
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
