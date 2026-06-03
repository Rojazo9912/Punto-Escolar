const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');

// 1. Inicio de Sesión
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      // Registrar intento fallido
      await registrarAuditoria(null, `Intento fallido de inicio de sesión para: ${username}`, 'AUTENTICACIÓN', req);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Registrar inicio de sesión exitoso
    await registrarAuditoria(user.id, 'Inicio de sesión exitoso', 'AUTENTICACIÓN', req);

    // Retornar información del usuario sin el password
    const { password: _, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error en /login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 2. Recuperación Local de Contraseña (Reestablece admin a "admin123" usando RFC y Teléfono del negocio)
router.post('/recover', async (req, res) => {
  const { rfc, telefono } = req.body;

  if (!rfc || !telefono) {
    return res.status(400).json({ error: 'RFC y teléfono del negocio son obligatorios para validar la recuperación' });
  }

  try {
    const config = await prisma.setting.findFirst({ where: { id: 1 } });
    if (!config) {
      return res.status(404).json({ error: 'Configuración del sistema no encontrada' });
    }

    // Validar rfc y teléfono del negocio (insensible a mayúsculas/minúsculas y espacios)
    const rfcMatch = config.rfc?.trim().toLowerCase() === rfc.trim().toLowerCase();
    const telMatch = config.telefono?.trim().replace(/\D/g, '') === telefono.trim().replace(/\D/g, '');

    if (!rfcMatch || !telMatch) {
      await registrarAuditoria(null, 'Intento fallido de recuperación de contraseña', 'AUTENTICACIÓN', req);
      return res.status(401).json({ error: 'Datos de validación del negocio incorrectos' });
    }

    // Buscar al usuario administrador
    const adminRole = await prisma.role.findFirst({ where: { name: 'Administrador' } });
    const adminUser = await prisma.user.findFirst({ where: { roleId: adminRole.id } });

    if (!adminUser) {
      return res.status(404).json({ error: 'Usuario administrador no registrado' });
    }

    // Restablecer contraseña a admin123
    const newHashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: newHashedPassword }
    });

    await registrarAuditoria(adminUser.id, 'Restablecimiento de contraseña de administrador', 'AUTENTICACIÓN', req);
    return res.json({ message: 'Contraseña de administrador restablecida a: admin123' });
  } catch (error) {
    console.error('Error en /recover:', error);
    return res.status(500).json({ error: 'Error interno de recuperación' });
  }
});

// 3. Crear/Editar usuarios (Configuración)
router.post('/users', async (req, res) => {
  const { username, password, roleId } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        roleId: parseInt(roleId),
        active: true
      }
    });
    return res.json(newUser);
  } catch (error) {
    return res.status(400).json({ error: 'El nombre de usuario ya existe' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true }
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, roleId, active } = req.body;
  try {
    const data = { username, roleId: parseInt(roleId), active };
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data
    });
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: 'Error al actualizar usuario' });
  }
});

module.exports = router;
