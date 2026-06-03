const prisma = require('../prismaClient');

/**
 * Registra una acción en la bitácora de auditoría.
 * @param {number|null} userId - ID del usuario que realiza la acción (null para sistema o antes de login).
 * @param {string} accion - Descripción de la acción realizada (ej: 'Inicio de Sesión', 'Creación de Producto').
 * @param {string} modulo - Nombre del módulo afectado.
 * @param {object} req - Objeto de petición Express para extraer la IP local.
 */
async function registrarAuditoria(userId, accion, modulo, req) {
  try {
    let ipLocal = '127.0.0.1';
    if (req) {
      ipLocal = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      // Limpiar formato IPv6 local
      if (ipLocal === '::1' || ipLocal === '::ffff:127.0.0.1') {
        ipLocal = '127.0.0.1';
      }
    }

    await prisma.auditLog.create({
      data: {
        userId,
        accion,
        modulo,
        ipLocal,
      }
    });
  } catch (error) {
    console.error('Error al registrar en la bitácora de auditoría:', error);
  }
}

module.exports = {
  registrarAuditoria
};
