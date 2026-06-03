const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');

// 1. Obtener todos los servicios
router.get('/', async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { nombre: 'asc' }
    });
    return res.json(services);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

// 2. Crear servicio
router.post('/', async (req, res) => {
  const { nombre, precio, unidad, userId } = req.body;
  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  }
  try {
    const newService = await prisma.service.create({
      data: {
        nombre,
        precio: parseFloat(precio),
        unidad: unidad || 'Servicio',
        activo: true
      }
    });
    await registrarAuditoria(userId || null, `Creó servicio: ${nombre}`, 'SERVICIOS', req);
    return res.json(newService);
  } catch (error) {
    return res.status(400).json({ error: 'El servicio ya existe o es inválido' });
  }
});

// 3. Editar servicio
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, unidad, activo, userId } = req.body;
  try {
    const updated = await prisma.service.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        precio: precio !== undefined ? parseFloat(precio) : undefined,
        unidad,
        activo
      }
    });
    await registrarAuditoria(userId || null, `Actualizó servicio ID: ${id} - ${nombre}`, 'SERVICIOS', req);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: 'Error al actualizar servicio' });
  }
});

// 4. Eliminar servicio (Soft delete desactivando)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const updated = await prisma.service.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });
    await registrarAuditoria(userId || null, `Desactivó servicio ID: ${id}`, 'SERVICIOS', req);
    return res.json({ message: 'Servicio desactivado exitosamente', service: updated });
  } catch (error) {
    return res.status(400).json({ error: 'Error al desactivar servicio' });
  }
});

module.exports = router;
