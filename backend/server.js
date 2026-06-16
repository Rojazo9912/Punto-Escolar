const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Inicialización de Express
const app = express();
app.use(cors());
app.use(express.json());

// Importar Rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const productsRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const customersRoutes = require('./routes/customers');
const servicesRoutes = require('./routes/services');
const schoolListsRoutes = require('./routes/school-lists');
const cashRoutes = require('./routes/cash');
const backupRoutes = require('./routes/backup');
const settingsRoutes = require('./routes/settings');
const reportsRoutes = require('./routes/reports');
const suppliersRoutes = require('./routes/suppliers');
const purchasesRoutes = require('./routes/purchases');
const expensesRoutes = require('./routes/expenses');

// Registrar Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/school-lists', schoolListsRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/expenses', expensesRoutes);

// Ruta base de prueba de estado
app.get('/api/status', (req, res) => {
  return res.json({ status: 'online', service: 'Punto Escolar API', localTime: new Date() });
});

// Configuración del puerto
const PORT = process.env.PORT || 3001;

let server = null;

// Determinar modo de ejecución: Directo o Embebido en Electron
if (require.main === module) {
  // Corriendo de forma independiente
  server = app.listen(PORT, () => {
    console.log(`Servidor API Punto Escolar activo en http://localhost:${PORT}`);
  });
} else {
  // Corriendo como dependencia requerida por Electron main.js
  server = app.listen(PORT, () => {
    console.log(`Servidor API Punto Escolar embebido en Electron corriendo en http://localhost:${PORT}`);
  });
}

module.exports = server;
