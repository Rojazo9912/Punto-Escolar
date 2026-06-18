const crypto = require('crypto');

// Clave secreta obtenida del archivo .env o fallback por defecto para entornos offline
const SECRET_KEY = process.env.JWT_SECRET || 'punto-escolar-clave-secreta-de-firma-local';

/**
 * Genera un token firmado para el usuario con expiración de 24 horas.
 * @param {object} user - Objeto de usuario de Prisma (debe contener id, username y su rol)
 * @returns {string} Token firmado
 */
function generateToken(user) {
  const userId = user.id;
  const username = user.username;
  const roleName = user.role.name;
  
  // Expiración en 24 horas
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  
  const payload = Buffer.from(JSON.stringify({ userId, username, roleName, expiresAt })).toString('base64');
  
  // Crear firma hmac
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('hex');
    
  return `${payload}.${signature}`;
}

/**
 * Middleware para verificar que la cabecera de la petición posee un token firmado válido.
 */
function verifySession(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token de sesión no encontrado.' });
  }

  const tokenParts = token.split('.');
  if (tokenParts.length !== 2) {
    return res.status(401).json({ error: 'Acceso denegado. Token malformado.' });
  }

  const [payloadBase64, signature] = tokenParts;

  try {
    // Verificar firma
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payloadBase64)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Acceso denegado. Firma de token inválida.' });
    }

    // Decodificar payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));

    // Verificar expiración
    if (Date.now() > payload.expiresAt) {
      return res.status(401).json({ error: 'Sesión expirada. Por favor inicie sesión nuevamente.' });
    }

    // Guardar los datos del usuario autenticado en la petición
    req.userSession = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Acceso denegado. Error al descifrar token.' });
  }
}

/**
 * Middleware para exigir que el usuario autenticado tenga el rol de Administrador.
 */
function requireAdmin(req, res, next) {
  if (!req.userSession) {
    return res.status(401).json({ error: 'No autorizado. Requiere sesión activa.' });
  }

  if (req.userSession.roleName !== 'Administrador') {
    return res.status(403).json({ error: 'Permisos insuficientes. Se requiere rol de Administrador.' });
  }

  next();
}

module.exports = {
  generateToken,
  verifySession,
  requireAdmin
};
