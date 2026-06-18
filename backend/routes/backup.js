const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { crearRespaldoSilencioso, restaurarRespaldo, getBackupDirectory } = require('../utils/backupHelper');
const { registrarAuditoria } = require('../utils/audit');
const { verifySession, requireAdmin } = require('../utils/authMiddleware');

// Proteger todas las rutas de respaldos
router.use(verifySession);
router.use(requireAdmin);

// 1. Obtener directorio y lista de respaldos registrados
router.get('/list', async (req, res) => {
  try {
    const backups = await prisma.backup.findMany({
      orderBy: { fechaCreacion: 'desc' }
    });
    return res.json({
      backupDir: getBackupDirectory(),
      backups
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener lista de respaldos' });
  }
});

// 2. Crear respaldo manual
router.post('/create', async (req, res) => {
  const { userId } = req.body;
  try {
    const result = await crearRespaldoSilencioso();
    if (result.success) {
      await registrarAuditoria(userId || null, `Creó respaldo manual de BD: ${result.fileName}`, 'CONFIGURACIÓN', req);
      return res.json(result);
    } else {
      return res.status(500).json({ error: 'Error al crear el respaldo: ' + result.error });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error al procesar respaldo' });
  }
});

// 3. Restaurar respaldo SQL
router.post('/restore', async (req, res) => {
  const { filePath, userId } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Debe proporcionar la ruta absoluta del archivo SQL de respaldo' });
  }

  try {
    await registrarAuditoria(userId || null, `Inició restauración de base de datos desde: ${filePath}`, 'CONFIGURACIÓN', req);
    
    const result = await restaurarRespaldo(filePath);
    
    await registrarAuditoria(userId || null, `Base de datos restaurada exitosamente`, 'CONFIGURACIÓN', req);
    return res.json({ message: 'Sistema restaurado completamente de forma exitosa.' });
  } catch (error) {
    console.error('Error en restauración externa:', error);
    return res.status(500).json({ error: 'Error al restaurar base de datos: ' + error.message });
  }
});

module.exports = router;
