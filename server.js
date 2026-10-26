// server.js - Servidor Express & API REST para Finca La Leonora
// Conexión a Neon PostgreSQL y despliegue en Render

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuración de Tokens JWT Seguros
const JWT_SECRET = process.env.JWT_SECRET || 'finca-la-leonora-auth-secret-key-2026-secure';

function createToken(payload, expiresInHours = 72) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (expectedSig !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
  }
  req.user = user;
  next();
}

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname)));

// ==================== ENDPOINTS DE SEGURIDAD & AUTENTICACIÓN ====================

// 1. Iniciar Sesión (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const user = await db.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const token = createToken({
      id: user.id,
      username: user.username,
      nombre_completo: user.nombre_completo,
      rol: user.rol,
      email: user.email
    });
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user
    });
  } catch (err) {
    console.error('Error en /api/auth/login:', err);
    res.status(500).json({ error: 'Error interno en la autenticación' });
  }
});

// 2. Verificar Sesión Actual
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// 3. Cambiar Contraseña
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Debes indicar la contraseña actual y la nueva contraseña' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 6 caracteres' });
    }
    const result = await db.changeUserPassword(req.user.id, oldPassword, newPassword);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: result.message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Listar Usuarios (Solo Administrador)
app.get('/api/auth/users', requireAuth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso reservado a la gerencia / administrador' });
    }
    const users = await db.getAllUsers();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Crear Nuevo Usuario (Solo Administrador)
app.post('/api/auth/users', requireAuth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso reservado a la gerencia / administrador' });
    }
    const result = await db.createUser(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, user: result.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ENDPOINTS DE LA API OPERATIVA & CONSOLIDACIÓN ====================

// 6. Estado de la conexión a Neon y Servidor
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
        { id: 'mod-agri', name: 'AgriControl BI', status: 'online', url: 'https://agri-control-bi.onrender.com/' },
        { id: 'mod-prod', name: 'Control de Productividad', status: 'online', url: 'https://control-productividad-app.onrender.com/', db: 'control-productividad-db' },
        { id: 'mod-ghalo', name: 'Sistema GhaloCafe', status: 'online', url: 'https://sistema-ghalocafe.onrender.com' },
        { id: 'mod-inv', name: 'GhaloInv Inventarios', status: 'online', url: 'https://ghaloinv-app.onrender.com' },
        { id: 'mod-plan', name: 'Planeación & Finanzas', status: 'active', url: 'https://planeacion-estrategica.onrender.com' }
      ]
    });
  } catch (err) {
    console.error('Error al consolidar ERP:', err);
    res.status(500).json({ error: err.message });
  }
});

// 11. ERP: Pre-calentamiento y Wake-up de Aplicaciones en Render
const EXTERNAL_APPS_RENDER = [
  { id: 'mod-agri', name: 'AgriControl BI', url: 'https://agri-control-bi.onrender.com/' },
  { id: 'mod-prod', name: 'Control de Productividad', url: 'https://control-productividad-app.onrender.com/' },
  { id: 'mod-ghalo', name: 'Sistema GhaloCafe', url: 'https://sistema-ghalocafe.onrender.com' },
  { id: 'mod-inv', name: 'GhaloInv Inventarios', url: 'https://ghaloinv-app.onrender.com' }
];

function pingExternalService(appObj, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    try {
      const parsedUrl = new URL(appObj.url);
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname || '/',
        method: 'GET',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'FincaLaLeonora-SuiteERP/KeepAlive' }
      }, (res) => {
        res.resume();
        const durationMs = Date.now() - startTime;
        resolve({
          id: appObj.id,
          name: appObj.name,
          url: appObj.url,
          status: 'online',
          statusCode: res.statusCode,
          durationMs
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          id: appObj.id,
          name: appObj.name,
          url: appObj.url,
          status: 'waking',
          message: 'Servicio reactivándose en Render...',
          durationMs: Date.now() - startTime
        });
      });

      req.on('error', (err) => {
        resolve({
          id: appObj.id,
          name: appObj.name,
          url: appObj.url,
          status: 'waking',
          message: err.message,
          durationMs: Date.now() - startTime
        });
      });

      req.end();
    } catch (e) {
      resolve({
        id: appObj.id,
        name: appObj.name,
        url: appObj.url,
        status: 'error',
        message: e.message
      });
    }
  });
}

app.get('/api/erp/prewarm', async (req, res) => {
  try {
    const pingResults = await Promise.all(
      EXTERNAL_APPS_RENDER.map(app => pingExternalService(app, 15000))
    );
    res.json({
      timestamp: new Date(),
      results: pingResults
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Función de Keep-Alive periódico en segundo plano
function triggerKeepAliveHeartbeat() {
  console.log(`[${new Date().toISOString()}] ⚡ Keep-Alive: Enviando pulso a módulos Render para evitar suspensión...`);
  EXTERNAL_APPS_RENDER.forEach(app => {
    pingExternalService(app, 15000).then(res => {
      console.log(`[Keep-Alive] ${app.name}: ${res.status} (${res.statusCode || res.message}) en ${res.durationMs}ms`);
    });
  });
}

// 12. Ruta de fallback para SPA (Single Page Application)
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

  // Pre-calentar módulos 3 segundos después del inicio
  setTimeout(triggerKeepAliveHeartbeat, 3000);

  // Mantener despiertos los servicios con un pulso cada 12 minutos
  setInterval(triggerKeepAliveHeartbeat, 12 * 60 * 1000);
});

