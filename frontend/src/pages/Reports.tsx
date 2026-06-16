import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart, 
  Pie
} from 'recharts';
import { 
  FileSpreadsheet, 
  FileText, 
  Search, 
  TrendingUp, 
  Archive, 
  Award, 
  Wallet,
  TrendingDown
} from 'lucide-react';

interface SalesSummary {
  summary: {
    totalVendido: number;
    descuento: number;
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    cantidadVentas: number;
  };
  sales: any[];
}

interface InventorySummary {
  metrics: {
    totalProductos: number;
    agotadosCount: number;
    proximosAgotarseCount: number;
    conStockSuficienteCount: number;
    valorInventarioCosto: number;
    valorInventarioVenta: number;
    gananciaEstimada: number;
  };
  agotados: any[];
  proximosAgotarse: any[];
}

interface ProductRanking {
  masVendidos: { nombre: string; cantidadVendida: number; totalVendido: number }[];
  menosVendidos: { nombre: string; cantidadVendida: number; totalVendido: number }[];
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'ranking' | 'cash'>('sales');

  // Filtros de fecha para reporte de ventas
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Estado para Devoluciones Parciales
  const [returnSale, setReturnSale] = useState<any>(null);
  const [returnQtys, setReturnQtys] = useState<{ [id: number]: number }>({});
  const [returnError, setReturnError] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('session') || '{}')?.state?.user;

  // --- QUERY 1: REPORTE DE VENTAS ---
  const { data: salesData, isLoading: loadingSales, refetch: refetchSales } = useQuery<SalesSummary>({
    queryKey: ['salesSummary', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3001/api/reports/sales-summary?filterType=range&startDate=${startDate}&endDate=${endDate}`);
      return res.json();
    }
  });

  // --- QUERY 2: REPORTE DE INVENTARIO ---
  const { data: invData, isLoading: loadingInv } = useQuery<InventorySummary>({
    queryKey: ['inventorySummary'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/reports/inventory-summary');
      return res.json();
    }
  });

  // --- QUERY 3: RANKING DE PRODUCTOS ---
  const { data: rankData, isLoading: loadingRank } = useQuery<ProductRanking>({
    queryKey: ['productsRanking'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/reports/products-ranking');
      return res.json();
    }
  });

  // --- QUERY 4: HISTORIAL DE CORTES DE CAJA ---
  const { data: cashHistory = [], isLoading: loadingCash } = useQuery<any[]>({
    queryKey: ['cashHistoryReports'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/cash/history/all');
      return res.json();
    }
  });

  // Preparar datos para el gráfico circular de métodos de pago
  const s = salesData?.summary || { efectivo: 0, tarjeta: 0, transferencia: 0 };
  const pieData = [
    { name: 'Efectivo', value: s.efectivo, color: '#3b82f6' },
    { name: 'Tarjeta', value: s.tarjeta, color: '#a855f7' },
    { name: 'SPEI / Transf.', value: s.transferencia, color: '#eab308' }
  ].filter(item => item.value > 0);

  // Manejar el envío de la devolución
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSale) return;

    const itemsToReturn = Object.entries(returnQtys)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ saleItemId: parseInt(id), cantidad: qty }));

    if (itemsToReturn.length === 0) {
      setReturnError('Selecciona al menos 1 artículo para devolver.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/api/sales/${returnSale.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, itemsToReturn })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert(`Devolución procesada. Dinero a entregar: $${parseFloat(data.totalDevuelto).toFixed(2)}`);
      setReturnSale(null);
      setReturnQtys({});
      refetchSales();
    } catch (err: any) {
      setReturnError(err.message || 'Error al procesar devolución');
    }
  };

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full overflow-y-auto">
      
      {/* Encabezado */}
      <div className="shrink-0">
        <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Reportes y Analíticas</h1>
        <p className="text-muted-foreground text-sm">Descarga de documentos, estadísticas de ganancias y valor del inventario</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b shrink-0">
        {[
          { id: 'sales', name: 'Resumen de Ventas', icon: TrendingUp },
          { id: 'inventory', name: 'Valor de Almacén', icon: Archive },
          { id: 'ranking', name: 'Ranking de Útiles', icon: Award },
          { id: 'cash', name: 'Historial de Caja', icon: Wallet }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2.5 border-b-2 text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === t.id ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon size={16} />
              {t.name}
            </button>
          )
        })}
      </div>

      {/* CONTENIDO DE TAB: VENTAS */}
      {activeTab === 'sales' && (
        <div className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* Barra de Filtros */}
          <div className="flex gap-4 items-end p-4 border rounded-2xl bg-card shrink-0">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha Inicio</span>
              <input
                type="date"
                className="px-3 py-1.5 border rounded-xl text-sm bg-background font-semibold"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha Fin</span>
              <input
                type="date"
                className="px-3 py-1.5 border rounded-xl text-sm bg-background font-semibold"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <button
              onClick={() => refetchSales()}
              className="flex items-center gap-1 px-4 py-2 border rounded-xl text-xs font-bold hover:bg-accent"
            >
              <Search size={14} /> Buscar
            </button>

            <div className="flex-1"></div>

            <div className="flex gap-3">
              {/* Descargar PDF */}
              <a
                href={`http://localhost:3001/api/reports/sales/pdf?startDate=${startDate}&endDate=${endDate}`}
                download
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/10"
              >
                <FileText size={14} /> Exportar PDF
              </a>
              {/* Descargar Excel */}
              <a
                href={`http://localhost:3001/api/reports/sales/excel?startDate=${startDate}&endDate=${endDate}`}
                download
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/10"
              >
                <FileSpreadsheet size={14} /> Exportar Excel
              </a>
            </div>
          </div>

          {loadingSales ? (
            <div className="text-center py-20 text-muted-foreground animate-pulse">Cargando reporte de ventas...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
              
              {/* Tarjetas e Histograma */}
              <div className="lg:col-span-2 space-y-6 flex flex-col min-h-0 overflow-y-auto">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border rounded-2xl bg-card">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Facturado</span>
                    <span className="text-xl font-extrabold block text-blue-600 mt-1 font-outfit">${(salesData?.summary.totalVendido || 0).toFixed(2)}</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5 block">Ventas completadas: {salesData?.summary.cantidadVentas}</span>
                  </div>
                  <div className="p-4 border rounded-2xl bg-card">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Descuentos Aplicados</span>
                    <span className="text-xl font-extrabold block text-red-500 mt-1 font-outfit">-${(salesData?.summary.descuento || 0).toFixed(2)}</span>
                  </div>
                  <div className="p-4 border rounded-2xl bg-card">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Cobro en Efectivo</span>
                    <span className="text-xl font-extrabold block text-emerald-600 mt-1 font-outfit">${(salesData?.summary.efectivo || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Tabla de Ventas en Rango */}
                <div className="border rounded-2xl bg-card overflow-hidden flex flex-col flex-1 min-h-[300px]">
                  <h3 className="p-4 font-bold border-b text-sm font-outfit shrink-0">Desglose de Ventas del Período</h3>
                  <div className="overflow-y-auto flex-1 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-muted/40 font-bold border-b">
                        <tr>
                          <th className="px-4 py-2.5">Folio</th>
                          <th className="px-4 py-2.5">Fecha</th>
                          <th className="px-4 py-2.5">Atendió</th>
                          <th className="px-4 py-2.5">Método</th>
                          <th className="px-4 py-2.5 text-right">Total</th>
                          <th className="px-4 py-2.5 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {salesData?.sales.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-6 text-muted-foreground">No se encontraron ventas completadas.</td>
                          </tr>
                        ) : (
                          salesData?.sales.map((sale: any) => (
                            <tr key={sale.id} className="hover:bg-muted/10">
                              <td className="px-4 py-2 font-semibold font-mono">{sale.folio}</td>
                              <td className="px-4 py-2">{new Date(sale.fecha).toLocaleString()}</td>
                              <td className="px-4 py-2">{sale.user.username}</td>
                              <td className="px-4 py-2">{sale.formaPago}</td>
                              <td className="px-4 py-2 text-right font-bold">${parseFloat(sale.total).toFixed(2)}</td>
                              <td className="px-4 py-2 text-center">
                                <button
                                  onClick={() => {
                                    setReturnSale(sale);
                                    setReturnQtys({});
                                    setReturnError('');
                                  }}
                                  className="text-xs bg-red-500/10 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-500/20"
                                >
                                  Devolver
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Columna Derecha: Gráfico de Métodos de Pago */}
              <div className="border bg-card rounded-2xl p-5 flex flex-col justify-between h-[420px] shadow-sm">
                <div>
                  <h3 className="font-bold text-sm font-outfit">Canales de Venta</h3>
                  <p className="text-[10px] text-muted-foreground">Proporción de ingresos recibidos por canal</p>
                </div>
                
                {pieData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Sin datos de cobro</div>
                ) : (
                  <div className="flex-1 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `$${parseFloat(value as string).toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="space-y-2 border-t pt-3">
                  {pieData.map(item => (
                    <div key={item.name} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                        <span className="text-muted-foreground font-semibold">{item.name}</span>
                      </div>
                      <span className="font-extrabold font-mono">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

              </div>

            </div>
          )}
        </div>
      )}

      {/* CONTENIDO DE TAB: VALOR DE ALMACÉN */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          {loadingInv ? (
            <div className="text-center py-20 text-muted-foreground animate-pulse">Cargando reporte de inventario...</div>
          ) : (
            <div className="space-y-6">
              
              {/* Tarjetas de Costo / Venta */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-4 border rounded-2xl bg-card">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Catálogo Total Activos</span>
                  <span className="text-xl font-extrabold block mt-1 font-outfit">{invData?.metrics.totalProductos} productos</span>
                </div>
                <div className="p-4 border rounded-2xl bg-card">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Inversión Total Al Costo</span>
                  <span className="text-xl font-extrabold block mt-1 font-outfit text-slate-800 dark:text-slate-200">${invData?.metrics.valorInventarioCosto.toFixed(2)}</span>
                </div>
                <div className="p-4 border rounded-2xl bg-card">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Recuperación Estimada</span>
                  <span className="text-xl font-extrabold block mt-1 font-outfit text-blue-600">${invData?.metrics.valorInventarioVenta.toFixed(2)}</span>
                </div>
                <div className="p-4 border rounded-2xl bg-card bg-emerald-500/5 border-emerald-500/25 text-emerald-600">
                  <span className="text-[10px] uppercase font-bold block">Ganancia Proyectada</span>
                  <span className="text-xl font-black block mt-1 font-outfit">${invData?.metrics.gananciaEstimada.toFixed(2)}</span>
                </div>
              </div>

              {/* Acciones del Inventario */}
              <div className="flex justify-end">
                <a
                  href="http://localhost:3001/api/reports/inventory/pdf"
                  download
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/10"
                >
                  <FileText size={14} /> Descargar Sugerencia de Compra (PDF)
                </a>
              </div>

              {/* Listados de Alertas Críticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Agotados */}
                <div className="border rounded-2xl bg-card p-5 space-y-4">
                  <h3 className="font-bold text-sm text-red-500 flex items-center gap-1.5 border-b pb-2">
                    <TrendingDown size={16} /> Artículos Sin Stock (Agotados)
                  </h3>
                  <div className="divide-y space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {invData?.agotados.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">No hay productos con existencias en cero.</p>
                    ) : (
                      invData?.agotados.map(item => (
                        <div key={item.id} className="flex justify-between items-center pt-2.5 first:pt-0 text-xs">
                          <div>
                            <span className="font-semibold block">{item.nombre}</span>
                            <span className="text-[10px] text-muted-foreground">Categoría: {item.category.name}</span>
                          </div>
                          <span className="font-bold text-red-500 font-mono">0 uds</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Próximos a agotarse */}
                <div className="border rounded-2xl bg-card p-5 space-y-4">
                  <h3 className="font-bold text-sm text-amber-500 flex items-center gap-1.5 border-b pb-2">
                    <TrendingUp size={16} /> Próximos a Agotarse (Stock Mínimo)
                  </h3>
                  <div className="divide-y space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {invData?.proximosAgotarse.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">No hay productos en nivel crítico.</p>
                    ) : (
                      invData?.proximosAgotarse.map(item => (
                        <div key={item.id} className="flex justify-between items-center pt-2.5 first:pt-0 text-xs">
                          <div>
                            <span className="font-semibold block">{item.nombre}</span>
                            <span className="text-[10px] text-muted-foreground">Categoría: {item.category.name} | Mínimo: {item.stockMinimo}</span>
                          </div>
                          <span className="font-bold text-amber-500 font-mono">{item.stock} uds</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>
      )}

      {/* CONTENIDO DE TAB: RANKING DE ÚTILES */}
      {activeTab === 'ranking' && (
        <div className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          {loadingRank ? (
            <div className="text-center py-20 text-muted-foreground animate-pulse">Calculando ranking de ventas...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
              
              {/* Gráfico Más Vendidos */}
              <div className="border bg-card rounded-2xl p-5 flex flex-col h-full shadow-sm">
                <h3 className="font-bold text-sm mb-4 font-outfit text-blue-600 dark:text-blue-400">Top 10 Útiles Más Vendidos (Cantidades)</h3>
                <div className="flex-1 text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankData?.masVendidos} layout="vertical">
                      <XAxis type="number" />
                      <YAxis dataKey="nombre" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="cantidadVendida" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico Menos Vendidos */}
              <div className="border bg-card rounded-2xl p-5 flex flex-col h-full shadow-sm">
                <h3 className="font-bold text-sm mb-4 font-outfit text-purple-600 dark:text-purple-400">Top 10 Útiles Menos Vendidos (Existencias)</h3>
                <div className="flex-1 text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankData?.menosVendidos} layout="vertical">
                      <XAxis type="number" />
                      <YAxis dataKey="nombre" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="cantidadVendida" fill="#a855f7" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* CONTENIDO DE TAB: HISTORIAL DE CAJA */}
      {activeTab === 'cash' && (
        <div className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          {loadingCash ? (
            <div className="text-center py-20 text-muted-foreground animate-pulse">Cargando bitácora de caja...</div>
          ) : (
            <div className="border rounded-2xl bg-card overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/40 font-bold border-b">
                  <tr>
                    <th className="px-6 py-4">Turno ID</th>
                    <th className="px-6 py-4">Usuario / Cajero</th>
                    <th className="px-6 py-4">Apertura / Cierre</th>
                    <th className="px-6 py-4">Monto Inicial</th>
                    <th className="px-6 py-4">Ventas Efectivo</th>
                    <th className="px-6 py-4">Físico Contado</th>
                    <th className="px-6 py-4 text-right">Diferencia Arqueo</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-300">
                  {cashHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">No hay turnos cerrados registrados.</td>
                    </tr>
                  ) : (
                    cashHistory.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/10">
                        <td className="px-6 py-3 font-semibold">Turno #{c.id}</td>
                        <td className="px-6 py-3">{c.user.username}</td>
                        <td className="px-6 py-3">
                          <div>A: {new Date(c.fechaApertura).toLocaleString()}</div>
                          {c.fechaCierre && <div>C: {new Date(c.fechaCierre).toLocaleString()}</div>}
                        </td>
                        <td className="px-6 py-3 font-mono">${parseFloat(c.montoInicial).toFixed(2)}</td>
                        <td className="px-6 py-3 font-mono">${parseFloat(c.ventasEfectivo).toFixed(2)}</td>
                        <td className="px-6 py-3 font-mono">
                          {c.totalContado ? `$${parseFloat(c.totalContado).toFixed(2)}` : '-'}
                        </td>
                        <td className={`px-6 py-3 font-bold text-right font-mono ${c.diferencia === null ? '' : (parseFloat(c.diferencia) >= 0 ? 'text-emerald-600' : 'text-red-500')}`}>
                          {c.diferencia === null ? 'Abierto' : `$${parseFloat(c.diferencia).toFixed(2)}`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* MODAL DE DEVOLUCIONES PARCIALES */}
      {returnSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setReturnSale(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-1 text-red-500 flex items-center gap-2">
              <Archive size={20} /> Devolución de Artículos
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Folio Venta: {returnSale.folio}</p>
            
            {returnError && <div className="p-2 mb-3 bg-red-500/10 text-red-500 text-xs rounded border border-red-500/20">{returnError}</div>}
            
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div className="max-h-60 overflow-y-auto divide-y border rounded-xl bg-muted/10 p-2">
                {returnSale.items.map((item: any) => {
                  const qtyAvailable = item.cantidad - (item.cantidadDevuelta || 0);
                  const currentQty = returnQtys[item.id] || 0;
                  
                  if (qtyAvailable <= 0) return null;

                  return (
                    <div key={item.id} className="py-2 flex justify-between items-center text-sm">
                      <div className="flex-1">
                        <span className="font-semibold block">{item.nombre}</span>
                        <span className="text-[10px] text-muted-foreground">Disponible para devolver: {qtyAvailable}</span>
                      </div>
                      <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                        <button 
                          type="button"
                          onClick={() => setReturnQtys(prev => ({ ...prev, [item.id]: Math.max(0, currentQty - 1) }))}
                          className="px-3 py-1 hover:bg-accent text-xs font-bold"
                        >-</button>
                        <span className="px-3 text-xs font-bold font-mono">{currentQty}</span>
                        <button 
                          type="button"
                          onClick={() => setReturnQtys(prev => ({ ...prev, [item.id]: Math.min(qtyAvailable, currentQty + 1) }))}
                          className="px-3 py-1 hover:bg-accent text-xs font-bold"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20"
              >
                Procesar Devolución
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
