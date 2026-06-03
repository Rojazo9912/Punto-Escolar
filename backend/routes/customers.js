const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');

// 1. Obtener todos los clientes (con estadísticas calculadas)
router.get('/', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        sales: {
          where: { estado: 'COMPLETADA' },
          select: {
            total: true,
            fecha: true
          }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    // Mapear respuesta para incluir indicadores acumulados
    const formattedCustomers = customers.map(c => {
      const salesCount = c.sales.length;
      const totalSpent = c.sales.reduce((acc, sale) => acc + parseFloat(sale.total.toString()), 0);
      const lastPurchase = salesCount > 0 
        ? c.sales.reduce((latest, current) => current.fecha > latest ? current.fecha : latest, c.sales[0].fecha) 
        : null;

      return {
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        correo: c.correo,
        notas: c.notas,
        createdAt: c.createdAt,
        comprasRealizadas: salesCount,
        montoAcumulado: totalSpent,
        fechaUltimaCompra: lastPurchase
      };
    });

    return res.json(formattedCustomers);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    return res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// 2. Obtener un cliente específico
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        sales: {
          where: { estado: 'COMPLETADA' },
          orderBy: { fecha: 'desc' }
        }
      }
    });
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
    return res.json(customer);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// 3. Crear cliente
router.post('/', async (req, res) => {
  const { nombre, telefono, correo, notas, userId } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });

  try {
    const newCustomer = await prisma.customer.create({
      data: { nombre, telefono, correo, notas }
    });
    await registrarAuditoria(userId || null, `Creó cliente: ${nombre}`, 'CLIENTES', req);
    return res.json(newCustomer);
  } catch (error) {
    return res.status(400).json({ error: 'Error al crear cliente' });
  }
});

// 4. Editar cliente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, correo, notas, userId } = req.body;
  try {
    const updated = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: { nombre, telefono, correo, notas }
    });
    await registrarAuditoria(userId || null, `Actualizó cliente ID: ${id} - ${nombre}`, 'CLIENTES', req);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: 'Error al actualizar cliente' });
  }
});

// 5. Eliminar cliente
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    await prisma.customer.delete({
      where: { id: parseInt(id) }
    });
    await registrarAuditoria(userId || null, `Eliminó cliente ID: ${id}`, 'CLIENTES', req);
    return res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    return res.status(400).json({ error: 'No se puede eliminar este cliente porque tiene historial de ventas asociado' });
  }
});

module.exports = router;
