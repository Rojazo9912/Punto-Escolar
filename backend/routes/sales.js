const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');
const { verifySession, requireAdmin } = require('../utils/authMiddleware');

router.use(verifySession);

// 1. Obtener listado de ventas general
router.get('/', async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        user: { select: { username: true } },
        customer: { select: { nombre: true } }
      },
      orderBy: { fecha: 'desc' }
    });
    return res.json(sales);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// 1.1 Obtener Cotizaciones
router.get('/quotations', async (req, res) => {
  try {
    const quotations = await prisma.sale.findMany({
      where: { estado: 'COTIZACION' },
      include: {
        items: true,
        user: { select: { username: true } },
        customer: { select: { nombre: true } }
      },
      orderBy: { fecha: 'desc' }
    });
    return res.json(quotations);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener cotizaciones' });
  }
});

// 2. Procesar una venta o cotización
router.post('/', async (req, res) => {
  const {
    userId, customerId, items, descuento, formaPago,
    montoEfectivo, montoTarjeta, montoTransf, isQuotation
  } = req.body;

  if (!userId || !items || items.length === 0 || (!formaPago && !isQuotation)) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para procesar' });
  }

  try {
    // A. Validar caja abierta solo si NO es cotización
    let activeRegister = null;
    if (!isQuotation) {
      activeRegister = await prisma.cashRegister.findFirst({
        where: { userId: parseInt(userId), estado: 'ABIERTA' }
      });
      if (!activeRegister) {
        return res.status(400).json({ error: 'Debes abrir caja antes de registrar ventas.' });
      }
    }

    // B. Generar Folio
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const countToday = await prisma.sale.count({
      where: {
        fecha: { gte: today, lt: tomorrow },
        estado: isQuotation ? 'COTIZACION' : { not: 'COTIZACION' }
      }
    });

    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = String(countToday + 1).padStart(4, '0');
    const prefix = isQuotation ? 'COT' : 'V';
    const folio = `${prefix}-${dateStr}-${sequence}`;

    // C. Calcular Subtotal, Descuentos y verificar stock
    let calculatedSubtotal = 0;
    let calculatedDiscount = parseFloat(descuento || 0);
    
    const stockUpdateOperations = [];
    const inventoryMovements = [];

    for (const item of items) {
      const itemSubtotal = parseFloat(item.precio) * item.cantidad;
      calculatedSubtotal += itemSubtotal;

      if (item.productId) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) return res.status(404).json({ error: `Producto '${item.nombre}' no encontrado.` });
        
        if (!isQuotation && product.stock < item.cantidad) {
          return res.status(400).json({ error: `Stock insuficiente para '${product.nombre}'. Stock: ${product.stock}, Solicitado: ${item.cantidad}` });
        }

        if (!isQuotation) {
          stockUpdateOperations.push(
            prisma.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.cantidad } }
            })
          );

          inventoryMovements.push({
            productId: item.productId,
            tipo: 'SALIDA',
            motivo: `Venta Folio ${folio}`,
            cantidad: -item.cantidad,
            userId
          });
        }
      }
    }

    const calculatedTotal = calculatedSubtotal - calculatedDiscount;

    let ef = parseFloat(montoEfectivo || 0);
    let tj = parseFloat(montoTarjeta || 0);
    let tr = parseFloat(montoTransf || 0);

    if (!isQuotation) {
      if (formaPago === 'EFECTIVO') ef = calculatedTotal;
      else if (formaPago === 'TARJETA') tj = calculatedTotal;
      else if (formaPago === 'TRANSFERENCIA') tr = calculatedTotal;
      else if (formaPago === 'MIXTO') {
        const sum = ef + tj + tr;
        if (Math.abs(sum - calculatedTotal) > 0.1) {
          return res.status(400).json({ error: `En pago mixto, la suma (${sum}) debe igualar al total (${calculatedTotal}).` });
        }
      }
    }

    // D. Transacción DB
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          folio,
          userId,
          customerId: customerId ? parseInt(customerId) : null,
          subtotal: calculatedSubtotal,
          descuento: calculatedDiscount,
          total: calculatedTotal,
          formaPago: isQuotation ? 'COTIZACION' : formaPago,
          montoEfectivo: isQuotation ? 0 : ef,
          montoTarjeta: isQuotation ? 0 : tj,
          montoTransf: isQuotation ? 0 : tr,
          estado: isQuotation ? 'COTIZACION' : 'COMPLETADA',
          items: {
            create: items.map(item => ({
              productId: item.productId || null,
              serviceId: item.serviceId || null,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precio: parseFloat(item.precio),
              descuento: parseFloat(item.descuento || 0),
              subtotal: (parseFloat(item.precio) - parseFloat(item.descuento || 0)) * item.cantidad
            }))
          }
        },
        include: { items: true }
      });

      if (!isQuotation) {
        for (const op of stockUpdateOperations) {
          await tx.product.update({
            where: { id: op.where.id },
            data: { stock: { decrement: op.data.stock.decrement } }
          });
        }

        for (const mov of inventoryMovements) {
          await tx.inventoryMovement.create({ data: mov });
        }

        await tx.cashRegister.update({
          where: { id: activeRegister.id },
          data: {
            ventasEfectivo: { increment: ef },
            ventasTarjeta: { increment: tj },
            ventasTransf: { increment: tr },
            totalEsperado: { increment: calculatedTotal }
          }
        });
      }

      return sale;
    });

    const logMsg = isQuotation ? `Creó cotización Folio: ${folio}` : `Procesó venta Folio: ${folio}, Total: $${calculatedTotal}`;
    await registrarAuditoria(userId, logMsg, 'VENTAS', req);
    return res.json(result);
  } catch (error) {
    console.error('Error al registrar:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// 2.1 Eliminar Cotización (por ejemplo al recuperarla o descartarla)
router.delete('/quotations/:id', async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    await prisma.saleItem.deleteMany({ where: { saleId } });
    await prisma.sale.delete({ where: { id: saleId, estado: 'COTIZACION' } });
    return res.json({ message: 'Cotización eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar cotización' });
  }
});

