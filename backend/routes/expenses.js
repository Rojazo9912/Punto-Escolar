const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías de gastos' });
  }
});

router.post('/categories', async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

  try {
    const category = await prisma.expenseCategory.create({
      data: { nombre, descripcion }
    });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear categoría de gasto' });
  }
});

module.exports = router;
