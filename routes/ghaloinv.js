// routes/ghaloinv.js - Endpoints nativos de GhaloInv (Inventarios, Stock, Productos y Bodegas)
const express = require('express');
const router = express.Router();
const db = require('../db');

async function query(text, params) {
  if (db.pool) {
    return await db.pool.query(text, params);
  }
  throw new Error('Base de datos no conectada');
}

// 1. BOOTSTRAP / ESTADO GLOBAL DE INVENTARIOS
router.get('/bootstrap', async (req, res) => {
  try {
    const [productsRes, warehousesRes, balancesRes, docsRes] = await Promise.all([
      query('SELECT id, sku, name, type, presentation_g, packaging_unit, cost_standard, price, active FROM inv_products ORDER BY id ASC'),
      query('SELECT id, name, location, type, color, active FROM inv_warehouses ORDER BY id ASC'),
      query(`
        SELECT b.id, b.product_id, b.warehouse_id, b.qty_on_hand,
               p.name as product_name, p.sku, p.presentation_g, p.price,
               w.name as warehouse_name
        FROM inv_balances b
        JOIN inv_products p ON b.product_id = p.id
        JOIN inv_warehouses w ON b.warehouse_id = w.id
        ORDER BY w.id, p.id
      `),
      query(`
        SELECT d.id, d.doc_type, d.document_number, TO_CHAR(d.date, 'YYYY-MM-DD') as date,
               d.total_qty, d.notes,
               w1.name as warehouse_from, w2.name as warehouse_to
        FROM inv_documents d
        LEFT JOIN inv_warehouses w1 ON d.warehouse_from_id = w1.id
        LEFT JOIN inv_warehouses w2 ON d.warehouse_to_id = w2.id
        ORDER BY d.date DESC, d.id DESC
        LIMIT 20
      `)
    ]);

    // Resumen de Stock Total
    const totalUnidades = balancesRes.rows.reduce((acc, b) => acc + parseFloat(b.qty_on_hand || 0), 0);
    const totalKilos = balancesRes.rows.reduce((acc, b) => acc + (parseFloat(b.qty_on_hand || 0) * (b.presentation_g || 0) / 1000), 0);
    const valorInventario = balancesRes.rows.reduce((acc, b) => acc + (parseFloat(b.qty_on_hand || 0) * parseFloat(b.price || 0)), 0);

    res.json({
      success: true,
      stats: {
        totalUnidades: Math.round(totalUnidades),
        totalKilos: parseFloat(totalKilos.toFixed(1)),
        valorInventario: Math.round(valorInventario),
        totalProductos: productsRes.rows.filter(p => p.active).length,
        totalBodegas: warehousesRes.rows.filter(w => w.active).length
      },
      products: productsRes.rows,
      warehouses: warehousesRes.rows,
      balances: balancesRes.rows,
      recentDocuments: docsRes.rows
    });
  } catch (err) {
    console.error('Error bootstrap ghaloinv:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. CREAR PRODUCTO
router.post('/products', async (req, res) => {
  const { sku, name, type, presentation_g, packaging_unit, cost_standard, price } = req.body;
  if (!sku || !name) {
    return res.status(400).json({ error: 'SKU y Nombre son obligatorios' });
  }

  try {
    const result = await query(`
      INSERT INTO inv_products (sku, name, type, presentation_g, packaging_unit, cost_standard, price)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      sku.toUpperCase().trim(),
      name.trim(),
      type || 'MOLIDO',
      parseInt(presentation_g || 454),
      packaging_unit || 'Bolsa',
      parseFloat(cost_standard || 0),
      parseFloat(price || 0)
    ]);

    // Inicializar balance en 0 para todas las bodegas
    const warehouses = await query('SELECT id FROM inv_warehouses');
    for (const w of warehouses.rows) {
      await query(`
        INSERT INTO inv_balances (product_id, warehouse_id, qty_on_hand)
        VALUES ($1, $2, 0)
        ON CONFLICT DO NOTHING
      `, [result.rows[0].id, w.id]);
    }

    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. CREAR O EDITAR BODEGA
router.post('/warehouses', async (req, res) => {
  const { name, location, type, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre de bodega requerido' });

  try {
    const result = await query(`
      INSERT INTO inv_warehouses (name, location, type, color)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name.trim(), location || '', type || 'STORE', color || '#c6a052']);

    res.status(201).json({ success: true, warehouse: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. REGISTRAR MOVIMIENTO / DOCUMENTO DE INVENTARIO (Entrada, Salida, Traslado)
router.post('/documents', async (req, res) => {
  const { doc_type, warehouse_from_id, warehouse_to_id, date, notes, items } = req.body;
  if (!doc_type || !items || !items.length) {
    return res.status(400).json({ error: 'Tipo de documento e items requeridos' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const totalQty = items.reduce((acc, it) => acc + parseFloat(it.qty || 0), 0);
    const docNumber = `${doc_type}-${Date.now().toString().slice(-6)}`;

    const docRes = await client.query(`
      INSERT INTO inv_documents (doc_type, document_number, warehouse_from_id, warehouse_to_id, date, total_qty, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, document_number
    `, [doc_type, docNumber, warehouse_from_id || null, warehouse_to_id || null, date || new Date(), totalQty, notes || '']);

    const docId = docRes.rows[0].id;

    for (const it of items) {
      await client.query(`
        INSERT INTO inv_document_items (document_id, product_id, qty, unit_cost)
        VALUES ($1, $2, $3, $4)
      `, [docId, it.product_id, parseFloat(it.qty), parseFloat(it.unit_cost || 0)]);

      // Actualizar balances de stock en Neon
      if (doc_type === 'ENTRADA' && warehouse_to_id) {
        await client.query(`
          INSERT INTO inv_balances (product_id, warehouse_id, qty_on_hand)
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id, warehouse_id)
          DO UPDATE SET qty_on_hand = inv_balances.qty_on_hand + $3, updated_at = NOW()
        `, [it.product_id, warehouse_to_id, parseFloat(it.qty)]);
      } else if (doc_type === 'SALIDA' && warehouse_from_id) {
        await client.query(`
          INSERT INTO inv_balances (product_id, warehouse_id, qty_on_hand)
          VALUES ($1, $2, -$3)
          ON CONFLICT (product_id, warehouse_id)
          DO UPDATE SET qty_on_hand = inv_balances.qty_on_hand - $3, updated_at = NOW()
        `, [it.product_id, warehouse_from_id, parseFloat(it.qty)]);
      } else if (doc_type === 'TRASLADO' && warehouse_from_id && warehouse_to_id) {
        // Restar de origen
        await client.query(`
          INSERT INTO inv_balances (product_id, warehouse_id, qty_on_hand)
          VALUES ($1, $2, -$3)
          ON CONFLICT (product_id, warehouse_id)
          DO UPDATE SET qty_on_hand = inv_balances.qty_on_hand - $3, updated_at = NOW()
        `, [it.product_id, warehouse_from_id, parseFloat(it.qty)]);
        // Sumar a destino
        await client.query(`
          INSERT INTO inv_balances (product_id, warehouse_id, qty_on_hand)
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id, warehouse_id)
          DO UPDATE SET qty_on_hand = inv_balances.qty_on_hand + $3, updated_at = NOW()
        `, [it.product_id, warehouse_to_id, parseFloat(it.qty)]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      message: `Documento ${docNumber} aplicado con éxito en Neon`,
      documentNumber: docNumber
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error aplicando documento de inventario:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