// 3. Cancelar una Venta Completa
router.post('/:id/cancel', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'ID de usuario obligatorio' });

  try {
    const sale = await prisma.sale.findUnique({ where: { id: parseInt(id) }, include: { items: true } });
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
    if (sale.estado === 'CANCELADA') return res.status(400).json({ error: 'La venta ya está cancelada' });

    const activeRegister = await prisma.cashRegister.findFirst({
      where: { userId: parseInt(userId), estado: 'ABIERTA' }
    });
    if (!activeRegister) return res.status(400).json({ error: 'Abre caja para cancelar ventas.' });

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: sale.id }, data: { estado: 'CANCELADA' } });

      for (const item of sale.items) {
        if (item.productId) {
          const qtyToReturn = item.cantidad - item.cantidadDevuelta;
          if (qtyToReturn > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: qtyToReturn } }
            });

            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                tipo: 'ENTRADA',
                motivo: `Cancelación Venta Folio: ${sale.folio}`,
                cantidad: qtyToReturn,
                userId
              }
            });
          }
        }
      }

      await tx.cashRegister.update({
        where: { id: activeRegister.id },
        data: {
          ventasEfectivo: { decrement: parseFloat(sale.montoEfectivo.toString()) },
          ventasTarjeta: { decrement: parseFloat(sale.montoTarjeta.toString()) },
          ventasTransf: { decrement: parseFloat(sale.montoTransf.toString()) },
          totalEsperado: { decrement: parseFloat(sale.total.toString()) }
        }
      });
    });

    await registrarAuditoria(userId, `Canceló la venta Folio: ${sale.folio}`, 'VENTAS', req);
    return res.json({ message: 'Venta cancelada exitosamente' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al cancelar la venta' });
  }
});

// 4. Devolución Parcial
router.post('/:id/return', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { userId, itemsToReturn } = req.body; 
  // itemsToReturn: [{ saleItemId, cantidad }]

  if (!userId || !itemsToReturn || itemsToReturn.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos para procesar la devolución' });
  }

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
    if (sale.estado === 'CANCELADA') return res.status(400).json({ error: 'Venta ya cancelada' });

    const activeRegister = await prisma.cashRegister.findFirst({
      where: { userId: parseInt(userId), estado: 'ABIERTA' }
    });
    if (!activeRegister) return res.status(400).json({ error: 'Abre caja para hacer devoluciones.' });

    let totalDineroDevuelto = 0;

    await prisma.$transaction(async (tx) => {
      for (const reqItem of itemsToReturn) {
        const item = sale.items.find(i => i.id === reqItem.saleItemId);
        if (!item) throw new Error(`El artículo no pertenece a la venta`);
        
        const remainingQty = item.cantidad - item.cantidadDevuelta;
        if (reqItem.cantidad > remainingQty) {
          throw new Error(`No puedes devolver más de la cantidad disponible para ${item.nombre}`);
        }

        // Actualizar SaleItem
        await tx.saleItem.update({
          where: { id: item.id },
          data: { cantidadDevuelta: { increment: reqItem.cantidad } }
        });

        // Regresar al inventario
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: reqItem.cantidad } }
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              tipo: 'ENTRADA',
              motivo: `Devolución parcial Folio: ${sale.folio}`,
              cantidad: reqItem.cantidad,
              userId
            }
          });
        }

        // El precio devuelto (tomando en cuenta el descuento unitario)
        const unitPrice = parseFloat(item.precio.toString()) - parseFloat(item.descuento.toString());
        totalDineroDevuelto += (unitPrice * reqItem.cantidad);
      }

      // Generar el Egreso en la caja registradora
      if (totalDineroDevuelto > 0) {
        await tx.cashMovement.create({
          data: {
            registerId: activeRegister.id,
            userId,
            tipo: 'EGRESO',
            monto: totalDineroDevuelto,
            descripcion: `Devolución parcial de Ticket ${sale.folio}`
          }
        });

        await tx.cashRegister.update({
          where: { id: activeRegister.id },
          data: {
            egresos: { increment: totalDineroDevuelto },
            totalEsperado: { decrement: totalDineroDevuelto }
          }
        });
      }
    });

    await registrarAuditoria(userId, `Procesó devolución parcial en Folio: ${sale.folio} por $${totalDineroDevuelto}`, 'VENTAS', req);
    return res.json({ message: 'Devolución procesada con éxito', totalDevuelto: totalDineroDevuelto });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Error al procesar devolución' });
  }
});

module.exports = router;
