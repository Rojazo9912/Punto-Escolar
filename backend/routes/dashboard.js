const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/metrics', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Ventas del día (Completadas)
    const dailySales = await prisma.sale.aggregate({
      where: {
        fecha: {
          gte: today,
          lte: endOfDay
        },
        estado: 'COMPLETADA'
      },
      _sum: {
        total: true
      }
    });

    // 2. Ventas del mes (Completadas)
    const monthlySales = await prisma.sale.aggregate({
      where: {
        fecha: {
          gte: startOfMonth
        },
        estado: 'COMPLETADA'
      },
      _sum: {
        total: true
      }
    });

    // 3. Productos vendidos hoy
    const dailyItems = await prisma.saleItem.aggregate({
      where: {
        sale: {
          fecha: {
            gte: today,
            lte: endOfDay
          },
          estado: 'COMPLETADA'
        }
      },
      _sum: {
        cantidad: true
      }
    });

    // 4. Stock bajo (alertas: stock <= stockMinimo)
    const lowStockCount = await prisma.product.count({
      where: {
        activo: true,
        stock: {
          lte: prisma.product.fields.stockMinimo // Comparación directa en Prisma
        }
      }
    });

    // 5. Ganancia del día (Suma de (Precio Venta - Precio Compra) * Cantidad para productos)
    // Para simplificar, obtenemos todos los items de hoy y sumamos el margen
    const dailySaleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          fecha: {
            gte: today,
            lte: endOfDay
          },
          estado: 'COMPLETADA'
        }
      },
      include: {
        product: true
      }
    });

    let gananciaDia = 0;
    dailySaleItems.forEach(item => {
      if (item.product) {
        const compra = parseFloat(item.product.precioCompra.toString());
        const venta = parseFloat(item.precio.toString());
        const desc = parseFloat(item.descuento.toString());
        const precioEfectivo = venta - desc;
        gananciaDia += (precioEfectivo - compra) * item.cantidad;
      } else {
        // Si es un servicio, toda la venta es ganancia (costo 0) o podemos restar alguna estimación.
        // Asumimos que los servicios son 100% ganancia
        gananciaDia += parseFloat(item.subtotal.toString());
      }
    });

    // 5.1 Egresos Operativos del día (CashMovements con expenseCategoryId)
    const dailyExpenses = await prisma.cashMovement.aggregate({
      where: {
        fecha: {
          gte: today,
          lte: endOfDay
        },
        tipo: 'EGRESO',
        expenseCategoryId: { not: null }
      },
      _sum: {
        monto: true
      }
    });

    const egresosDiarios = parseFloat(dailyExpenses._sum.monto?.toString() || '0');
    const utilidadNeta = gananciaDia - egresosDiarios;

    // 6. Actividad Reciente: Últimas 5 ventas
    const recentSales = await prisma.sale.findMany({
      take: 5,
      orderBy: { fecha: 'desc' },
      include: {
        user: { select: { username: true } },
        customer: { select: { nombre: true } }
      }
    });

    // Últimos 5 movimientos de inventario
    const recentMovements = await prisma.inventoryMovement.findMany({
      take: 5,
      orderBy: { fecha: 'desc' },
      include: {
        product: { select: { nombre: true } }
      }
    });

    // Últimos 5 cortes de caja
    const recentCortes = await prisma.cashRegister.findMany({
      where: { estado: 'CERRADA' },
      take: 5,
      orderBy: { fechaCierre: 'desc' },
      include: {
        user: { select: { username: true } }
      }
    });

    return res.json({
      metrics: {
        ventasDia: parseFloat(dailySales._sum.total?.toString() || '0'),
        ventasMes: parseFloat(monthlySales._sum.total?.toString() || '0'),
        gananciaDia: Math.max(0, gananciaDia),
        egresosDiarios,
        utilidadNeta,
        productosVendidos: dailyItems._sum.cantidad || 0,
        stockBajoAlertas: lowStockCount
      },
      recentSales,
      recentMovements,
      recentCortes
    });
  } catch (error) {
    console.error('Error al obtener métricas del dashboard:', error);
    return res.status(500).json({ error: 'Error al obtener métricas' });
  }
});

module.exports = router;
