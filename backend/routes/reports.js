const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// --- ENDPOINTS DE CONSULTA JSON ---

// 1. Reporte de Ventas por filtros
router.get('/sales-summary', async (req, res) => {
  const { filterType, startDate, endDate } = req.query; // filterType: 'day', 'week', 'month', 'range'

  try {
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (filterType === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Lunes
      start.setDate(diff);
    } else if (filterType === 'month') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
    } else if (filterType === 'range' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    const sales = await prisma.sale.findMany({
      where: {
        fecha: { gte: start, lte: end },
        estado: 'COMPLETADA'
      },
      include: {
        user: { select: { username: true } },
        items: true
      },
      orderBy: { fecha: 'desc' }
    });

    // Calcular acumulados de métodos de pago
    let totalVendido = 0;
    let efectivo = 0;
    let tarjeta = 0;
    let transferencia = 0;
    let descuento = 0;

    sales.forEach(s => {
      totalVendido += parseFloat(s.total.toString());
      descuento += parseFloat(s.descuento.toString());
      efectivo += parseFloat(s.montoEfectivo.toString());
      tarjeta += parseFloat(s.montoTarjeta.toString());
      transferencia += parseFloat(s.montoTransf.toString());
    });

    return res.json({
      summary: {
        totalVendido,
        descuento,
        efectivo,
        tarjeta,
        transferencia,
        cantidadVentas: sales.length
      },
      sales
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al calcular reporte de ventas' });
  }
});

// 2. Reporte de Inventario (Existencias y alertas)
router.get('/inventory-summary', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { activo: true },
      include: { category: true }
    });

    const totalProductos = products.length;
    const agotados = products.filter(p => p.stock === 0);
    const proximosAgotarse = products.filter(p => p.stock > 0 && p.stock <= p.stockMinimo);
    const conStockSuficiente = products.filter(p => p.stock > p.stockMinimo);

    // Calcular valor total del inventario (al costo de compra y precio de venta)
    let valorCosto = 0;
    let valorVenta = 0;
    products.forEach(p => {
      valorCosto += parseFloat(p.precioCompra.toString()) * p.stock;
      valorVenta += parseFloat(p.precioVenta.toString()) * p.stock;
    });

    return res.json({
      metrics: {
        totalProductos,
        agotadosCount: agotados.length,
        proximosAgotarseCount: proximosAgotarse.length,
        conStockSuficienteCount: conStockSuficiente.length,
        valorInventarioCosto: valorCosto,
        valorInventarioVenta: valorVenta,
        gananciaEstimada: valorVenta - valorCosto
      },
      agotados,
      proximosAgotarse
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener reporte de inventario' });
  }
});

