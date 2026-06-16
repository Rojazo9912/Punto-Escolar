const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { registrarAuditoria } = require('../utils/audit');

// --- RUTAS DE CATEGORÍAS ---

// Obtener todas las categorías
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// Crear categoría
router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const newCat = await prisma.category.create({ data: { name } });
    await registrarAuditoria(req.body.userId || null, `Creó categoría: ${name}`, 'INVENTARIO', req);
    return res.json(newCat);
  } catch (error) {
    return res.status(400).json({ error: 'La categoría ya existe o es inválida' });
  }
});

// Editar categoría
router.put('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, active } = req.body;
  try {
    const updated = await prisma.category.update({
      where: { id: parseInt(id) },
      data: { name, active }
    });
    await registrarAuditoria(req.body.userId || null, `Editó categoría ID: ${id} - ${name}`, 'INVENTARIO', req);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: 'Error al actualizar categoría' });
  }
});

// --- RUTAS DE PRODUCTOS ---

// Listado general de productos
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { nombre: 'asc' }
    });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Buscar productos (Buscador POS / Inventario)
router.get('/search', async (req, res) => {
  const { query, categoryId } = req.query;
  try {
    const whereClause = {
      activo: true
    };

    if (categoryId) {
      whereClause.categoryId = parseInt(categoryId);
    }

    if (query) {
      whereClause.OR = [
        { nombre: { contains: query } },
        { codigoBarras: { contains: query } },
        { sku: { contains: query } },
        { marca: { contains: query } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: { category: true },
      take: 50 // Límite de búsqueda rápida
    });

    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: 'Error en búsqueda de productos' });
  }
});

// Obtener un producto por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { category: true }
    });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// Crear producto
router.post('/', async (req, res) => {
  const {
    nombre, codigoBarras, sku, descripcion, categoryId,
    marca, precioCompra, precioVenta, stock, stockMinimo, userId
  } = req.body;

  if (!nombre || !precioCompra || !precioVenta || !categoryId) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const newProduct = await prisma.product.create({
      data: {
        nombre,
        codigoBarras: codigoBarras || null,
        sku: sku || null,
        descripcion,
        categoryId: parseInt(categoryId),
        marca,
        precioCompra: parseFloat(precioCompra),
        precioVenta: parseFloat(precioVenta),
        stock: parseInt(stock || 0),
        stockMinimo: parseInt(stockMinimo || 5),
        activo: true
      }
    });

    // Si tiene stock inicial, registrar movimiento de entrada por ajuste inicial
    if (stock > 0) {
      await prisma.inventoryMovement.create({
        data: {
          userId: userId || 1,
          tipo: 'ENTRADA',
          motivo: 'Ajuste inicial de inventario al crear producto',
          cantidad: parseInt(stock),
          productId: newProduct.id
        }
      });
    }

    await registrarAuditoria(userId || null, `Creó producto: ${nombre} (${newProduct.id})`, 'INVENTARIO', req);
    return res.json(newProduct);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'El código de barras o SKU ya está registrado en otro producto.' });
  }
});

// Duplicar producto
router.post('/:id/duplicate', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const original = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    if (!original) return res.status(404).json({ error: 'Producto a duplicar no encontrado' });

    const duplicated = await prisma.product.create({
      data: {
        nombre: `${original.nombre} (Copia)`,
        codigoBarras: original.codigoBarras ? `${original.codigoBarras}-C` : null,
        sku: original.sku ? `${original.sku}-C` : null,
        descripcion: original.descripcion,
        categoryId: original.categoryId,
        marca: original.marca,
        precioCompra: original.precioCompra,
        precioVenta: original.precioVenta,
        stock: 0, // Inicia en 0 para evitar duplicar existencias irreales
        stockMinimo: original.stockMinimo,
        activo: true
      }
    });

    await registrarAuditoria(userId || null, `Duplicó producto ID: ${id} -> Nuevo ID: ${duplicated.id}`, 'INVENTARIO', req);
    return res.json(duplicated);
  } catch (error) {
    return res.status(500).json({ error: 'Error al duplicar producto' });
  }
});

