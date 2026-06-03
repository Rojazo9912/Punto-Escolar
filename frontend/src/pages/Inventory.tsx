import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../store/sessionStore';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Sliders, 
  Upload, 
  Download, 
  Search, 
  FolderPlus,
  AlertCircle
} from 'lucide-react';

interface Product {
  id: number;
  nombre: string;
  codigoBarras: string | null;
  sku: string | null;
  descripcion: string | null;
  categoryId: number;
  marca: string | null;
  precioCompra: string;
  precioVenta: string;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  category: { name: string };
}

interface Category {
  id: number;
  name: string;
  active: boolean;
}

export default function Inventory() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore(state => state.user);
  const hasPermission = useSessionStore(state => state.hasPermission);

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');

  // Estados de Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [showStockModal, setShowStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockType, setStockType] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
  const [stockQty, setStockQty] = useState(1);
  const [stockReason, setStockReason] = useState('');
  const [stockError, setStockError] = useState('');

  // Formulario Producto
  const [prodForm, setProdForm] = useState({
    nombre: '',
    codigoBarras: '',
    sku: '',
    descripcion: '',
    categoryId: '',
    marca: '',
    precioCompra: '',
    precioVenta: '',
    stock: '0',
    stockMinimo: '5'
  });

  // Consultar Productos
  const { data: products = [], isLoading: loadingProds } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/products');
      if (!res.ok) throw new Error('Error al obtener productos');
      return res.json();
    }
  });

  // Consultar Categorías
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/products/categories');
      if (!res.ok) throw new Error('Error al obtener categorías');
      return res.json();
    }
  });

  // Mutación: Crear/Editar Producto
  const saveProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingProduct;
      const url = isEdit ? `http://localhost:3001/api/products/${editingProduct.id}` : 'http://localhost:3001/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, userId: currentUser?.id })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar producto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setShowProductModal(false);
      setEditingProduct(null);
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  // Mutación: Ajustar Stock
  const adjustStockMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('http://localhost:3001/api/products/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, userId: currentUser?.id })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al ajustar inventario');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setShowStockModal(false);
      setStockProduct(null);
      setStockReason('');
      setStockQty(1);
    },
    onError: (err: any) => {
      setStockError(err.message);
    }
  });

  // Mutación: Duplicar Producto
  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`http://localhost:3001/api/products/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      if (!res.ok) throw new Error('Error al duplicar producto');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Mutación: Eliminar Producto
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`http://localhost:3001/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      if (!res.ok) throw new Error('Error al desactivar el producto');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Mutación: Crear Categoría
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('http://localhost:3001/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, userId: currentUser?.id })
      });
      if (!res.ok) throw new Error('La categoría ya existe');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewCategoryName('');
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  const handleOpenAdd = () => {
    if (!hasPermission('crear_editar_productos')) {
      alert('No tienes permisos para agregar productos.');
      return;
    }
    setEditingProduct(null);
    setProdForm({
      nombre: '',
      codigoBarras: '',
      sku: '',
      descripcion: '',
      categoryId: categories[0]?.id.toString() || '',
      marca: '',
      precioCompra: '',
      precioVenta: '',
      stock: '0',
      stockMinimo: '5'
    });
    setShowProductModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    if (!hasPermission('crear_editar_productos')) {
      alert('No tienes permisos para modificar productos.');
      return;
    }
    setEditingProduct(p);
    setProdForm({
      nombre: p.nombre,
      codigoBarras: p.codigoBarras || '',
      sku: p.sku || '',
      descripcion: p.descripcion || '',
      categoryId: p.categoryId.toString(),
      marca: p.marca || '',
      precioCompra: parseFloat(p.precioCompra).toString(),
      precioVenta: parseFloat(p.precioVenta).toString(),
      stock: p.stock.toString(),
      stockMinimo: p.stockMinimo.toString()
    });
    setShowProductModal(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveProductMutation.mutate(prodForm);
  };

  const handleStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStockError('');
    if (!stockProduct) return;
    
    adjustStockMutation.mutate({
      productId: stockProduct.id,
      tipo: stockType,
      cantidad: stockQty,
      motivo: stockReason || `Ajuste manual de stock por el usuario`
    });
  };

  // Importador de Excel nativo local
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasPermission('crear_editar_productos')) {
      alert('No tienes permisos para importar productos.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    // En Electron, file tiene la propiedad 'path' nativa del sistema
    const nativePath = (file as any).path;
    if (!nativePath) {
      alert('Esta función requiere ejecutarse en la aplicación de escritorio.');
      return;
    }

    if (!confirm(`¿Deseas importar los productos desde el archivo: ${file.name}?`)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/products/excel/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: nativePath, userId: currentUser?.id })
      });
      const resData = await response.json();
      if (!response.ok) {
        alert(resData.error || 'Error al procesar la carga masiva.');
      } else {
        alert(`Importación completada. Registros procesados: ${resData.importados}`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    } catch (err) {
      alert('Error de red al importar plantilla.');
    }
  };

  // Filtrado de productos en frontend
  const filteredProducts = products.filter(p => {
    const matchSearch = search === '' || 
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigoBarras?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    
    const matchCat = selectedCat === '' || p.categoryId === parseInt(selectedCat);
    
    return p.activo && matchSearch && matchCat;
  });

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full">
      {/* Cabecera e Importes/Exportes */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Inventario de Productos</h1>
          <p className="text-muted-foreground text-sm">Control y ajustes de existencias en tiempo real</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Botón Categorías */}
          <button
            onClick={() => {
              if (!hasPermission('crear_editar_productos')) {
                alert('No tienes permisos para gestionar categorías.');
                return;
              }
              setShowCategoryModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-accent text-sm font-semibold transition-all"
          >
            <FolderPlus size={16} />
            Categorías
          </button>
          
          {/* Importar Excel */}
          <label className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-accent text-sm font-semibold cursor-pointer transition-all">
            <Upload size={16} />
            Cargar Excel
            <input
              type="file"
              accept=".xlsx"
              onChange={handleExcelImport}
              className="hidden"
            />
          </label>

          {/* Exportar Excel */}
          <a
            href="http://localhost:3001/api/products/excel/export"
            download
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/10 transition-all"
          >
            <Download size={16} />
            Exportar Excel
          </a>

          {/* Añadir Producto */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/10 transition-all"
          >
            <Plus size={16} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="flex gap-4 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Buscar por Nombre, Código de Barras o SKU..."
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
        >
          <option value="">Todas las Categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Tabla de Resultados */}
      <div className="flex-1 border rounded-2xl overflow-hidden bg-card flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-b sticky top-0 bg-card z-10">
              <tr>
                <th className="px-6 py-4">Nombre / Detalle</th>
                <th className="px-6 py-4">Código / SKU</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4">Marca</th>
                <th className="px-6 py-4">Compra / Venta</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {loadingProds ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground animate-pulse">Cargando catálogo...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron productos registrados.</td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLow = p.stock <= p.stockMinimo;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{p.nombre}</div>
                        {p.descripcion && <div className="text-xs text-muted-foreground truncate max-w-xs">{p.descripcion}</div>}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs">
                        <div>B: {p.codigoBarras || '-'}</div>
                        <div>S: {p.sku || '-'}</div>
                      </td>
                      <td className="px-6 py-3.5">{p.category?.name}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{p.marca || '-'}</td>
                      <td className="px-6 py-3.5">
                        {hasPermission('ver_utilidades') && (
                          <div className="text-xs text-muted-foreground">C: ${parseFloat(p.precioCompra).toFixed(2)}</div>
                        )}
                        <div className="font-bold text-blue-600 dark:text-blue-400">V: ${parseFloat(p.precioVenta).toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-0.5 rounded-full ${isLow ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                          {isLow && <AlertCircle size={12} />}
                          {p.stock}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Min: {p.stockMinimo}</div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex gap-2 justify-end">
                          {/* Ajuste Stock */}
                          <button
                            onClick={() => {
                              setStockProduct(p);
                              setStockError('');
                              setShowStockModal(true);
                            }}
                            title="Ajustar Stock"
                            className="p-1.5 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                          >
                            <Sliders size={14} />
                          </button>
                          {/* Duplicar */}
                          <button
                            onClick={() => {
                              if (!hasPermission('crear_editar_productos')) {
                                alert('No tienes permisos para duplicar productos.');
                                return;
                              }
                              if (confirm('¿Deseas duplicar este producto?')) {
                                duplicateMutation.mutate(p.id);
                              }
                            }}
                            title="Duplicar Producto"
                            className="p-1.5 border rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                          >
                            <Copy size={14} />
                          </button>
                          {/* Editar */}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Editar Producto"
                            className="p-1.5 border rounded-lg hover:bg-blue-500/10 hover:text-blue-500 text-slate-500"
                          >
                            <Edit3 size={14} />
                          </button>
                          {/* Eliminar */}
                          <button
                            onClick={() => {
                              if (!hasPermission('eliminar_productos')) {
                                alert('No tienes permisos para eliminar productos.');
                                return;
                              }
                              if (confirm('¿Deseas eliminar este producto del inventario? (No se borrará del historial de ventas antiguas)')) {
                                deleteMutation.mutate(p.id);
                              }
                            }}
                            title="Eliminar"
                            className="p-1.5 border rounded-lg hover:bg-red-500/10 hover:text-red-500 text-slate-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: PRODUCTO (NUEVO / EDITAR) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-4">
              {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
            </h2>
            
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre del Producto</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={prodForm.nombre}
                    onChange={(e) => setProdForm({ ...prodForm, nombre: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Código de Barras</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    placeholder="Escanear o ingresar"
                    value={prodForm.codigoBarras}
                    onChange={(e) => setProdForm({ ...prodForm, codigoBarras: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">SKU / Código Interno</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={prodForm.sku}
                    onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Categoría</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={prodForm.categoryId}
                    onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}
                    required
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Marca</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={prodForm.marca}
                    onChange={(e) => setProdForm({ ...prodForm, marca: e.target.value })}
                  />
                </div>

                {hasPermission('ver_utilidades') ? (
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-500">Precio Compra (Costo)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold"
                      value={prodForm.precioCompra}
                      onChange={(e) => setProdForm({ ...prodForm, precioCompra: e.target.value })}
                      required
                    />
                  </div>
                ) : (
                  <input type="hidden" value={prodForm.precioCompra || '0'} />
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Precio Venta</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold text-blue-600 dark:text-blue-400"
                    value={prodForm.precioVenta}
                    onChange={(e) => setProdForm({ ...prodForm, precioVenta: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Stock Inicial</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={prodForm.stock}
                    onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                    disabled={!!editingProduct} // Solo editable desde Ajustes de Stock si ya existe
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Stock Mínimo Alerta</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={prodForm.stockMinimo}
                    onChange={(e) => setProdForm({ ...prodForm, stockMinimo: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1 text-slate-500">Descripción</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                    value={prodForm.descripcion}
                    onChange={(e) => setProdForm({ ...prodForm, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveProductMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  {saveProductMutation.isPending ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTE DE STOCK */}
      {showStockModal && stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-2">Ajuste de Inventario</h2>
            <p className="text-xs text-muted-foreground mb-4">Producto: <span className="font-semibold text-foreground">{stockProduct.nombre}</span></p>

            {stockError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {stockError}
              </div>
            )}

            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Tipo de Movimiento</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={stockType}
                  onChange={(e: any) => setStockType(e.target.value)}
                >
                  <option value="ENTRADA">ENTRADA (Aumentar stock)</option>
                  <option value="SALIDA">SALIDA (Disminuir stock)</option>
                  <option value="AJUSTE">AJUSTE (Establecer stock fijo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Cantidad / Stock Fijo</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-bold"
                  value={stockQty}
                  onChange={(e) => setStockQty(parseInt(e.target.value || '1'))}
                  required
                />
                <div className="text-[10px] text-muted-foreground mt-1">Stock actual: {stockProduct.stock} unidades.</div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Motivo del Ajuste</label>
                <input
                  type="text"
                  placeholder="Ej: Compra a proveedor, producto dañado, etc."
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  {adjustStockMutation.isPending ? 'Procesando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CATEGORÍAS */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150 flex flex-col max-h-[500px]">
            <h2 className="text-xl font-bold font-outfit mb-3">Gestionar Categorías</h2>

            {/* Crear Categoría */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Nueva categoría..."
                className="flex-1 px-3 py-2 border rounded-lg bg-background text-sm"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button
                onClick={() => {
                  if (newCategoryName) createCategoryMutation.mutate(newCategoryName);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1"
              >
                <Plus size={16} /> Agregar
              </button>
            </div>

            {/* Listado */}
            <div className="overflow-y-auto flex-1 border rounded-xl divide-y bg-muted/10">
              {categories.map(c => (
                <div key={c.id} className="p-3 flex justify-between items-center text-sm">
                  <span>{c.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                    {c.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 shrink-0">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
