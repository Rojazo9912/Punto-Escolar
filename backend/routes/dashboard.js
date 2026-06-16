const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

router.get('/metrics', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const dayFilter = { gte: today, lte: endOfDay };

    // Ejecutar todas las queries independientes en paralelo
    const [
      dailySales,
      monthlySales,
      dailyItems,
      lowStockResult,
      dailySaleItems,
      dailyExpenses,
      recentSales,
      recentMovements,
      recentCortes
    ] = await Promise.all([
      // 1. Ventas del día
      prisma.sale.aggregate({
        where: { fecha: dayFilter, estado: 'COMPLETADA' },
        _sum: { total: true }
      }),
      // 2. Ventas del mes
      prisma.sale.aggregate({
        where: { fecha: { gte: startOfMonth, lte: endOfDay }, estado: 'COMPLETADA' },
        _sum: { total: true }
      }),
      // 3. Productos vendidos hoy
      prisma.saleItem.aggregate({
        where: { sale: { fecha: dayFilter, estado: 'COMPLETADA' } },
        _sum: { cantidad: true }
      }),
      // 4. Stock bajo — raw SQL para comparación campo-a-campo en SQLite
      prisma.$queryRaw`
        SELECT COUNT(*) as count FROM products WHERE activo = 1 AND stock <= stock_minimo
      `,
      // 5. Items del día para calcular ganancia bruta (solo campos necesarios)
      prisma.saleItem.findMany({
        where: { sale: { fecha: dayFilter, estado: 'COMPLETADA' } },
        select: {
          precio: true,
          descuento: true,
          subtotal: true,
          cantidad: true,
          product: { select: { precioCompra: true } }
        }
      }),
      // 5.1 Egresos categorizados del día
      prisma.cashMovement.aggregate({
        where: { fecha: dayFilter, tipo: 'EGRESO', expenseCategoryId: { not: null } },
        _sum: { monto: true }
      }),
      // 6a. Últimas 5 ventas completadas (excluye cotizaciones)
      prisma.sale.findMany({
        where: { estado: 'COMPLETADA' },
        take: 5,
        orderBy: { fecha: 'desc' },
        include: {
          user: { select: { username: true } },
          customer: { select: { nombre: true } }
        }
      }),
      // 6b. Últimos 5 movimientos de inventario
      prisma.inventoryMovement.findMany({
        take: 5,
        orderBy: { fecha: 'desc' },
        include: { product: { select: { nombre: true } } }
      }),
      // 6c. Últimos 5 cortes de caja
      prisma.cashRegister.findMany({
        where: { estado: 'CERRADA' },
        take: 5,
        orderBy: { fechaCierre: 'desc' },
        include: { user: { select: { username: true } } }
      })
    ]);

    // Calcular ganancia bruta del día
    let gananciaDia = 0;
    dailySaleItems.forEach(item => {
      if (item.product) {
        const compra = parseFloat(item.product.precioCompra.toString());
        const precioEfectivo = parseFloat(item.precio.toString()) - parseFloat(item.descuento.toString());
        gananciaDia += (precioEfectivo - compra) * item.cantidad;
      } else {
        // Servicios: costo asumido 0, toda la venta es ganancia
        gananciaDia += parseFloat(item.subtotal.toString());
      }
    });

    const egresosDiarios = parseFloat(dailyExpenses._sum.monto?.toString() || '0');
    // Clampar gananciaDia antes de calcular utilidadNeta para mantener consistencia
    const gananciaDiaFinal = Math.max(0, gananciaDia);
    const utilidadNeta = gananciaDiaFinal - egresosDiarios;

    return res.json({
      metrics: {
        ventasDia: parseFloat(dailySales._sum.total?.toString() || '0'),
        ventasMes: parseFloat(monthlySales._sum.total?.toString() || '0'),
        gananciaDia: gananciaDiaFinal,
        egresosDiarios,
        utilidadNeta,
        productosVendidos: dailyItems._sum.cantidad || 0,
        stockBajoAlertas: Number(lowStockResult[0].count)
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

// Datos para gráficas del Dashboard
router.get('/charts', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Construir rangos de los últimos 7 días
    const dayRanges = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - (6 - i));
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      return { dayStart, dayEnd, label: dayStart.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }) };
    });

    // Ejecutar las 7 queries de ventas y la query de gastos en paralelo
    const [salesResults, expensesByCategory] = await Promise.all([
      Promise.all(dayRanges.map(({ dayStart, dayEnd }) =>
        prisma.sale.aggregate({
          where: { fecha: { gte: dayStart, lte: dayEnd }, estado: 'COMPLETADA' },
          _sum: { total: true }
        })
      )),
      prisma.cashMovement.groupBy({
        by: ['expenseCategoryId'],
        where: {
          tipo: 'EGRESO',
          expenseCategoryId: { not: null },
          fecha: { gte: startOfMonth, lte: endOfToday }
        },
        _sum: { monto: true }
      })
    ]);

    const salesByDay = dayRanges.map(({ label }, i) => ({
      dia: label,
      ventas: parseFloat(salesResults[i]._sum.total?.toString() || '0')
    }));

    // Resolver nombres de categorías
    const categoryIds = expensesByCategory.map(e => e.expenseCategoryId).filter(Boolean);
    const categories = categoryIds.length
      ? await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } } })
      : [];

    const gastosPorCategoria = expensesByCategory.map(e => {
      const cat = categories.find(c => c.id === e.expenseCategoryId);
      return {
        nombre: cat?.nombre || 'Sin categoría',
        total: parseFloat(e._sum.monto?.toString() || '0')
      };
    });

    return res.json({ salesByDay, gastosPorCategoria });
  } catch (error) {
    console.error('Error al obtener datos de gráficas:', error);
    return res.status(500).json({ error: 'Error al obtener datos de gráficas' });
  }
});

module.exports = router;
