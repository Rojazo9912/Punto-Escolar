const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { registrarAuditoria } = require('../utils/audit');
const { crearRespaldoSilencioso } = require('../utils/backupHelper');

// 1. Verificar si hay una caja abierta para el usuario
router.get('/status/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const activeRegister = await prisma.cashRegister.findFirst({
      where: {
        userId: parseInt(userId),
        estado: 'ABIERTA'
      }
    });
    return res.json(activeRegister || null);
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar estado de caja' });
  }
});

// 2. Apertura de Caja
router.post('/open', async (req, res) => {
  const { userId, montoInicial } = req.body;
  if (!userId || montoInicial === undefined) {
    return res.status(400).json({ error: 'Usuario y monto inicial son requeridos' });
  }

  try {
    // Validar que no tenga ya una caja abierta
    const active = await prisma.cashRegister.findFirst({
      where: { userId: parseInt(userId), estado: 'ABIERTA' }
    });
    if (active) {
      return res.status(400).json({ error: 'Ya tienes un turno de caja abierto actualmente.' });
    }

    const newRegister = await prisma.cashRegister.create({
      data: {
        userId: parseInt(userId),
        montoInicial: parseFloat(montoInicial),
        ventasEfectivo: 0,
        ventasTarjeta: 0,
        ventasTransf: 0,
        ingresos: 0,
        egresos: 0,
        totalEsperado: parseFloat(montoInicial), // Inicia con el fondo de caja
        estado: 'ABIERTA'
      }
    });

    await registrarAuditoria(userId, `Abrió caja con fondo inicial de $${montoInicial}`, 'CAJA', req);
    return res.json(newRegister);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al abrir caja' });
  }
});

// 3. Registrar Movimiento (Ingreso / Egreso) de efectivo
router.post('/movements', async (req, res) => {
  const { registerId, userId, tipo, monto, descripcion, expenseCategoryId } = req.body;

  if (!registerId || !userId || !tipo || !monto || !descripcion) {
    return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });
  }

  const amt = parseFloat(monto);
  if (amt <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a cero' });

  try {
    const register = await prisma.cashRegister.findUnique({ where: { id: parseInt(registerId) } });
    if (!register || register.estado === 'CERRADA') {
      return res.status(400).json({ error: 'La caja especificada no existe o está cerrada.' });
    }

    // Iniciar transacción para crear movimiento y actualizar totales esperados
    const [movement] = await prisma.$transaction([
      prisma.cashMovement.create({
        data: {
          registerId: parseInt(registerId),
          userId: parseInt(userId),
          expenseCategoryId: expenseCategoryId ? parseInt(expenseCategoryId) : null,
          tipo,
          monto: amt,
          descripcion
        }
      }),
      prisma.cashRegister.update({
        where: { id: parseInt(registerId) },
        data: {
          ingresos: tipo === 'INGRESO' ? { increment: amt } : undefined,
          egresos: tipo === 'EGRESO' ? { increment: amt } : undefined,
          totalEsperado: tipo === 'INGRESO' ? { increment: amt } : { decrement: amt }
        }
      })
    ]);

    await registrarAuditoria(userId, `Registró ${tipo} de caja por $${amt} - Motivo: ${descripcion}`, 'CAJA', req);
    return res.json(movement);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al registrar movimiento de caja' });
  }
});

// 4. Obtener todos los movimientos de una caja específica
router.get('/:registerId/movements', async (req, res) => {
  const { registerId } = req.params;
  try {
    const movements = await prisma.cashMovement.findMany({
      where: { registerId: parseInt(registerId) },
      orderBy: { fecha: 'asc' }
    });
    return res.json(movements);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener movimientos de caja' });
  }
});

// 5. Corte de Caja (Cierre) con Respaldo Automático
router.post('/close', async (req, res) => {
  const { registerId, userId, totalContado } = req.body;

  if (!registerId || !userId || totalContado === undefined) {
    return res.status(400).json({ error: 'Campos incompletos para procesar el cierre' });
  }

  try {
    const register = await prisma.cashRegister.findUnique({ where: { id: parseInt(registerId) } });
    if (!register || register.estado === 'CERRADA') {
      return res.status(400).json({ error: 'La caja especificada no existe o ya está cerrada.' });
    }

    const inicial = parseFloat(register.montoInicial.toString());
    const efectivo = parseFloat(register.ventasEfectivo.toString());
    const ing = parseFloat(register.ingresos.toString());
    const egr = parseFloat(register.egresos.toString());
    
    // El efectivo esperado físico en caja es: Inicial + Ventas Efectivo + Ingresos - Egresos
    // Tarjeta y Transferencia no entran físicamente al cajón de efectivo
    const totalEsperadoEfectivo = inicial + efectivo + ing - egr;
    
    const contado = parseFloat(totalContado);
    const dif = contado - totalEsperadoEfectivo;

    const closedRegister = await prisma.cashRegister.update({
      where: { id: parseInt(registerId) },
      data: {
        fechaCierre: new Date(),
        totalContado: contado,
        diferencia: dif,
        estado: 'CERRADA'
      }
    });

    await registrarAuditoria(userId, `Realizó corte de caja ID: ${registerId}. Esperado Efectivo: $${totalEsperadoEfectivo}, Contado: $${contado}, Diferencia: $${dif}`, 'CAJA', req);

    // --- CARACTERÍSTICA REQUERIDA: Crear respaldo automático al cerrar caja ---
    console.log('Iniciando respaldo automático tras cierre de caja...');
    const backupResult = await crearRespaldoSilencioso();
    console.log('Resultado de respaldo automático:', backupResult);

    return res.json({
      register: closedRegister,
      backup: backupResult
    });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    return res.status(500).json({ error: 'Error al procesar el corte de caja' });
  }
});

// Obtener historial de cortes de caja
router.get('/history/all', async (req, res) => {
  try {
    const history = await prisma.cashRegister.findMany({
      include: {
        user: { select: { username: true } }
      },
      orderBy: { fechaApertura: 'desc' }
    });
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener historial de cajas' });
  }
});

// Obtener todas las ventas asociadas a un corte de caja/registro (durante su periodo de apertura)
router.get('/:registerId/sales', async (req, res) => {
  const { registerId } = req.params;
  try {
    const register = await prisma.cashRegister.findUnique({
      where: { id: parseInt(registerId) }
    });
    if (!register) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }

    const sales = await prisma.sale.findMany({
      where: {
        userId: register.userId,
        fecha: {
          gte: register.fechaApertura,
          lte: register.fechaCierre || new Date()
        }
      },
      orderBy: { fecha: 'desc' },
      include: {
        customer: { select: { nombre: true } },
        items: true
      }
    });

    return res.json(sales);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al obtener las ventas del turno' });
  }
});

module.exports = router;
