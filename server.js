// server.js - Servidor Express & API REST para Finca La Leonora
// Conexión a Neon PostgreSQL y despliegue en Render

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname)));

// ==================== ENDPOINTS DE LA API ====================

// 1. Estado de la conexión a Neon
app.get('/api/status', async (req, res) => {
  try {
    const status = await db.testAndInitDb();
    res.json({
      status: status.connected ? 'connected' : 'offline_fallback',
      databaseEngine: 'Neon Serverless PostgreSQL',
      database: status.database || null,
      message: status.connected 
        ? 'Conectado a Neon PostgreSQL con persistencia activa' 
        : (status.message || status.error || 'Modo local activo')
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 2. Obtener datos completos de planeación
app.get('/api/plan', async (req, res) => {
  try {
    const neonData = await db.getFullPlanFromNeon();
    if (neonData && neonData.activities && neonData.activities.length > 0) {
      return res.json({ source: 'neon_postgres', data: neonData });
    }
    // Si la BD no está configurada aún o está vacía, retornar indicador de fallback
    res.json({ source: 'local_fallback', data: null });
  } catch (err) {
    console.error('Error al obtener plan:', err);
    res.status(500).json({ error: err.message, source: 'local_fallback' });
  }
});

// 3. Crear o actualizar actividad en Neon
app.post('/api/activities', async (req, res) => {
  try {
    const activity = req.body;
    if (!activity || !activity.title) {
      return res.status(400).json({ error: 'Título requerido' });
    }
    const saved = await db.upsertActivityInNeon(activity);
    res.json({ success: true, activity: saved });
  } catch (err) {
    console.error('Error al guardar actividad en Neon:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Eliminar actividad en Neon
app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteActivityFromNeon(id);
    res.json({ success: true, message: 'Actividad eliminada' });
  } catch (err) {
    console.error('Error al eliminar actividad en Neon:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Guardar cifras reales mensuales en Neon
app.post('/api/real-monthly', async (req, res) => {
  try {
    const { items, mesIndex } = req.body;
    if (!items || mesIndex === undefined) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    await db.upsertRealMonthlyInNeon(items, mesIndex);
    res.json({ success: true, message: 'Cifras reales actualizadas en Neon' });
  } catch (err) {
    console.error('Error al guardar datos reales en Neon:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Sincronizar datos desde aplicaciones existentes (Ventas de café y P&G)
app.post('/api/sync-external', async (req, res) => {
  try {
    const { mesIndex } = req.body;
    const syncResult = await db.syncFromExistingApps(mesIndex || 9);
    res.json(syncResult);
  } catch (err) {
    console.error('Error al sincronizar con apps externas:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== ENDPOINTS DE LA SUITE ERP UNIFICADA ====================

// 7. ERP: Cosecha y Recolección (desde control-productividad-db)
app.get('/api/erp/harvest', async (req, res) => {
  try {
    const data = await db.getErpHarvestData();
    res.json(data);
  } catch (err) {
    console.error('Error al obtener datos de cosecha:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. ERP: Bodega y Salidas de Café (desde control-productividad-db)
app.get('/api/erp/warehouse', async (req, res) => {
  try {
    const data = await db.getErpWarehouseData();
    res.json(data);
  } catch (err) {
    console.error('Error al obtener datos de bodega:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9. ERP: GhaloCafe Tiendas & Puntos de Venta (desde ghalocafe_db / configuración)
app.get('/api/erp/stores', (req, res) => {
  res.json({
    stores: [
      { id: 'st-1', name: 'Bodega Principal La Leonora', city: 'Palestina (Caldas)', type: 'Origen & Distribución', stockKilos: 480, manager: 'Mauricio Guzmán' },
      { id: 'st-2', name: 'Punto La Florida', city: 'Manizales', type: 'Tienda Boutique', stockKilos: 145, manager: 'Juanita Hernández' },
      { id: 'st-3', name: 'Punto Villamaría', city: 'Villamaría', type: 'Punto de Venta Directo', stockKilos: 95, manager: 'Distribución Eje' },
      { id: 'st-4', name: 'Punto Dosquebradas', city: 'Dosquebradas / Pereira', type: 'Punto Regional', stockKilos: 120, manager: 'Aliado Cafetero' },
      { id: 'st-5', name: 'Punto Urapanes', city: 'Manizales', type: 'Café & Experiencia', stockKilos: 80, manager: 'Juanita Hernández' }
    ],
    products: [
      { sku: 'GH-M250', name: 'GhaloCafe Real Molido 250g', price: 18500, category: 'Especial' },
      { sku: 'GH-M454', name: 'GhaloCafe Real Molido 454g (Libra)', price: 32000, category: 'Especial' },
      { sku: 'GH-G250', name: 'GhaloCafe Real Grano 250g', price: 18500, category: 'Especial' },
      { sku: 'GH-G454', name: 'GhaloCafe Real Grano 454g (Libra)', price: 32000, category: 'Especial' },
      { sku: 'GH-G2500', name: 'GhaloCafe Real Grano 2.500g Institucional', price: 165000, category: 'Institucional/HORECA' }
    ]
  });
});

// 10. ERP: Consolidado Directivo General (Cruce integral de las 4 apps + web)
app.get('/api/erp/consolidated', async (req, res) => {
  try {
    const harvest = await db.getErpHarvestData();
    const warehouse = await db.getErpWarehouseData();
    res.json({
      timestamp: new Date(),
      harvestStats: harvest.stats,
      warehouseStats: warehouse.stats,
      lotsCount: 6,
      totalAreaHa: 16.4,
      storesCount: 5,
      modulesOnline: [
        { id: 'mod-agri', name: 'AgriControl BI', status: 'online', url: 'https://agri-control-bi.onrender.com' },
        { id: 'mod-prod', name: 'Control de Productividad', status: 'connected', db: 'control-productividad-db' },
        { id: 'mod-ghalo', name: 'GhaloCafe Comercial', status: 'connected', stores: 5 },
        { id: 'mod-plan', name: 'Planeación & Finanzas', status: 'active', url: 'https://planeacion-estrategica.onrender.com' },
        { id: 'mod-web', name: 'Portal Web & E-Commerce', status: 'ready', type: 'B2C Storefront' }
      ]
    });
  } catch (err) {
    console.error('Error al consolidar ERP:', err);
    res.status(500).json({ error: err.message });
  }
});

// 11. Ruta de fallback para SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor Finca La Leonora activo en puerto ${PORT}`);
  console.log(`🌐 Acceso local: http://localhost:${PORT}`);
  console.log(`====================================================`);

  // Intentar probar e inicializar Neon al arrancar
  await db.testAndInitDb();
});
