import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '../store/sessionStore';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  Archive,
  Wallet,
  BarChart2,
  PieChart as PieIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface MetricData {
  metrics: {
    ventasDia: number;
    ventasMes: number;
    gananciaDia: number;
    egresosDiarios: number;
    utilidadNeta: number;
    productosVendidos: number;
    stockBajoAlertas: number;
  };
  recentSales: any[];
  recentMovements: any[];
  recentCortes: any[];
}

export default function Dashboard() {
  const currentUser = useSessionStore(state => state.user);
  const hasPermission = useSessionStore(state => state.hasPermission);
  const isAdmin = currentUser?.role.name === 'Administrador';

  const { data, isLoading, isError, refetch, isFetching } = useQuery<MetricData>({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/dashboard/metrics');
      if (!res.ok) throw new Error('Error al obtener datos del servidor');
      return res.json();
    }
  });

  const m = data?.metrics || {
    ventasDia: 0,
    ventasMes: 0,
    gananciaDia: 0,
    egresosDiarios: 0,
    utilidadNeta: 0,
    productosVendidos: 0,
    stockBajoAlertas: 0
  };

  const { recentSales = [], recentMovements = [], recentCortes = [] } = data || {};

  const { data: chartsData } = useQuery<{ salesByDay: any[]; gastosPorCategoria: any[] }>({
    queryKey: ['dashboardCharts'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/dashboard/charts');
      if (!res.ok) throw new Error('Error al obtener gráficas');
      return res.json();
    }
  });

  const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];


  return (
    <div className="p-6 space-y-6 max-h-screen overflow-y-auto">
      {/* Encabezado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Panel Administrativo</h1>
          <p className="text-muted-foreground text-sm">Resumen general de operaciones locales hoy</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-accent text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={`${isFetching ? 'animate-spin' : ''}`} />
          Refrescar
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 border rounded-2xl animate-pulse bg-muted/30"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="p-4 border border-red-500/20 bg-red-500/10 text-red-500 rounded-xl text-center">
          Error al conectar con la base de datos local. Revisa que el servicio MySQL esté corriendo.
        </div>
      ) : (
        <>
          {/* Tarjetas de Indicadores */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${hasPermission('ver_utilidades') ? '5' : '4'} gap-6`}>
            
            {/* Ventas del Día */}
            <div className="border bg-card rounded-2xl p-5 hover:shadow-lg hover:border-blue-500/30 active:scale-[0.99] transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ventas del Día</span>
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold tracking-tight font-outfit text-blue-600 dark:text-blue-400">
                  ${m.ventasDia.toFixed(2)}
                </h3>
                <span className="text-xs text-muted-foreground mt-1 block">Ventas cobradas hoy</span>
              </div>
            </div>

            {/* Ventas del Mes */}
            <div className="border bg-card rounded-2xl p-5 hover:shadow-lg hover:border-emerald-500/30 active:scale-[0.99] transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ventas del Mes</span>
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <Calendar size={20} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold tracking-tight font-outfit text-emerald-600 dark:text-emerald-400">
                  ${m.ventasMes.toFixed(2)}
                </h3>
                <span className="text-xs text-muted-foreground mt-1 block">Acumulado mensual</span>
              </div>
            </div>

            {/* Ganancia y Utilidad */}
            {hasPermission('ver_utilidades') && (
              <div className="border bg-card rounded-2xl p-5 hover:shadow-lg hover:border-purple-500/30 active:scale-[0.99] transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Utilidad Neta</span>
                  <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                    <DollarSign size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-extrabold tracking-tight font-outfit text-purple-600 dark:text-purple-400">
                    ${m.utilidadNeta.toFixed(2)}
                  </h3>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Bruto: ${m.gananciaDia.toFixed(2)} | Gastos: ${m.egresosDiarios.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Productos Vendidos */}
            <div className="border bg-card rounded-2xl p-5 hover:shadow-lg hover:border-orange-500/30 active:scale-[0.99] transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Productos Vendidos</span>
                <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500">
                  <ShoppingBag size={20} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold tracking-tight font-outfit text-orange-600 dark:text-orange-400">
                  {m.productosVendidos}
                </h3>
                <span className="text-xs text-muted-foreground mt-1 block">Unidades despachadas</span>
              </div>
            </div>

            {/* Alertas Stock Bajo */}
            <div className={`border rounded-2xl p-5 hover:shadow-lg active:scale-[0.99] transition-all flex flex-col justify-between ${m.stockBajoAlertas > 0 ? 'bg-red-500/5 border-red-500/20 text-red-500' : 'bg-card'}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alertas de Stock</span>
                <div className={`p-2 rounded-xl ${m.stockBajoAlertas > 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                  <AlertTriangle size={20} />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold tracking-tight font-outfit">
                  {m.stockBajoAlertas}
                </h3>
                <span className="text-xs text-muted-foreground mt-1 block">
                  {m.stockBajoAlertas > 0 ? 'Productos próximos a agotarse' : 'Todo el inventario óptimo'}
                </span>
              </div>
            </div>

          </div>

          {/* Gráficas: Ventas 7 días + Gastos por Categoría */}
          {isAdmin && chartsData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* BarChart: Ventas últimos 7 días */}
              <div className="border bg-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b pb-3">
                  <BarChart2 className="text-blue-500" size={18} />
                  <h2 className="font-bold text-lg font-outfit">Ventas — Últimos 7 días</h2>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartsData.salesByDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={55} />
                    <Tooltip formatter={(v: any) => [`$${Number(v ?? 0).toFixed(2)}`, 'Ventas']} />
                    <Bar dataKey="ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* PieChart: Gastos por categoría del mes */}
              <div className="border bg-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b pb-3">
                  <PieIcon className="text-purple-500" size={18} />
                  <h2 className="font-bold text-lg font-outfit">Gastos del Mes por Categoría</h2>
                </div>
                {chartsData.gastosPorCategoria.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    Sin egresos categorizados este mes.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={chartsData.gastosPorCategoria}
                        dataKey="total"
                        nameKey="nombre"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ nombre, percent }: any) => `${nombre} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {chartsData.gastosPorCategoria.map((_: any, idx: number) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`$${Number(v ?? 0).toFixed(2)}`, 'Total']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Actividades Recientes */}
          <div className={`grid grid-cols-1 lg:grid-cols-${isAdmin ? '3' : '1'} gap-6`}>

            {/* Últimas Ventas */}
            <div className="border bg-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <Clock className="text-blue-500" size={18} />
                <h2 className="font-bold text-lg font-outfit">Últimas Ventas</h2>
              </div>
              <div className="divide-y space-y-3">
                {recentSales.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hay ventas registradas hoy.</p>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="flex justify-between items-center pt-3 first:pt-0">
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1.5">
                          {sale.folio}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sale.estado === 'COMPLETADA' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                            {sale.estado}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Cajero: {sale.user?.username} | Cliente: {sale.customer?.nombre || 'Público'}
                        </div>
                      </div>
                      <div className="font-bold text-sm text-right">
                        ${parseFloat(sale.total).toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Últimos Movimientos Inventario */}
            {isAdmin && (
              <div className="border bg-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Archive className="text-purple-500" size={18} />
                  <h2 className="font-bold text-lg font-outfit">Auditoría de Inventario</h2>
                </div>
                <div className="divide-y space-y-3">
                  {recentMovements.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No hay movimientos registrados.</p>
                  ) : (
                    recentMovements.map((mov) => (
                      <div key={mov.id} className="flex justify-between items-center pt-3 first:pt-0">
                        <div className="w-[70%]">
                          <div className="font-semibold text-sm truncate">{mov.product?.nombre}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{mov.motivo}</div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${mov.tipo === 'ENTRADA' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                            {mov.tipo === 'ENTRADA' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {Math.abs(mov.cantidad)} uds
                          </span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(mov.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Últimos Cortes de Caja */}
            {isAdmin && (
              <div className="border bg-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Wallet className="text-orange-500" size={18} />
                  <h2 className="font-bold text-lg font-outfit">Últimos Arqueos/Cortes</h2>
                </div>
                <div className="divide-y space-y-3">
                  {recentCortes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No hay turnos cerrados recientemente.</p>
                  ) : (
                    recentCortes.map((corte) => (
                      <div key={corte.id} className="flex justify-between items-center pt-3 first:pt-0">
                        <div>
                          <div className="font-semibold text-sm">
                            Corte #{corte.id}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Cajero: {corte.user?.username} | Cierre: {new Date(corte.fechaCierre).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">
                            Físico: ${parseFloat(corte.totalContado).toFixed(2)}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${parseFloat(corte.diferencia) >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                            Dif: ${parseFloat(corte.diferencia).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
