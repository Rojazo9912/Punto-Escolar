import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../store/sessionStore';
import { PackageOpen, Truck, Plus, Save, X, Search, AlertTriangle, FileDown } from 'lucide-react';

export default function Purchases() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore(state => state.user);
  
  const [activeTab, setActiveTab] = useState<'compras' | 'proveedores' | 'stockBajo'>('compras');

  // --- QUERIES ---
  const { data: suppliers = [], isLoading: loadSuppliers } = useQuery<any[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/suppliers');
      return res.json();
    }
  });

  const { data: purchases = [], isLoading: loadPurchases } = useQuery<any[]>({
    queryKey: ['purchases'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/purchases');
      return res.json();
    }
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['productsForPurchase'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/products');
      return res.json();
    }
  });

  const { data: lowStockProducts = [] } = useQuery<any[]>({
    queryKey: ['lowStockProducts'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/products/low-stock');
      return res.json();
    }
  });

  const handleDownloadLowStockPdf = () => {
    window.open('http://localhost:3001/api/reports/inventory/pdf', '_blank');
  };

  // --- ESTADOS PROVEEDOR ---
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supForm, setSupForm] = useState({ nombre: '', contacto: '', telefono: '', rfc: '' });

  const createSupplierMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('http://localhost:3001/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Error al crear proveedor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setShowSupplierModal(false);
      setSupForm({ nombre: '', contacto: '', telefono: '', rfc: '' });
    }
  });

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    createSupplierMut.mutate(supForm);
  };

  // --- ESTADOS COMPRA ---
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ supplierId: '' });
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const createPurchaseMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('http://localhost:3001/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Error al registrar compra');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setShowPurchaseModal(false);
      setPurchaseItems([]);
      setPurchaseForm({ supplierId: '' });
      alert('Compra registrada y stock actualizado con éxito.');
    }
  });

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.supplierId) return alert('Selecciona un proveedor');
    if (purchaseItems.length === 0) return alert('Añade al menos un producto');
    createPurchaseMut.mutate({
      supplierId: parseInt(purchaseForm.supplierId),
      userId: currentUser?.id,
      items: purchaseItems
    });
  };

  const addProductToPurchase = (prod: any) => {
    const exists = purchaseItems.find(i => i.productId === prod.id);
    if (exists) {
      setPurchaseItems(purchaseItems.map(i => i.productId === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i));
    } else {
      setPurchaseItems([...purchaseItems, { productId: prod.id, nombre: prod.nombre, cantidad: 1, costoUnitario: prod.precioCompra }]);
    }
  };

  const updatePurchaseItem = (id: number, field: string, val: string) => {
    setPurchaseItems(purchaseItems.map(i => {
      if (i.productId === id) {
        return { ...i, [field]: parseFloat(val) || 0 };
      }
      return i;
    }));
  };

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full overflow-y-auto">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Compras y Proveedores</h1>
          <p className="text-muted-foreground text-sm">Registra la llegada de mercancía para actualizar stock y costos</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b shrink-0">
        <button
          onClick={() => setActiveTab('compras')}
          className={`pb-2 px-4 font-bold text-sm border-b-2 transition-all ${activeTab === 'compras' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <PackageOpen className="inline-block mr-2" size={16} /> Historial de Compras
        </button>
        <button
          onClick={() => setActiveTab('proveedores')}
          className={`pb-2 px-4 font-bold text-sm border-b-2 transition-all ${activeTab === 'proveedores' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Truck className="inline-block mr-2" size={16} /> Proveedores
        </button>
        <button
          onClick={() => setActiveTab('stockBajo')}
          className={`pb-2 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-1 ${activeTab === 'stockBajo' ? 'border-red-500 text-red-500' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <AlertTriangle size={16} />
          Sugerencia de Resurtido
          {lowStockProducts.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {lowStockProducts.length}
            </span>
          )}
        </button>
      </div>

      {/* CONTENIDO TABS */}
      <div className="flex-1 overflow-y-auto bg-card border rounded-2xl p-4">
        {activeTab === 'compras' && (
          <div className="space-y-4">
            <button onClick={() => setShowPurchaseModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20">
              <Plus size={16} /> Registrar Nueva Compra
            </button>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">Folio</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {purchases.map((p: any) => (
                    <tr key={p.id}>
                      <td className="p-3 font-bold">{p.folio}</td>
                      <td className="p-3">{new Date(p.fecha).toLocaleDateString()}</td>
                      <td className="p-3">{p.supplier?.nombre}</td>
                      <td className="p-3">{p.user?.username}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">${parseFloat(p.total).toFixed(2)}</td>
                    </tr>
                  ))}
                  {purchases.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No hay compras registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'proveedores' && (
          <div className="space-y-4">
            <button onClick={() => setShowSupplierModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20">
              <Plus size={16} /> Nuevo Proveedor
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((s: any) => (
                <div key={s.id} className="border p-4 rounded-xl flex flex-col gap-1 shadow-sm">
                  <h3 className="font-bold text-lg">{s.nombre}</h3>
                  <span className="text-xs text-muted-foreground">Contacto: {s.contacto || '-'}</span>
                  <span className="text-xs text-muted-foreground">Tel: {s.telefono || '-'}</span>
                  <span className="text-xs text-muted-foreground">RFC: {s.rfc || '-'}</span>
                </div>
              ))}
              {suppliers.length === 0 && <p className="text-sm text-muted-foreground">No hay proveedores registrados.</p>}
            </div>
          </div>
        )}

        {activeTab === 'stockBajo' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-base flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={18} />
                  Productos que necesitan resurtido
                </h2>
                <p className="text-xs text-muted-foreground">Artículos con stock igual o menor al mínimo configurado.</p>
              </div>
              <button
                onClick={handleDownloadLowStockPdf}
                disabled={lowStockProducts.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/20"
              >
                <FileDown size={16} /> Descargar PDF de Faltantes
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500">
                  <AlertTriangle size={32} />
                </div>
                <p className="font-bold text-emerald-600">¡Inventario en orden!</p>
                <p className="text-sm text-muted-foreground">Todos los productos tienen stock por encima del mínimo configurado.</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-red-500/5">
                    <tr>
                      <th className="p-3 font-bold text-red-600">Producto</th>
                      <th className="p-3 font-bold text-red-600">Categoría</th>
                      <th className="p-3 font-bold text-red-600 text-center">Stock Actual</th>
                      <th className="p-3 font-bold text-red-600 text-center">Mínimo</th>
                      <th className="p-3 font-bold text-red-600 text-center">Faltan</th>
                      <th className="p-3 font-bold text-red-600 text-right">Costo Unitario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lowStockProducts.map((p: any) => {
                      const faltan = Math.max(0, Number(p.stockMinimo) - Number(p.stock));
                      return (
                        <tr key={p.id} className={`hover:bg-muted/5 ${Number(p.stock) === 0 ? 'bg-red-500/5' : ''}`}>
                          <td className="p-3 font-semibold">{p.nombre}</td>
                          <td className="p-3 text-muted-foreground">{p.categoria || '-'}</td>
                          <td className="p-3 text-center">
                            <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${Number(p.stock) === 0 ? 'bg-red-500 text-white' : 'bg-orange-500/10 text-orange-600'}`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="p-3 text-center text-muted-foreground">{p.stockMinimo}</td>
                          <td className="p-3 text-center font-bold text-red-500">+{faltan}</td>
                          <td className="p-3 text-right font-mono text-muted-foreground">${parseFloat(p.precioCompra).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL NUEVO PROVEEDOR */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-card border rounded-2xl p-6 relative">
            <button onClick={() => setShowSupplierModal(false)} className="absolute right-4 top-4 text-muted-foreground"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Truck className="text-blue-500"/> Registrar Proveedor</h2>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <input type="text" placeholder="Nombre (Ej. Office Depot)" className="w-full p-2 border rounded-lg" value={supForm.nombre} onChange={e => setSupForm({...supForm, nombre: e.target.value})} required />
              <input type="text" placeholder="Contacto (Ej. Juan Pérez)" className="w-full p-2 border rounded-lg" value={supForm.contacto} onChange={e => setSupForm({...supForm, contacto: e.target.value})} />
              <input type="text" placeholder="Teléfono" className="w-full p-2 border rounded-lg" value={supForm.telefono} onChange={e => setSupForm({...supForm, telefono: e.target.value})} />
              <input type="text" placeholder="RFC" className="w-full p-2 border rounded-lg" value={supForm.rfc} onChange={e => setSupForm({...supForm, rfc: e.target.value})} />
              <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-lg font-bold">Guardar Proveedor</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA COMPRA */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl bg-card border rounded-2xl p-6 relative h-[80vh] flex flex-col">
            <button onClick={() => setShowPurchaseModal(false)} className="absolute right-4 top-4 text-muted-foreground"><X size={20}/></button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><PackageOpen className="text-blue-500"/> Registro de Entrada de Mercancía</h2>
            
            <div className="flex gap-4 mb-4">
              <select className="flex-1 p-2 border rounded-lg font-bold" value={purchaseForm.supplierId} onChange={e => setPurchaseForm({ supplierId: e.target.value })}>
                <option value="">Selecciona Proveedor...</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
              {/* Buscador de productos */}
              <div className="w-1/2 flex flex-col border rounded-xl overflow-hidden">
                <div className="p-2 border-b bg-muted/20">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 text-muted-foreground" size={16} />
                    <input type="text" placeholder="Buscar producto..." className="w-full pl-8 p-2 border rounded-lg text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y">
                  {products.filter((p: any) => p.nombre.toLowerCase().includes(searchTerm.toLowerCase())).slice(0,50).map((p: any) => (
                    <div key={p.id} className="p-2 flex justify-between items-center hover:bg-muted/10">
                      <div>
                        <div className="font-bold text-sm">{p.nombre}</div>
                        <div className="text-[10px] text-muted-foreground">Stock: {p.stock} | Costo actual: ${parseFloat(p.precioCompra).toFixed(2)}</div>
                      </div>
                      <button onClick={() => addProductToPurchase(p)} className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded font-bold text-xs"><Plus size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items a comprar */}
              <div className="w-1/2 flex flex-col border rounded-xl overflow-hidden bg-muted/5">
                <div className="p-2 border-b font-bold text-sm flex justify-between">
                  <span>Productos a Ingresar</span>
                  <span className="text-blue-600">Total: ${purchaseItems.reduce((acc, i) => acc + (i.cantidad * i.costoUnitario), 0).toFixed(2)}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {purchaseItems.map(item => (
                    <div key={item.productId} className="border bg-card p-2 rounded-lg text-sm shadow-sm flex flex-col gap-2">
                      <div className="font-bold flex justify-between">
                        <span>{item.nombre}</span>
                        <button onClick={() => setPurchaseItems(purchaseItems.filter(i => i.productId !== item.productId))} className="text-red-500"><X size={14}/></button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground block">Cantidad</label>
                          <input type="number" className="w-full p-1 border rounded" value={item.cantidad} onChange={e => updatePurchaseItem(item.productId, 'cantidad', e.target.value)} />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground block">Costo Unitario ($)</label>
                          <input type="number" step="0.01" className="w-full p-1 border rounded" value={item.costoUnitario} onChange={e => updatePurchaseItem(item.productId, 'costoUnitario', e.target.value)} />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground block">Subtotal</label>
                          <div className="p-1 font-bold font-mono text-right">${(item.cantidad * item.costoUnitario).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t">
                  <button onClick={handleCreatePurchase} disabled={createPurchaseMut.isPending} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex justify-center items-center gap-2">
                    <Save size={16} /> Procesar Entrada y Actualizar Costos
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
