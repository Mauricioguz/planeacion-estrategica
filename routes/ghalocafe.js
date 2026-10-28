// routes/ghalocafe.js - Endpoints nativos de GhaloCafe (Comercial, Ventas, Ingresos, Egresos y Tiendas)
const express = require('express');
const router = express.Router();
const db = require('../db');

async function query(text, params) {
  if (db.pool) {
    return await db.pool.query(text, params);
  }
  throw new Error('Base de datos no conectada');
}

// 1. BOOTSTRAP GHALOCAFE
router.get('/bootstrap', async (req, res) => {
  try {
    const [ingresosRes, egresosRes, tiendasRes] = await Promise.all([
      query(`
        SELECT id, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, cliente, producto,
               cantidad, precio_unitario, total, canal, notas
        FROM ghalocafe_ingresos
        ORDER BY fecha DESC, id DESC
        LIMIT 50
      `),
      query(`
        SELECT id, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, categoria, descripcion,
               monto, soporte, notas
        FROM ghalocafe_egresos
        ORDER BY fecha DESC, id DESC
        LIMIT 50
      `),
      query(`
        SELECT w.id, w.name, w.location, w.type,
               COALESCE(SUM(b.qty_on_hand), 0)::float as stock_unidades,
               COALESCE(ROUND(SUM(b.qty_on_hand * p.presentation_g / 1000)::numeric, 1), 0)::float as stock_kilos
        FROM inv_warehouses w
        LEFT JOIN inv_balances b ON w.id = b.warehouse_id
        LEFT JOIN inv_products p ON b.product_id = p.id
        GROUP BY w.id, w.name, w.location, w.type
        ORDER BY w.id ASC
      `)
    ]);

    const totalIngresos = ingresosRes.rows.reduce((acc, r) => acc + parseFloat(r.total || 0), 0);
    const totalEgresos = egresosRes.rows.reduce((acc, r) => acc + parseFloat(r.monto || 0), 0);
    const utilidadComercial = totalIngresos - totalEgresos;

    res.json({
      success: true,
      stats: {
        totalIngresos: Math.round(totalIngresos),
        totalEgresos: Math.round(totalEgresos),
        utilidadComercial: Math.round(utilidadComercial),
        margenOperativo: totalIngresos > 0 ? ((utilidadComercial / totalIngresos) * 100).toFixed(1) : 0,
        totalVentasCount: ingresosRes.rows.length,
        totalEgresosCount: egresosRes.rows.length
      },
      ingresos: ingresosRes.rows,
      egresos: egresosRes.rows,
      tiendas: tiendasRes.rows
    });
  } catch (err) {
    console.error('Error bootstrap ghalocafe:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. REGISTRAR VENTA / INGRESO
router.post('/ingresos', async (req, res) => {
  const { fecha, cliente, producto, cantidad, precio_unitario, canal, notas } = req.body;
  if (!cliente || !producto || !cantidad || !precio_unitario) {
    return res.status(400).json({ error: 'Todos los campos de venta son requeridos' });
  }

  const cant = parseFloat(cantidad);
  const precio = parseFloat(precio_unitario);
  const total = cant * precio;

  try {
    const result = await query(`
      INSERT INTO ghalocafe_ingresos (fecha, cliente, producto, cantidad, precio_unitario, total, canal, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, cliente, producto, cantidad, precio_unitario, total, canal, notas
    `, [fecha || new Date(), cliente.trim(), producto.trim(), cant, precio, total, canal || 'TIENDA_BOUTIQUE', notas || '']);

    res.status(201).json({
      success: true,
      message: 'Venta registrada con éxito en Neon',
      ingreso: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. REGISTRAR GASTO / EGRESO
router.post('/egresos', async (req, res) => {
  const { fecha, categoria, descripcion, monto, soporte, notas } = req.body;
  if (!categoria || !descripcion || !monto) {
    return res.status(400).json({ error: 'Categoría, descripción y monto son requeridos' });
  }

  try {
    const result = await query(`
      INSERT INTO ghalocafe_egresos (fecha, categoria, descripcion, monto, soporte, notas)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, categoria, descripcion, monto, soporte, notas
    `, [fecha || new Date(), categoria, descripcion.trim(), parseFloat(monto), soporte || '', notas || '']);

    res.status(201).json({
      success: true,
      message: 'Gasto registrado con éxito en Neon',
      egreso: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ELIMINAR INGRESO / EGRESO
router.delete('/ingresos/:id', async (req, res) => {
  try {
    await query('DELETE FROM ghalocafe_ingresos WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Registro de venta eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/egresos/:id', async (req, res) => {
  try {
    await query('DELETE FROM ghalocafe_egresos WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Registro de gasto eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

