const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

router.post('/', async (req, res) => {
  const { nombre, contacto, telefono, rfc } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre es obligatorio' });

  try {
    const supplier = await prisma.supplier.create({
      data: { nombre, contacto, telefono, rfc }
    });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, contacto, telefono, rfc, activo } = req.body;
  try {
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: { nombre, contacto, telefono, rfc, activo }
    });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

module.exports = router;
