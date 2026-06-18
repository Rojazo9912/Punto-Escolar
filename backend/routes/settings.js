const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');
const { verifySession, requireAdmin } = require('../utils/authMiddleware');

// 1. Obtener configuraciones del negocio
router.get('/', verifySession, async (req, res) => {
  try {
    let settings = await prisma.setting.findUnique({ where: { id: 1 } });
    if (!settings) {
      // Recrear si por alguna razón no existe
      settings = await prisma.setting.create({
        data: {
          id: 1,
          nombreNegocio: 'Punto Escolar',
          direccion: '',
          telefono: '',
          correo: '',
          rfc: '',
          mensajeTicket: 'Gracias por su compra'
        }
      });
    }
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener configuraciones' });
  }
});

// 2. Actualizar configuraciones del negocio
router.put('/', verifySession, requireAdmin, async (req, res) => {
  const {
    nombreNegocio, direccion, telefono, correo,
    rfc, logoPath, mensajeTicket, userId
  } = req.body;

  try {
    const updated = await prisma.setting.update({
      where: { id: 1 },
      data: {
        nombreNegocio,
        direccion,
        telefono,
        correo,
        rfc,
        logoPath,
        mensajeTicket
      }
    });

    await registrarAuditoria(userId || null, 'Actualizó configuraciones generales del negocio', 'CONFIGURACIÓN', req);
    return res.json(updated);
  } catch (error) {
    console.error('Error al guardar configuraciones:', error);
    return res.status(500).json({ error: 'Error al actualizar configuraciones' });
  }
});

// 3. Obtener bitácora de auditoría (para el rol administrador en configuración)
router.get('/audit-logs', verifySession, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: { select: { username: true } }
      },
      orderBy: { fecha: 'desc' },
      take: 500 // Límite razonable de logs recientes
    });
    return res.json(logs);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener logs de auditoría' });
  }
});

module.exports = router;
