const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectSqlFile: () => ipcRenderer.invoke('select-sql-file'),
  printTicketSilent: (htmlContent) => ipcRenderer.invoke('print-ticket-silent', htmlContent),
  getBackupDir: () => ipcRenderer.invoke('get-backup-dir')
});
