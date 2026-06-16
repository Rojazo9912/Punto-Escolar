const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

// Configuración básica de logs para el actualizador
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const fs = require('fs');

// Levantar el servidor Express del backend integrado en Electron
let serverInstance = null;
try {
  if (app.isPackaged) {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    if (!fs.existsSync(dbPath)) {
      const templatePath = path.join(process.resourcesPath, 'app.asar', 'backend', 'prisma', 'dev.db');
      if (fs.existsSync(templatePath)) {
         fs.copyFileSync(templatePath, dbPath);
         console.log('Base de datos inicializada en:', dbPath);
      }
    }
  }
  // En producción y desarrollo cargamos el servidor Express en el proceso de Node.js
  const startServer = require('../backend/server.js');
  serverInstance = startServer;
  console.log('Servidor Express local inicializado exitosamente.');
} catch (error) {
  console.error('Error al inicializar el servidor Express local:', error);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: "Punto Escolar v1.0 - MVP Comercial",
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Evita parpadeo blanco inicial
  });

  if (isDev) {
    // Apuntar al puerto por defecto de Vite
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Apuntar al build de producción
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Buscar actualizaciones luego de crear la ventana principal (solo si está empaquetado)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.error('Error al buscar actualizaciones:', err);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Eventos del Auto-Updater
autoUpdater.on('update-available', (info) => {
  log.info('Actualización disponible:', info.version);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Actualización descargada:', info.version);
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización lista',
    message: 'Una nueva versión de Punto Escolar se ha descargado. Se instalará al cerrar la aplicación.',
    buttons: ['Reiniciar y Actualizar ahora', 'Más tarde']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverInstance) {
    serverInstance.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- Manejadores de Comunicación IPC ---

// 1. Manejo de Diálogos para selección de archivos (útil para restaurar base de datos)
ipcMain.handle('select-sql-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivo de Respaldo SQL',
    defaultPath: path.join(app.getPath('documents'), 'PuntoEscolar', 'Backups'),
    filters: [
      { name: 'Respaldos MySQL (*.sql)', extensions: ['sql'] }
    ],
    properties: ['openFile']
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// 2. Manejo de impresión nativa silenciosa (útil para tickets de 80mm de forma local sin diálogo)
ipcMain.handle('print-ticket-silent', async (event, htmlContent) => {
  return new Promise((resolve) => {
    let printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } });
    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    
    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print({
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: { width: 80000, height: 200000 } // Tamaño para formato ticket de 80mm
      }, (success, failureReason) => {
        printWindow.close();
        if (success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: failureReason });
        }
      });
    });
  });
});

// 3. Obtener el path de backups nativo
ipcMain.handle('get-backup-dir', () => {
  return path.join(app.getPath('userData'), 'Backups');
});

// 4. Corrección de foco de teclado (evita bloqueo de inputs tras alerts/diálogos)
ipcMain.on('focus-fix', () => {
  if (mainWindow) {
    mainWindow.blur();
    mainWindow.focus();
  }
});