// Editar producto
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nombre, codigoBarras, sku, descripcion, categoryId,
    marca, precioCompra, precioVenta, stockMinimo, activo, userId
  } = req.body;

  try {
    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        codigoBarras: codigoBarras || null,
        sku: sku || null,
        descripcion,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        marca,
        precioCompra: precioCompra ? parseFloat(precioCompra) : undefined,
        precioVenta: precioVenta ? parseFloat(precioVenta) : undefined,
        stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo) : undefined,
        activo
      }
    });

    await registrarAuditoria(userId || null, `Modificó producto ID: ${id} - ${nombre}`, 'INVENTARIO', req);
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Error al actualizar producto. Valida duplicados de Código o SKU.' });
  }
});

// Eliminar producto (Desactivar)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Enviado desde el cliente para auditoría
  try {
    // Para no romper el historial de ventas, hacemos soft delete desactivando el producto
    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });
    await registrarAuditoria(userId || null, `Desactivó (Eliminó) producto ID: ${id}`, 'INVENTARIO', req);
    return res.json({ message: 'Producto desactivado exitosamente', product: updated });
  } catch (error) {
    return res.status(400).json({ error: 'Error al desactivar el producto' });
  }
});

// --- MOVIMIENTOS DE INVENTARIO ---

// Registrar Ajuste de Inventario (Entrada / Salida / Ajuste)
router.post('/movements', async (req, res) => {
  const { productId, tipo, motivo, cantidad, userId } = req.body;

  if (!productId || !tipo || !cantidad || !userId) {
    return res.status(400).json({ error: 'Campos requeridos incompletos' });
  }

  const qty = parseInt(cantidad);
  if (qty <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });

  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    let newStock = product.stock;
    if (tipo === 'ENTRADA') {
      newStock += qty;
    } else if (tipo === 'SALIDA') {
      if (product.stock < qty) return res.status(400).json({ error: 'Stock insuficiente para esta salida' });
      newStock -= qty;
    } else if (tipo === 'AJUSTE') {
      // Un ajuste reemplaza directamente el stock actual
      newStock = qty;
    } else {
      return res.status(400).json({ error: 'Tipo de movimiento inválido (ENTRADA, SALIDA o AJUSTE)' });
    }

    // Ejecutar en transacción
    const [movement, updatedProduct] = await prisma.$transaction([
      prisma.inventoryMovement.create({
        data: {
          productId: parseInt(productId),
          tipo,
          motivo,
          cantidad: tipo === 'AJUSTE' ? qty : (tipo === 'SALIDA' ? -qty : qty),
          userId: parseInt(userId)
        }
      }),
      prisma.product.update({
        where: { id: parseInt(productId) },
        data: { stock: newStock }
      })
    ]);

    await registrarAuditoria(userId, `Registró movimiento ${tipo} de ${qty} unidades en Producto ID: ${productId}`, 'INVENTARIO', req);
    return res.json({ movement, product: updatedProduct });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al registrar movimiento de inventario' });
  }
});

// Obtener movimientos de inventario
router.get('/movements/history', async (req, res) => {
  try {
    const history = await prisma.inventoryMovement.findMany({
      include: {
        product: { select: { nombre: true, codigoBarras: true } },
        user: { select: { username: true } }
      },
      orderBy: { fecha: 'desc' },
      take: 200
    });
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// --- IMPORTACIÓN / EXPORTACIÓN EXCEL ---

// Exportar productos a Excel
router.get('/excel/export', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Productos');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Código de Barras', key: 'codigoBarras', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Marca', key: 'marca', width: 15 },
      { header: 'Precio Compra', key: 'precioCompra', width: 15 },
      { header: 'Precio Venta', key: 'precioVenta', width: 15 },
      { header: 'Stock Actual', key: 'stock', width: 12 },
      { header: 'Stock Mínimo', key: 'stockMinimo', width: 12 },
      { header: 'Descripción', key: 'descripcion', width: 30 },
      { header: 'Activo (SI/NO)', key: 'activo', width: 12 }
    ];

    products.forEach(p => {
      worksheet.addRow({
        id: p.id,
        nombre: p.nombre,
        codigoBarras: p.codigoBarras || '',
        sku: p.sku || '',
        categoria: p.category.name,
        marca: p.marca || '',
        precioCompra: parseFloat(p.precioCompra.toString()),
        precioVenta: parseFloat(p.precioVenta.toString()),
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        descripcion: p.descripcion || '',
        activo: p.activo ? 'SI' : 'NO'
      });
    });

    // Formatear cabecera
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + 'Inventario_Productos.xlsx'
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error al exportar inventario:', error);
    return res.status(500).json({ error: 'Error al exportar a Excel' });
  }
});

