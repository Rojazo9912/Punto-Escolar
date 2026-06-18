const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');
const { verifySession, requireAdmin } = require('../utils/authMiddleware');

// Proteger todas las rutas de compras
router.use(verifySession);
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const purchases = await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        user: { select: { username: true } },
        items: true
      },
      orderBy: { fecha: 'desc' }
    });
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener compras' });
  }
});

router.post('/', async (req, res) => {
  const { supplierId, userId, items } = req.body;
  
  if (!supplierId || !userId || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    // Generar Folio
    const today = new Date();
    const countToday = await prisma.purchaseOrder.count({
      where: {
        fecha: { gte: new Date(today.setHours(0,0,0,0)), lt: new Date(today.setHours(23,59,59,999)) }
      }
    });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const folio = `OC-${dateStr}-${String(countToday + 1).padStart(4, '0')}`;

    let total = 0;
    const itemsData = items.map(item => {
      const subtotal = item.cantidad * item.costoUnitario;
      total += subtotal;
      return {
        productId: item.productId,
        cantidad: item.cantidad,
        costoUnitario: item.costoUnitario,
        subtotal
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          folio,
          supplierId,
          userId,
          total,
          items: { create: itemsData }
        }
      });

      // Actualizar Stock e Inventario
      for (const item of itemsData) {
        await tx.product.update({
          where: { id: item.productId },
          data: { 
            stock: { increment: item.cantidad },
            precioCompra: item.costoUnitario // Actualizamos el costo de compra
          }
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            tipo: 'ENTRADA',
            motivo: `Compra de mercancía Folio: ${folio}`,
            cantidad: item.cantidad,
            userId
          }
        });
      }

      return order;
    });

    await registrarAuditoria(userId, `Registró compra de mercancía Folio: ${folio}`, 'COMPRAS', req);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar compra' });
  }
});

module.exports = router;
