const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');

// Búfer en memoria para ventas suspendidas
let suspendedSales = [];
let suspendedIdCounter = 1;

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

// 2. Procesar una venta (Crear Venta)
router.post('/', async (req, res) => {
  const {
    userId, customerId, items, descuento, formaPago,
    montoEfectivo, montoTarjeta, montoTransf
  } = req.body;

  if (!userId || !items || items.length === 0 || !formaPago) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para procesar la venta' });
  }

  try {
    // A. Validar que la caja esté abierta para este cajero/usuario
    const activeRegister = await prisma.cashRegister.findFirst({
      where: { userId: parseInt(userId), estado: 'ABIERTA' }
    });
    if (!activeRegister) {
      return res.status(400).json({ error: 'Debes abrir caja antes de registrar ventas.' });
    }

    // B. Generar Folio: V-YYYYMMDD-XXXX (basado en total de ventas del día)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const countToday = await prisma.sale.count({
      where: {
        fecha: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = String(countToday + 1).padStart(4, '0');
    const folio = `V-${dateStr}-${sequence}`;

    // C. Calcular Subtotal, Descuentos e Importe Total y verificar stock
    let calculatedSubtotal = 0;
    let calculatedDiscount = parseFloat(descuento || 0);
    
    // Validamos existencias de stock de productos y preparamos transacciones de stock
    const prismaItemOperations = [];
    const stockUpdateOperations = [];
    const inventoryMovements = [];

    for (const item of items) {
      const itemSubtotal = parseFloat(item.precio) * item.cantidad;
      calculatedSubtotal += itemSubtotal;

      if (item.productId) {
        // Validar stock del producto en base de datos
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          return res.status(404).json({ error: `Producto '${item.nombre}' no encontrado.` });
        }
        if (product.stock < item.cantidad) {
          return res.status(400).json({ error: `Stock insuficiente para '${product.nombre}'. Stock actual: ${product.stock}, Solicitado: ${item.cantidad}` });
        }

        // Preparar actualización de stock
        stockUpdateOperations.push(
          prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.cantidad } }
          })
        );

        // Registrar movimiento de salida
        inventoryMovements.push({
          productId: item.productId,
          tipo: 'SALIDA',
          motivo: `Venta Folio ${folio}`,
          cantidad: -item.cantidad,
          userId
        });
      }
    }

    const calculatedTotal = calculatedSubtotal - calculatedDiscount;

    // Validar montos del pago mixto
    let ef = parseFloat(montoEfectivo || 0);
    let tj = parseFloat(montoTarjeta || 0);
    let tr = parseFloat(montoTransf || 0);

    if (formaPago === 'EFECTIVO') {
      ef = calculatedTotal;
    } else if (formaPago === 'TARJETA') {
      tj = calculatedTotal;
    } else if (formaPago === 'TRANSFERENCIA') {
      tr = calculatedTotal;
    } else if (formaPago === 'MIXTO') {
      const sum = ef + tj + tr;
      if (Math.abs(sum - calculatedTotal) > 0.1) {
        return res.status(400).json({ error: `En pago mixto, la suma de los montos ($${sum}) debe ser igual al total ($${calculatedTotal}).` });
      }
    }

    // D. Iniciar Transacción de Base de Datos
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Venta
      const sale = await tx.sale.create({
        data: {
          folio,
          userId,
          customerId: customerId ? parseInt(customerId) : null,
          subtotal: calculatedSubtotal,
          descuento: calculatedDiscount,
          total: calculatedTotal,
          formaPago,
          montoEfectivo: ef,
          montoTarjeta: tj,
          montoTransf: tr,
          estado: 'COMPLETADA',
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
        include: {
          items: true
        }
      });

      // 2. Ejecutar actualizaciones de stock
      for (const op of stockUpdateOperations) {
        // Ejecutamos cada actualización
        const prodId = op.where.id;
        const decVal = op.data.stock.decrement;
        await tx.product.update({
          where: { id: prodId },
          data: { stock: { decrement: decVal } }
        });
      }

      // 3. Crear movimientos de inventario
      for (const mov of inventoryMovements) {
        await tx.inventoryMovement.create({
          data: mov
        });
      }

      // 4. Actualizar caja registradora activa
      await tx.cashRegister.update({
        where: { id: activeRegister.id },
        data: {
          ventasEfectivo: { increment: ef },
          ventasTarjeta: { increment: tj },
          ventasTransf: { increment: tr },
          totalEsperado: { increment: calculatedTotal }
        }
      });

      return sale;
    });

    await registrarAuditoria(userId, `Procesó venta exitosa, Folio: ${folio}, Total: $${calculatedTotal}`, 'VENTAS', req);
    return res.json(result);
  } catch (error) {
    console.error('Error al registrar venta:', error);
    return res.status(500).json({ error: 'Error interno del servidor al procesar la venta.' });
  }
});

// 3. Cancelar una Venta
router.post('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'El ID de usuario es obligatorio para cancelar' });
  }

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });

    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
    if (sale.estado === 'CANCELADA') return res.status(400).json({ error: 'La venta ya se encuentra cancelada' });

    // A. Validar que la caja esté abierta para hacer la devolución en el turno activo
    const activeRegister = await prisma.cashRegister.findFirst({
      where: { userId: parseInt(userId), estado: 'ABIERTA' }
    });
    if (!activeRegister) {
      return res.status(400).json({ error: 'Debes abrir caja para poder cancelar ventas.' });
    }

    // B. Revertir inventarios y actualizar caja en transacción
    await prisma.$transaction(async (tx) => {
      // 1. Cambiar estado de venta a CANCELADA
      await tx.sale.update({
        where: { id: sale.id },
        data: { estado: 'CANCELADA' }
      });

      // 2. Revertir stocks y registrar entradas de inventario
      for (const item of sale.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.cantidad } }
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              tipo: 'ENTRADA',
              motivo: `Devolución por cancelación de venta Folio: ${sale.folio}`,
              cantidad: item.cantidad,
              userId
            }
          });
        }
      }

      // 3. Restar montos de la caja registradora activa
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

    await registrarAuditoria(userId, `Canceló la venta Folio: ${sale.folio}, Monto: $${sale.total}`, 'VENTAS', req);
    return res.json({ message: 'Venta cancelada y stock devuelto al inventario con éxito' });
  } catch (error) {
    console.error('Error al cancelar la venta:', error);
    return res.status(500).json({ error: 'Error interno al cancelar la venta' });
  }
});

// --- VENTAS SUSPENDIDAS ---

// Obtener todas las ventas suspendidas en el búfer
router.get('/suspended/list', (req, res) => {
  return res.json(suspendedSales);
});

// Suspender un carrito de compras
router.post('/suspend', (req, res) => {
  const { items, clienteNombre, userId } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No se puede suspender un carrito vacío' });
  }

  const newSuspended = {
    id: suspendedIdCounter++,
    fecha: new Date(),
    clienteNombre: clienteNombre || 'Público General',
    items,
    userId
  };

  suspendedSales.push(newSuspended);
  return res.json(newSuspended);
});

// Recuperar y eliminar una venta suspendida del búfer
router.delete('/suspended/:id', (req, res) => {
  const { id } = req.params;
  const index = suspendedSales.findIndex(s => s.id === parseInt(id));

  if (index === -1) {
    return res.status(404).json({ error: 'Venta suspendida no encontrada' });
  }

  const recovered = suspendedSales.splice(index, 1)[0];
  return res.json(recovered);
});

module.exports = router;
