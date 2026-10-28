const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("ADVERTENCIA: La variable de entorno DATABASE_URL no está configurada. Habilite un archivo .env local o configure la variable en Render.");
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes("neon.tech") ? {
    rejectUnauthorized: false // Requerido para conectarse a Neon de forma segura
  } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
