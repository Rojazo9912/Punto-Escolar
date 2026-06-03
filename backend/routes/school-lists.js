const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');

// --- RUTAS DE ESCUELAS ---

// Obtener escuelas
router.get('/schools', async (req, res) => {
  try {
    const schools = await prisma.school.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' }
    });
    return res.json(schools);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener escuelas' });
  }
});

// Crear escuela
router.post('/schools', async (req, res) => {
  const { nombre, direccion, telefono, userId } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre de la escuela es obligatorio' });
  try {
    const school = await prisma.school.create({
      data: { nombre, direccion, telefono, activo: true }
    });
    await registrarAuditoria(userId || null, `Creó escuela: ${nombre}`, 'LISTAS ESCOLARES', req);
    return res.json(school);
  } catch (error) {
    return res.status(400).json({ error: 'La escuela ya existe o es inválida' });
  }
});

// --- RUTAS DE GRADOS Y GRUPOS ---

// Obtener grados por escuela
router.get('/schools/:schoolId/grades', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const grades = await prisma.grade.findMany({
      where: { schoolId: parseInt(schoolId) },
      include: {
        schoolLists: {
          select: { id: true, activo: true }
        }
      },
      orderBy: [
        { grado: 'asc' },
        { grupo: 'asc' }
      ]
    });
    return res.json(grades);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener grados' });
  }
});

// Crear grado/grupo
router.post('/grades', async (req, res) => {
  const { schoolId, grado, grupo, cicloEscolar, userId } = req.body;
  if (!schoolId || !grado || !grupo || !cicloEscolar) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  try {
    const grade = await prisma.grade.create({
      data: {
        schoolId: parseInt(schoolId),
        grado,
        grupo,
        cicloEscolar
      }
    });
    await registrarAuditoria(userId || null, `Creó grado: ${grado}º ${grupo} en escuela ID: ${schoolId}`, 'LISTAS ESCOLARES', req);
    return res.json(grade);
  } catch (error) {
    return res.status(500).json({ error: 'Error al crear grado/grupo' });
  }
});

// --- RUTAS DE LISTAS ESCOLARES ---

// Crear o recuperar Lista para un Grado específico
router.post('/lists', async (req, res) => {
  const { gradeId, userId } = req.body;
  try {
    // Si ya existe la lista, retornarla
    let list = await prisma.schoolList.findUnique({
      where: { gradeId: parseInt(gradeId) },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!list) {
      list = await prisma.schoolList.create({
        data: {
          gradeId: parseInt(gradeId),
          activo: true
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      });
      await registrarAuditoria(userId || null, `Creó nueva lista escolar para grado ID: ${gradeId}`, 'LISTAS ESCOLARES', req);
    }
    return res.json(list);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al gestionar lista escolar' });
  }
});

// Agregar/actualizar producto en una lista escolar
router.post('/lists/items', async (req, res) => {
  const { listId, productId, cantidad, observaciones, userId } = req.body;
  if (!listId || !productId || !cantidad) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // Verificar si ya existe el producto en la lista
    const existingItem = await prisma.schoolListItem.findFirst({
      where: {
        listId: parseInt(listId),
        productId: parseInt(productId)
      }
    });

    let item;
    if (existingItem) {
      item = await prisma.schoolListItem.update({
        where: { id: existingItem.id },
        data: {
          cantidad: parseInt(cantidad),
          observaciones
        }
      });
    } else {
      item = await prisma.schoolListItem.create({
        data: {
          listId: parseInt(listId),
          productId: parseInt(productId),
          cantidad: parseInt(cantidad),
          observaciones
        }
      });
    }

    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: 'Error al agregar elemento a la lista' });
  }
});

// Eliminar un elemento de la lista escolar
router.delete('/lists/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.schoolListItem.delete({
      where: { id: parseInt(id) }
    });
    return res.json({ message: 'Elemento eliminado de la lista escolar' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar elemento de la lista' });
  }
});

// --- LÓGICA DIFERENCIADORA: CARGAR Y VALIDAR STOCK CON SUGERENCIA DE SUSTITUTOS ---
router.get('/lists/:id/load-and-validate', async (req, res) => {
  const { id } = req.params; // ID de la lista escolar (SchoolList)

  try {
    const list = await prisma.schoolList.findUnique({
      where: { id: parseInt(id) },
      include: {
        grade: {
          include: { school: true }
        },
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista escolar no encontrada' });
    }

    // Validar el stock de cada producto y buscar sustitutos si falta stock
    const validatedItems = [];

    for (const item of list.items) {
      const prod = item.product;
      const stockDisponible = prod.stock;
      const cantRequerida = item.cantidad;
      
      let estatus = 'DISPONIBLE'; // DISPONIBLE, INSUFICIENTE, AGOTADO
      if (stockDisponible === 0) {
        estatus = 'AGOTADO';
      } else if (stockDisponible < cantRequerida) {
        estatus = 'INSUFICIENTE';
      }

      let sustitutos = [];

      // Si falta stock, buscar sustitutos en la misma categoría con stock disponible
      if (estatus !== 'DISPONIBLE') {
        sustitutos = await prisma.product.findMany({
          where: {
            categoryId: prod.categoryId,
            activo: true,
            id: { not: prod.id }, // No incluir el mismo producto
            stock: { gte: 1 } // Que tengan al menos 1 disponible
          },
          orderBy: [
            { stock: 'desc' }, // Priorizar los que tengan más inventario
            { precioVenta: 'asc' }
          ],
          take: 3 // Ofrecer hasta 3 opciones de sustituto
        });
      }

      validatedItems.push({
        listItemId: item.id,
        productId: prod.id,
        nombre: prod.nombre,
        codigoBarras: prod.codigoBarras,
        sku: prod.sku,
        precio: parseFloat(prod.precioVenta.toString()),
        stock: stockDisponible,
        cantidadRequerida: cantRequerida,
        observaciones: item.observaciones,
        estatus,
        sustitutos: sustitutos.map(s => ({
          id: s.id,
          nombre: s.nombre,
          precio: parseFloat(s.precioVenta.toString()),
          stock: s.stock,
          codigoBarras: s.codigoBarras,
          sku: s.sku
        }))
      });
    }

    return res.json({
      listaId: list.id,
      escuela: list.grade.school.nombre,
      grado: list.grade.grado,
      grupo: list.grade.grupo,
      cicloEscolar: list.grade.cicloEscolar,
      items: validatedItems
    });

  } catch (error) {
    console.error('Error al validar stock de lista:', error);
    return res.status(500).json({ error: 'Error al procesar la validación de inventario' });
  }
});

module.exports = router;