// 3. Productos más y menos vendidos
router.get('/products-ranking', async (req, res) => {
  try {
    // Agrupar items vendidos de ventas completadas
    const groupItems = await prisma.saleItem.groupBy({
      by: ['productId', 'nombre'],
      where: {
        sale: { estado: 'COMPLETADA' },
        productId: { not: null }
      },
      _sum: {
        cantidad: true,
        subtotal: true
      }
    });

    // Ordenar de mayor a menor venta
    const ranking = groupItems.map(item => ({
      productId: item.productId,
      nombre: item.nombre,
      cantidadVendida: item._sum.cantidad || 0,
      totalVendido: parseFloat(item._sum.subtotal?.toString() || '0')
    })).sort((a, b) => b.cantidadVendida - a.cantidadVendida);

    const masVendidos = ranking.slice(0, 10);
    const menosVendidos = [...ranking].reverse().slice(0, 10);

    return res.json({
      masVendidos,
      menosVendidos
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al calcular ranking de productos' });
  }
});

// --- EXPORTACIÓN DE REPORTES EN PDF Y EXCEL ---

// 4. Exportar Reporte de Ventas en PDF
router.get('/sales/pdf', async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    const sales = await prisma.sale.findMany({
      where: {
        fecha: { gte: start, lte: end },
        estado: 'COMPLETADA'
      },
      orderBy: { fecha: 'asc' }
    });

    const settings = await prisma.setting.findUnique({ where: { id: 1 } });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Ventas.pdf');
    doc.pipe(res);

    // Cabecera PDF
    doc.fontSize(20).text(settings?.nombreNegocio || 'Punto Escolar', { align: 'center' });
    doc.fontSize(12).text('REPORTE DE VENTAS DETALLADO', { align: 'center' });
    doc.fontSize(10).text(`Período: ${start.toLocaleDateString()} al ${end.toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Tabla de Ventas
    doc.fontSize(10).text('Folio', 50, 150, { bold: true });
    doc.text('Fecha/Hora', 150, 150, { bold: true });
    doc.text('Método Pago', 280, 150, { bold: true });
    doc.text('Descuento', 400, 150, { bold: true });
    doc.text('Total', 480, 150, { bold: true });
    
    doc.moveTo(50, 165).lineTo(550, 165).stroke();

    let y = 175;
    let sumTotal = 0;

    sales.forEach(sale => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(sale.folio, 50, y);
      doc.text(new Date(sale.fecha).toLocaleString(), 150, y);
      doc.text(sale.formaPago, 280, y);
      doc.text(`$${parseFloat(sale.descuento.toString()).toFixed(2)}`, 400, y);
      doc.text(`$${parseFloat(sale.total.toString()).toFixed(2)}`, 480, y);
      sumTotal += parseFloat(sale.total.toString());
      y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 15;
    doc.fontSize(12).text(`Ventas Totales: $${sumTotal.toFixed(2)}`, 350, y, { bold: true });

    doc.end();
  } catch (error) {
    console.error('Error al generar PDF de ventas:', error);
    return res.status(500).json({ error: 'Error al generar PDF' });
  }
});

// 5. Exportar Reporte de Ventas en Excel
router.get('/sales/excel', async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    const sales = await prisma.sale.findMany({
      where: {
        fecha: { gte: start, lte: end },
        estado: 'COMPLETADA'
      },
      include: {
        user: { select: { username: true } }
      },
      orderBy: { fecha: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ventas');

    worksheet.columns = [
      { header: 'Folio', key: 'folio', width: 20 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Usuario / Cajero', key: 'usuario', width: 15 },
      { header: 'Método Pago', key: 'formaPago', width: 18 },
      { header: 'Subtotal ($)', key: 'subtotal', width: 15 },
      { header: 'Descuento ($)', key: 'descuento', width: 15 },
      { header: 'Total ($)', key: 'total', width: 15 },
      { header: 'Efectivo Recibido ($)', key: 'efectivo', width: 15 },
      { header: 'Tarjeta ($)', key: 'tarjeta', width: 15 },
      { header: 'Transferencia ($)', key: 'transferencia', width: 15 }
    ];

    sales.forEach(s => {
      worksheet.addRow({
        folio: s.folio,
        fecha: s.fecha.toLocaleString(),
        usuario: s.user.username,
        formaPago: s.formaPago,
        subtotal: parseFloat(s.subtotal.toString()),
        descuento: parseFloat(s.descuento.toString()),
        total: parseFloat(s.total.toString()),
        efectivo: parseFloat(s.montoEfectivo.toString()),
        tarjeta: parseFloat(s.montoTarjeta.toString()),
        transferencia: parseFloat(s.montoTransf.toString())
      });
    });

    // Formatear cabecera y totales
    worksheet.getRow(1).font = { bold: true };
    
    // Fila final de totales
    const lastRowIndex = sales.length + 2;
    worksheet.getCell(`D${lastRowIndex}`).value = 'TOTAL ACUMULADO';
    worksheet.getCell(`D${lastRowIndex}`).font = { bold: true };
    worksheet.getCell(`G${lastRowIndex}`).value = { formula: `SUM(G2:G${lastRowIndex - 1})` };
    worksheet.getCell(`G${lastRowIndex}`).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + `Ventas_${startDate || 'Reporte'}.xlsx`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error al generar Excel de ventas:', error);
    return res.status(500).json({ error: 'Error al generar Excel' });
  }
});

module.exports = router;