// Importar productos desde archivo de Excel (Ruta del archivo local)
router.post('/excel/import', async (req, res) => {
  const { filePath, userId } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Es obligatoria la ruta del archivo de Excel' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'El archivo especificado no existe en el disco' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    let importados = 0;
    let omitidos = 0;

    // Procesar fila por fila (saltando la cabecera)
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const nombre = row.getCell(2).value?.toString();
      
      if (!nombre) continue; // Salta líneas vacías

      const codigoBarras = row.getCell(3).value?.toString() || null;
      const sku = row.getCell(4).value?.toString() || null;
      const categoriaNombre = row.getCell(5).value?.toString() || 'Papelería General';
      const marca = row.getCell(6).value?.toString() || null;
      const precioCompra = parseFloat(row.getCell(7).value || '0');
      const precioVenta = parseFloat(row.getCell(8).value || '0');
      const stock = parseInt(row.getCell(9).value || '0');
      const stockMinimo = parseInt(row.getCell(10).value || '5');
      const descripcion = row.getCell(11).value?.toString() || '';
      
      // Buscar o crear la categoría
      let category = await prisma.category.findUnique({ where: { name: categoriaNombre } });
      if (!category) {
        category = await prisma.category.create({ data: { name: categoriaNombre } });
      }

      // Upsert por Código de Barras o SKU si existen
      let existingProduct = null;
      if (codigoBarras) {
        existingProduct = await prisma.product.findUnique({ where: { codigoBarras } });
      } else if (sku) {
        existingProduct = await prisma.product.findUnique({ where: { sku } });
      }

      if (existingProduct) {
        // Actualizar datos y agregar stock
        const totalStock = existingProduct.stock + stock;
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            nombre,
            descripcion,
            marca,
            precioCompra,
            precioVenta,
            stock: totalStock,
            stockMinimo,
            categoryId: category.id
          }
        });

        if (stock > 0) {
          await prisma.inventoryMovement.create({
            data: {
              productId: existingProduct.id,
              tipo: 'ENTRADA',
              motivo: 'Carga masiva por Importación de Excel (Actualización)',
              cantidad: stock,
              userId: userId || 1
            }
          });
        }
      } else {
        // Crear nuevo
        const newProd = await prisma.product.create({
          data: {
            nombre,
            codigoBarras,
            sku,
            descripcion,
            marca,
            precioCompra,
            precioVenta,
            stock,
            stockMinimo,
            categoryId: category.id
          }
        });

        if (stock > 0) {
          await prisma.inventoryMovement.create({
            data: {
              productId: newProd.id,
              tipo: 'ENTRADA',
              motivo: 'Carga masiva por Importación de Excel (Creación)',
              cantidad: stock,
              userId: userId || 1
            }
          });
        }
      }
      importados++;
    }

    await registrarAuditoria(userId || null, `Realizó importación masiva de productos desde Excel (${importados} procesados)`, 'INVENTARIO', req);
    return res.json({ message: 'Proceso de importación terminado', importados, omitidos });
  } catch (error) {
    console.error('Error al importar Excel:', error);
    return res.status(500).json({ error: 'Error al leer e importar el archivo de Excel. Revisa el formato.' });
  }
});

// Obtener productos con stock bajo (stock <= stockMinimo) agrupados por categoría
router.get('/low-stock', async (req, res) => {
  try {
    const products = await prisma.$queryRaw`
      SELECT p.id, p.nombre, p.stock, p.stock_minimo as stockMinimo,
             p.precio_compra as precioCompra, c.name as categoria
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.activo = 1 AND p.stock <= p.stock_minimo
      ORDER BY c.name ASC, p.nombre ASC
    `;
    return res.json(products);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener productos con stock bajo' });
  }
});

module.exports = router;
