const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
let dbUrl;

// Intenta detectar si estamos en un entorno empaquetado de Electron
try {
  const { app } = require('electron');
  // En el proceso principal de Electron
  if (app && app.isPackaged) {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    dbUrl = `file:${dbPath}`;
  } else {
    // Desarrollo o Node.js puro
    dbUrl = process.env.DATABASE_URL || `file:${path.join(__dirname, 'prisma/dev.db')}`;
  }
} catch (e) {
  // Si require('electron') falla, significa que estamos corriendo en Node puro (ej. npm run dev del backend)
  dbUrl = process.env.DATABASE_URL || `file:${path.join(__dirname, 'prisma/dev.db')}`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

module.exports = prisma;
