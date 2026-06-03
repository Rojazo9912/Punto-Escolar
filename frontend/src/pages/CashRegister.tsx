import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCashStore, type CashRegister as CashType } from '../store/cashStore';
import { useSessionStore } from '../store/sessionStore';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Coins, 
  FileCheck, 
  FolderLock,
  Plus,
  Minus,
  ClipboardList
} from 'lucide-react';

interface Movement {
  id: number;
  tipo: 'INGRESO' | 'EGRESO';
  monto: string;
  descripcion: string;
  fecha: string;
}

export default function CashRegister() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore(state => state.user);
  
  // Zustand Cash Store
  const { activeRegister, isOpen, setRegister, clearRegister } = useCashStore();

  // Estados
  const [moveType, setMoveType] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [moveAmt, setMoveAmt] = useState('');
  const [moveDesc, setMoveDesc] = useState('');
  const [moveError, setMoveError] = useState('');

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [cashCounted, setCashCounted] = useState('');
  const [closeError, setCloseError] = useState('');

  // Estado para apertura
  const [initialAmount, setInitialAmount] = useState('');
  const [openError, setOpenError] = useState('');


  // 1. Consultar estado activo desde el backend al cargar (Sincronía local)
  const { data: serverRegister, refetch: refetchStatus } = useQuery<CashType | null>({
    queryKey: ['cashRegisterStatus', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;
      const res = await fetch(`http://localhost:3001/api/cash/status/${currentUser.id}`);
      return res.json();
    },
    enabled: !!currentUser
  });

  // Mantener Zustand sincronizado con el servidor
  useEffect(() => {
    if (serverRegister !== undefined) {
      setRegister(serverRegister);
    }
  }, [serverRegister]);

  // 2. Consultar Movimientos del turno activo
  const { data: movements = [], refetch: refetchMovements } = useQuery<Movement[]>({
    queryKey: ['cashMovements', activeRegister?.id],
    queryFn: async () => {
      if (!activeRegister) return [];
      const res = await fetch(`http://localhost:3001/api/cash/${activeRegister.id}/movements`);
      return res.json();
    },
    enabled: !!activeRegister
  });

  // Mutación: Abrir Caja
  const openCajaMutation = useMutation({
    mutationFn: async (monto: number) => {
      const res = await fetch('http://localhost:3001/api/cash/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, montoInicial: monto })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al abrir caja');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setRegister(data);
      setInitialAmount('');
      setOpenError('');
    },
    onError: (err: any) => {
      setOpenError(err.message);
    }
  });

  // Mutación: Registrar Movimiento de Caja
  const createMovementMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('http://localhost:3001/api/cash/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, registerId: activeRegister?.id, userId: currentUser?.id })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al registrar flujo');
      }
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
      refetchMovements();
      setMoveAmt('');
      setMoveDesc('');
      setMoveError('');
    },
    onError: (err: any) => {
      setMoveError(err.message);
    }
  });

  // Mutación: Cerrar Caja (Arqueo) con Respaldo
  const closeCajaMutation = useMutation({
    mutationFn: async (totalContado: number) => {
      const res = await fetch('http://localhost:3001/api/cash/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId: activeRegister?.id, userId: currentUser?.id, totalContado })
      });
      if (!res.ok) throw new Error('Error al cerrar la caja');
      return res.json();
    },
    onSuccess: (data) => {
      alert(`Turno de caja cerrado con éxito.\nCorte generado con diferencia de: $${data.register.diferencia.toFixed(2)}.\nRespaldo de base de datos generado automáticamente en: Documentos/PuntoEscolar/Backups`);
      clearRegister();
      setShowCloseModal(false);
      setCashCounted('');
      setCloseError('');
      queryClient.invalidateQueries({ queryKey: ['cashRegisterStatus'] });
    },
    onError: (err: any) => {
      setCloseError(err.message);
    }
  });

  const handleOpenCaja = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError('');
    const amt = parseFloat(initialAmount);
    if (isNaN(amt) || amt < 0) {
      setOpenError('El fondo inicial debe ser un número positivo.');
      return;
    }
    openCajaMutation.mutate(amt);
  };

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMoveError('');
    const amt = parseFloat(moveAmt);
    if (isNaN(amt) || amt <= 0) {
      setMoveError('Ingresa un monto válido mayor a cero.');
      return;
    }
    if (!moveDesc) {
      setMoveError('La descripción es obligatoria.');
      return;
    }
    createMovementMutation.mutate({ tipo: moveType, monto: amt, descripcion: moveDesc });
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCloseError('');
    const counted = parseFloat(cashCounted);
    if (isNaN(counted) || counted < 0) {
      setCloseError('Ingresa una cantidad de efectivo válida.');
      return;
    }
    closeCajaMutation.mutate(counted);
  };

  // Cálculos dinámicos
  const r = activeRegister;
  
  // Efectivo Esperado Físico = Fondo Inicial + Ventas Efectivo + Ingresos - Egresos
  const esperadoEfectivo = r
    ? parseFloat(r.montoInicial.toString()) + 
      parseFloat(r.ventasEfectivo.toString()) + 
      parseFloat(r.ingresos.toString()) - 
      parseFloat(r.egresos.toString())
    : 0;

  const diferencia = cashCounted !== '' ? parseFloat(cashCounted) - esperadoEfectivo : 0;

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full overflow-y-auto">
      {/* Encabezado */}
      <div className="shrink-0">
        <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Control de Caja y Turnos</h1>
        <p className="text-muted-foreground text-sm">Flujo de efectivo de mostrador, depósitos, retiros e historial de cortes</p>
      </div>

      {/* CASO A: CAJA CERRADA (SOLICITAR APERTURA) */}
      {!isOpen ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-md p-8 border rounded-2xl bg-card shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
            
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-blue-500/10 rounded-2xl text-blue-600 mb-3">
                <Coins size={32} />
              </div>
              <h2 className="text-xl font-bold font-outfit text-slate-800 dark:text-slate-200">Apertura de Caja Registradora</h2>
              <p className="text-xs text-muted-foreground mt-1">Ingresa el fondo inicial de monedas y billetes para dar cambio hoy.</p>
            </div>

            {openError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center">
                {openError}
              </div>
            )}

            <form onSubmit={handleOpenCaja} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-500">Monto Inicial en Efectivo (Fondo de Caja)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-xl border bg-background text-lg font-bold font-mono text-center focus:ring-2 focus:ring-blue-500/50"
                  placeholder="$0.00"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={openCajaMutation.isPending}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/10 transition-all flex items-center justify-center gap-2"
              >
                <Wallet size={18} />
                {openCajaMutation.isPending ? 'Abriendo...' : 'Abrir Turno de Caja'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* CASO B: CAJA ABIERTA (DASHBOARD CAJA) */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          
          {/* Columna Izquierda & Centro: Métricas y Movimientos */}
          <div className="lg:col-span-2 space-y-6 flex flex-col overflow-hidden">
            
            {/* Tarjeta Resumen */}
            <div className="border rounded-2xl p-6 bg-card space-y-5 shadow-sm shrink-0">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-1.5 font-outfit">
                    <Wallet className="text-blue-500 animate-pulse" size={20} />
                    Turno Activo Caja #{r?.id}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Abierto: {r && new Date(r.fechaApertura).toLocaleString()} | Cajero: {currentUser?.username}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setCloseError('');
                    setCashCounted('');
                    setShowCloseModal(true);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/10 transition-all"
                >
                  Corte de Caja (Cerrar)
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                
                <div className="p-3 border rounded-xl bg-muted/20">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Fondo Apertura</span>
                  <span className="text-base font-extrabold block mt-0.5 font-mono">${parseFloat(r?.montoInicial.toString() || '0').toFixed(2)}</span>
                </div>

                <div className="p-3 border rounded-xl bg-emerald-500/5 border-emerald-500/10">
                  <span className="text-[10px] text-emerald-600 uppercase font-bold">Ventas Efectivo</span>
                  <span className="text-base font-extrabold block mt-0.5 text-emerald-600 font-mono">${parseFloat(r?.ventasEfectivo.toString() || '0').toFixed(2)}</span>
                </div>

                <div className="p-3 border rounded-xl bg-purple-500/5 border-purple-500/10">
                  <span className="text-[10px] text-purple-600 uppercase font-bold">Tarjeta / Transf.</span>
                  <span className="text-base font-extrabold block mt-0.5 text-purple-600 font-mono">
                    ${(parseFloat(r?.ventasTarjeta.toString() || '0') + parseFloat(r?.ventasTransf.toString() || '0')).toFixed(2)}
                  </span>
                </div>

                <div className="p-3 border rounded-xl bg-blue-500/5 border-blue-500/10">
                  <span className="text-[10px] text-blue-600 uppercase font-bold">Ingresos Extras</span>
                  <span className="text-base font-extrabold block mt-0.5 text-blue-600 font-mono">${parseFloat(r?.ingresos.toString() || '0').toFixed(2)}</span>
                </div>

                <div className="p-3 border rounded-xl bg-red-500/5 border-red-500/10">
                  <span className="text-[10px] text-red-500 uppercase font-bold">Egresos / Retiros</span>
                  <span className="text-base font-extrabold block mt-0.5 text-red-500 font-mono">${parseFloat(r?.egresos.toString() || '0').toFixed(2)}</span>
                </div>

                <div className="p-3 border rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 col-span-2 md:col-span-1">
                  <span className="text-[10px] opacity-70 uppercase font-bold">Efectivo en Caja</span>
                  <span className="text-base font-black block mt-0.5 font-mono">${esperadoEfectivo.toFixed(2)}</span>
                </div>

              </div>
            </div>

            {/* Listado de Flujo (Ingresos / Egresos) */}
            <div className="border rounded-2xl bg-card p-5 flex flex-col flex-1 overflow-hidden shadow-sm">
              <h3 className="font-bold text-base mb-3 flex items-center gap-1.5 shrink-0 font-outfit">
                <ClipboardList className="text-purple-500" size={18} />
                Historial de Flujo del Turno
              </h3>
              
              <div className="overflow-y-auto flex-1 border rounded-xl bg-muted/10 divide-y">
                {movements.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-8 text-center">No se han registrado depósitos ni retiros manuales en este turno.</p>
                ) : (
                  movements.map(mov => (
                    <div key={mov.id} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold block text-slate-800 dark:text-slate-200">{mov.descripcion}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">{new Date(mov.fecha).toLocaleTimeString()}</span>
                      </div>
                      <span className={`inline-flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full ${mov.tipo === 'INGRESO' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                        {mov.tipo === 'INGRESO' ? <Plus size={10} /> : <Minus size={10} />}
                        ${parseFloat(mov.monto).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Columna Derecha: Registrar Flujo */}
          <div className="border bg-card rounded-2xl p-5 space-y-4 shadow-sm h-fit">
            <h3 className="font-bold text-base border-b pb-3 flex items-center gap-1.5 font-outfit">
              <Coins className="text-blue-500" size={18} />
              Movimiento de Efectivo Manual
            </h3>
            
            {moveError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center">
                {moveError}
              </div>
            )}

            <form onSubmit={handleMovementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Tipo de Movimiento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMoveType('INGRESO')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${moveType === 'INGRESO' ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600' : 'hover:bg-accent'}`}
                  >
                    <ArrowUpRight size={14} /> Ingreso (Cambio)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveType('EGRESO')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${moveType === 'EGRESO' ? 'border-red-500 bg-red-500/5 text-red-500' : 'hover:bg-accent'}`}
                  >
                    <ArrowDownRight size={14} /> Egreso (Retiro)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Importe ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-bold font-mono"
                  value={moveAmt}
                  onChange={(e) => setMoveAmt(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Descripción / Concepto</label>
                <input
                  type="text"
                  placeholder="Ej: Cambio de billetes, pago de paquetería..."
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={moveDesc}
                  onChange={(e) => setMoveDesc(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={createMovementMutation.isPending}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/10 transition-all flex items-center justify-center gap-1.5"
              >
                <FileCheck size={14} /> Guardar Movimiento
              </button>
            </form>
          </div>

        </div>
      )}

      {/* MODAL COBRAR ARQUEO / CORTE DE CAJA */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <button 
              onClick={() => setShowCloseModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold font-outfit mb-2 flex items-center gap-2">
              <FolderLock className="text-red-500" />
              Arqueo y Corte de Caja
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Ingresa el efectivo contado físicamente en tu cajón para liquidar el turno.</p>

            {closeError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center">
                {closeError}
              </div>
            )}

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              
              <div className="p-4 border rounded-2xl bg-muted/20 space-y-2.5 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Fondo Inicial:</span>
                  <span className="font-semibold">${parseFloat(r?.montoInicial.toString() || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Ventas Efectivo:</span>
                  <span className="font-semibold">${parseFloat(r?.ventasEfectivo.toString() || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Inyecciones/Ingresos:</span>
                  <span className="font-semibold">${parseFloat(r?.ingresos.toString() || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground border-b pb-2">
                  <span>Retiros/Egresos:</span>
                  <span className="font-semibold">-${parseFloat(r?.egresos.toString() || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 font-bold text-slate-800 dark:text-slate-200">
                  <span>Esperado en Efectivo:</span>
                  <span className="text-base">${esperadoEfectivo.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Efectivo Físico Contado</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-xl border bg-background text-lg font-bold font-mono text-center focus:ring-2 focus:ring-blue-500/50"
                  placeholder="$0.00"
                  value={cashCounted}
                  onChange={(e) => setCashCounted(e.target.value)}
                  required
                />
              </div>

              {cashCounted !== '' && (
                <div className={`p-3 rounded-xl border text-center font-bold text-sm ${diferencia === 0 ? 'bg-blue-500/5 border-blue-500/10 text-blue-500' : (diferencia > 0 ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600' : 'bg-red-500/5 border-red-500/10 text-red-500')}`}>
                  {diferencia === 0 ? 'Arqueo Cuadrado (Sin diferencia)' : (diferencia > 0 ? `Sobrante en Caja: +$${diferencia.toFixed(2)}` : `Faltante en Caja: -$${Math.abs(diferencia).toFixed(2)}`)}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={closeCajaMutation.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/10"
                >
                  {closeCajaMutation.isPending ? 'Cerrando y Respaldando...' : 'Finalizar Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Icono simple de X
function X({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}
