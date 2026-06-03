const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando semilla de base de datos...');

  // 1. Crear permisos básicos
  const permissions = [
    { name: 'vender', description: 'Permite realizar ventas y cobros en el punto de venta' },
    { name: 'consultar_productos', description: 'Permite buscar y ver detalles de productos' },
    { name: 'ver_inventario', description: 'Permite visualizar niveles de existencias' },
    { name: 'crear_editar_productos', description: 'Permite agregar y modificar productos' },
    { name: 'eliminar_productos', description: 'Permite borrar productos del inventario' },
    { name: 'ver_utilidades', description: 'Permite visualizar costos de compra y margen de ganancias' },
    { name: 'modificar_configuracion', description: 'Permite cambiar los datos del negocio y configuraciones generales' }
  ];

  const dbPermissions = [];
  for (const perm of permissions) {
    const createdPerm = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm
    });
    dbPermissions.push(createdPerm);
  }
  console.log('Permisos creados:', dbPermissions.length);

  // 2. Crear roles y asignar permisos
  const adminRole = await prisma.role.upsert({
    where: { name: 'Administrador' },
    update: {},
    create: {
      name: 'Administrador',
      description: 'Acceso total a todos los módulos y utilidades del sistema',
      permissions: {
        connect: dbPermissions.map(p => ({ id: p.id }))
      }
    }
  });

  const cajeroPerms = dbPermissions.filter(p => 
    ['vender', 'consultar_productos', 'ver_inventario'].includes(p.name)
  );
  const cajeroRole = await prisma.role.upsert({
    where: { name: 'Cajero' },
    update: {},
    create: {
      name: 'Cajero',
      description: 'Permisos limitados a operaciones de venta y consulta de productos',
      permissions: {
        connect: cajeroPerms.map(p => ({ id: p.id }))
      }
    }
  });
  console.log('Roles creados: Administrador y Cajero');

  // 3. Crear usuario administrador inicial
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      roleId: adminRole.id,
      active: true
    }
  });
  console.log('Usuario administrador por defecto creado: admin / admin123');

  // 4. Crear usuario cajero inicial
  const hashedCajeroPassword = await bcrypt.hash('caja123', 10);
  await prisma.user.upsert({
    where: { username: 'cajero' },
    update: {},
    create: {
      username: 'cajero',
      password: hashedCajeroPassword,
      roleId: cajeroRole.id,
      active: true
    }
  });
  console.log('Usuario cajero por defecto creado: cajero / caja123');

  // 5. Categorías iniciales
  const categories = [
    'Papelería General',
    'Escolar y Escritura',
    'Cuadernos y Libretas',
    'Oficina y Archivo',
    'Arte y Dibujo',
    'Servicios y Copiado'
  ];

  const cats = {};
  for (const catName of categories) {
    const cat = await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName, active: true }
    });
    cats[catName] = cat.id;
  }
  console.log('Categorías iniciales creadas.');

  // 6. Servicios escolares básicos
  const services = [
    { nombre: 'Copia Blanco y Negro Carta', precio: 1.50, unidad: 'Copia' },
    { nombre: 'Copia Blanco y Negro Oficio', precio: 2.00, unidad: 'Copia' },
    { nombre: 'Copia Color Carta', precio: 8.00, unidad: 'Copia' },
    { nombre: 'Impresión Blanco y Negro', precio: 2.00, unidad: 'Impresión' },
    { nombre: 'Impresión Color', precio: 10.00, unidad: 'Impresión' },
    { nombre: 'Escaneo', precio: 5.00, unidad: 'Escaneo' },
    { nombre: 'Engargolado Chico', precio: 15.00, unidad: 'Pieza' },
    { nombre: 'Enmicado Carta', precio: 20.00, unidad: 'Pieza' }
  ];

  for (const serv of services) {
    await prisma.service.upsert({
      where: { nombre: serv.nombre },
      update: {},
      create: serv
    });
  }
  console.log('Servicios escolares por defecto registrados.');

  // 7. Configuración por defecto del negocio
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombreNegocio: 'Punto Escolar',
      direccion: 'Av. Melchor Ocampo 123, Col. Centro, México',
      telefono: '55-1234-5678',
      correo: 'contacto@puntoescolar.com',
      rfc: 'XAXX010101000',
      mensajeTicket: '¡Gracias por su compra en Punto Escolar!'
    }
  });
  console.log('Ajustes por defecto del negocio creados.');

  // 8. Crear productos de papelería iniciales con stock y precios reales
  const productsToSeed = [
    {
      nombre: 'Lápiz Adhesivo Pritt 22g',
      codigoBarras: '7501050600123',
      sku: 'PRITT-22G',
      descripcion: 'Pegamento en barra de fácil aplicación para papel y cartón.',
      categoryId: cats['Papelería General'],
      marca: 'Pritt',
      precioCompra: 12.50,
      precioVenta: 19.50,
      stock: 45,
      stockMinimo: 10
    },
    {
      nombre: 'Cuaderno Profesional Scribe Raya 100H',
      codigoBarras: '7501021234567',
      sku: 'SCRIBE-PRO-RAY',
      descripcion: 'Cuaderno profesional de espiral doble, 100 hojas de raya.',
      categoryId: cats['Cuadernos y Libretas'],
      marca: 'Scribe',
      precioCompra: 15.00,
      precioVenta: 24.00,
      stock: 60,
      stockMinimo: 15
    },
    {
      nombre: 'Cuaderno Profesional Scribe C. Grande 100H',
      codigoBarras: '7501021234574',
      sku: 'SCRIBE-PRO-CG',
      descripcion: 'Cuaderno profesional de espiral doble, 100 hojas cuadrícula grande.',
      categoryId: cats['Cuadernos y Libretas'],
      marca: 'Scribe',
      precioCompra: 15.00,
      precioVenta: 24.00,
      stock: 1, // Stock casi agotado para demostrar la validación y sugerencia de sustituto
      stockMinimo: 15
    },
    {
      nombre: 'Cuaderno Profesional Norma C. Grande 100H',
      codigoBarras: '7501041122334',
      sku: 'NORMA-PRO-CG',
      descripcion: 'Cuaderno profesional Norma Color, 100 hojas cuadrícula grande. Excelente sustituto.',
      categoryId: cats['Cuadernos y Libretas'],
      marca: 'Norma',
      precioCompra: 18.00,
      precioVenta: 29.50,
      stock: 35,
      stockMinimo: 10
    },
    {
      nombre: 'Colores Prismacolor Junior 12 pzs',
      codigoBarras: '0707310345689',
      sku: 'PRISMA-12P',
      descripcion: 'Caja de 12 lápices de colores de alta calidad.',
      categoryId: cats['Arte y Dibujo'],
      marca: 'Prismacolor',
      precioCompra: 45.00,
      precioVenta: 68.00,
      stock: 25,
      stockMinimo: 5
    },
    {
      nombre: 'Colores Maped Color Peps 12 pzs',
      codigoBarras: '3154148320128',
      sku: 'MAPED-12P',
      descripcion: 'Lápices de colores de madera triangulares. Alternativa de colores.',
      categoryId: cats['Arte y Dibujo'],
      marca: 'Maped',
      precioCompra: 32.00,
      precioVenta: 49.00,
      stock: 40,
      stockMinimo: 5
    },
    {
      nombre: 'Tijeras Escolares Barrilito Romas',
      codigoBarras: '7501031310023',
      sku: 'BARR-TIJ-ROM',
      descripcion: 'Tijeras escolares punta roma con filo seguro de acero inoxidable.',
      categoryId: cats['Escolar y Escritura'],
      marca: 'Barrilito',
      precioCompra: 9.50,
      precioVenta: 16.00,
      stock: 30,
      stockMinimo: 8
    },
    {
      nombre: 'Goma de borrar Factis P36',
      codigoBarras: '8414034360012',
      sku: 'FACT-GOMA-P36',
      descripcion: 'Goma de borrar de migajón blanca clásica.',
      categoryId: cats['Escolar y Escritura'],
      marca: 'Factis',
      precioCompra: 3.20,
      precioVenta: 6.00,
      stock: 120,
      stockMinimo: 20
    },
    {
      nombre: 'Sacapuntas Plástico Escolar',
      codigoBarras: '7501234567890',
      sku: 'SAC-ESC-PLAS',
      descripcion: 'Sacapuntas plástico sencillo con navaja de metal.',
      categoryId: cats['Escolar y Escritura'],
      marca: 'Genérico',
      precioCompra: 1.50,
      precioVenta: 3.50,
      stock: 0, // Agotado para demostrar la búsqueda de sustituto
      stockMinimo: 25
    },
    {
      nombre: 'Sacapuntas Metálico Maped',
      codigoBarras: '3154145063004',
      sku: 'MAPED-SAC-MET',
      descripcion: 'Sacapuntas de aluminio clásico y resistente.',
      categoryId: cats['Escolar y Escritura'],
      marca: 'Maped',
      precioCompra: 8.00,
      precioVenta: 14.50,
      stock: 15,
      stockMinimo: 5
    },
    {
      nombre: 'Pluma Bic Cristal Precisión Azul',
      codigoBarras: '0703301234569',
      sku: 'BIC-CRIS-AZU',
      descripcion: 'Bolígrafo punto medio clásico de tinta azul.',
      categoryId: cats['Escolar y Escritura'],
      marca: 'Bic',
      precioCompra: 3.80,
      precioVenta: 7.00,
      stock: 200,
      stockMinimo: 30
    },
    {
      nombre: 'Pluma Bic Cristal Precisión Negra',
      codigoBarras: '0703301234576',
      sku: 'BIC-CRIS-NEG',
      descripcion: 'Bolígrafo punto medio clásico de tinta negra.',
      categoryId: cats['Escolar y Escritura'],
      marca: 'Bic',
      precioCompra: 3.80,
      precioVenta: 7.00,
      stock: 180,
      stockMinimo: 30
    },
    {
      nombre: 'Juego de Geometría Maped 5 pzs',
      codigoBarras: '3154142421111',
      sku: 'MAPED-GEO-5P',
      descripcion: 'Contiene regla de 30cm, escuadras, transportador y compás.',
      categoryId: cats['Escolar y Escritura'],
      marca: 'Maped',
      precioCompra: 35.00,
      precioVenta: 55.00,
      stock: 18,
      stockMinimo: 5
    },
    {
      nombre: 'Hojas Blancas Carta Scribe 100H',
      codigoBarras: '7501021299993',
      sku: 'SCRIBE-HOJ-100H',
      descripcion: 'Paquete de 100 hojas de papel bond blanco tamaño carta.',
      categoryId: cats['Oficina y Archivo'],
      marca: 'Scribe',
      precioCompra: 18.00,
      precioVenta: 32.00,
      stock: 50,
      stockMinimo: 10
    }
  ];

  const dbProducts = [];
  for (const prod of productsToSeed) {
    const createdProduct = await prisma.product.upsert({
      where: { codigoBarras: prod.codigoBarras },
      update: {
        stock: prod.stock,
        precioCompra: prod.precioCompra,
        precioVenta: prod.precioVenta
      },
      create: prod
    });
    dbProducts.push(createdProduct);
  }
  console.log('Productos de papelería iniciales creados:', dbProducts.length);

  // 9. Crear una Escuela, Grado y Lista Escolar de Demostración completa
  const existingSchool = await prisma.school.findUnique({
    where: { nombre: 'Primaria Benito Juárez' }
  });

  if (!existingSchool) {
    const demoSchool = await prisma.school.create({
      data: {
        nombre: 'Primaria Benito Juárez',
        direccion: 'Av. Constituyentes Col. Centro',
        telefono: '55-9876-5432'
      }
    });

    const demoGrade = await prisma.grade.create({
      data: {
        schoolId: demoSchool.id,
        grado: '1º',
        grupo: 'A',
        cicloEscolar: '2025-2026'
      }
    });

    const demoList = await prisma.schoolList.create({
      data: {
        gradeId: demoGrade.id
      }
    });

    // Agregar ítems a la lista de demostración
    const listItems = [
      { sku: 'SCRIBE-PRO-RAY', cantidad: 2, observaciones: 'Forrados de color rojo' },
      { sku: 'SCRIBE-PRO-CG', cantidad: 2, observaciones: 'Forrados de color azul' }, // Este tiene stock bajo (1)
      { sku: 'PRITT-22G', cantidad: 1, observaciones: 'Grande' },
      { sku: 'PRISMA-12P', cantidad: 1 },
      { sku: 'BARR-TIJ-ROM', cantidad: 1 },
      { sku: 'FACT-GOMA-P36', cantidad: 1 },
      { sku: 'SAC-ESC-PLAS', cantidad: 1 }, // Este está agotado (0)
      { sku: 'BIC-CRIS-AZU', cantidad: 2 }
    ];

    for (const item of listItems) {
      const matchedProduct = dbProducts.find(p => p.sku === item.sku);
      if (matchedProduct) {
        await prisma.schoolListItem.create({
          data: {
            listId: demoList.id,
            productId: matchedProduct.id,
            cantidad: item.cantidad,
            observaciones: item.observaciones || ''
          }
        });
      }
    }
    console.log('Lista escolar de demostración para Primaria Benito Juárez creada y asociada.');
  }

  console.log('Semilla completada con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
