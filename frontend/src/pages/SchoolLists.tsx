import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../store/cartStore';
import { 
  GraduationCap, 
  School, 
  Layers, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShoppingCart,
  HelpCircle,
  Edit3,
  Trash2,
  Plus
} from 'lucide-react';

interface SchoolItem {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
}

interface GradeItem {
  id: number;
  schoolId: number;
  grado: string;
  grupo: string;
  cicloEscolar: string;
  schoolLists: { id: number; activo: boolean }[];
}

interface ListValidatedItem {
  listItemId: number;
  productId: number;
  nombre: string;
  codigoBarras: string | null;
  sku: string | null;
  precio: number;
  stock: number;
  cantidadRequerida: number;
  observaciones: string | null;
  estatus: 'DISPONIBLE' | 'INSUFICIENTE' | 'AGOTADO';
  sustitutos: {
    id: number;
    nombre: string;
    precio: number;
    stock: number;
    codigoBarras: string | null;
    sku: string | null;
  }[];
}

interface ValidatedListResponse {
  listaId: number;
  escuela: string;
  grado: string;
  grupo: string;
  cicloEscolar: string;
  items: ListValidatedItem[];
}

interface SchoolListsProps {
  onNavigateToPOS: () => void;
}

export default function SchoolLists({ onNavigateToPOS }: SchoolListsProps) {
  const queryClient = useQueryClient();
  const addItemToCart = useCartStore(state => state.addItem);

  // Estados de Selección
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [activeListId, setActiveListId] = useState<number | null>(null);

  // Modales de creación rápida
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [newGradeVal, setNewGradeVal] = useState('1º');
  const [newGroupVal, setNewGroupVal] = useState('A');
  const [newCicloVal, setNewCicloVal] = useState('2025-2026');

  // Editar artículos de la lista
  const [showEditItems, setShowEditItems] = useState(false);
  const [selectedProdForAdd, setSelectedProdForAdd] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addObs, setAddObs] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Buffer local para reemplazos temporales antes de mandar al carrito
  // Estructura: { [listItemId]: productToUse }
  const [selectedReplacements, setSelectedReplacements] = useState<Record<number, any>>({});

  // Consultar Escuelas
  const { data: schools = [] } = useQuery<SchoolItem[]>({
    queryKey: ['schools'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/school-lists/schools');
      return res.json();
    }
  });

  // Consultar Grados de la Escuela seleccionada
  const { data: grades = [] } = useQuery<GradeItem[]>({
    queryKey: ['grades', selectedSchoolId],
    queryFn: async () => {
      if (!selectedSchoolId) return [];
      const res = await fetch(`http://localhost:3001/api/school-lists/schools/${selectedSchoolId}/grades`);
      return res.json();
    },
    enabled: !!selectedSchoolId
  });

  // Cargar y Validar Lista Escolar seleccionada
  const { data: listData, isLoading: loadingList } = useQuery<ValidatedListResponse>({
    queryKey: ['schoolListValidation', activeListId],
    queryFn: async () => {
      if (!activeListId) return null;
      const res = await fetch(`http://localhost:3001/api/school-lists/lists/${activeListId}/load-and-validate`);
      return res.json();
    },
    enabled: !!activeListId
  });

  // Consultar todos los productos para poder agregarlos
  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ['allProductsForListEdit'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/products');
      if (!res.ok) throw new Error('Error al obtener productos');
      return res.json();
    }
  });

  // Mutación: Agregar/actualizar item en la lista
  const addListItemMutation = useMutation({
    mutationFn: async (payload: { listId: number; productId: number; cantidad: number; observaciones?: string | null }) => {
      const res = await fetch('http://localhost:3001/api/school-lists/lists/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al agregar el útil escolar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schoolListValidation', activeListId] });
      setSelectedProdForAdd('');
      setAddQty('1');
      setAddObs('');
    }
  });

  // Mutación: Eliminar item de la lista
  const deleteListItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(`http://localhost:3001/api/school-lists/lists/items/${itemId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Error al eliminar el útil escolar');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schoolListValidation', activeListId] });
    }
  });

  // Mutación: Crear Escuela
  const createSchoolMutation = useMutation({
    mutationFn: async (nombre: string) => {
      const res = await fetch('http://localhost:3001/api/school-lists/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setNewSchoolName('');
      setShowAddSchool(false);
    }
  });

  // Mutación: Crear Grado y crear Lista Escolar asociada
  const createGradeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const resGrade = await fetch('http://localhost:3001/api/school-lists/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const gradeData = await resGrade.json();

      // Autocrear la lista vacía asignada a este grado
      await fetch('http://localhost:3001/api/school-lists/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId: gradeData.id })
      });

      return gradeData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades', selectedSchoolId] });
      setShowAddGrade(false);
    }
  });

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchoolId(e.target.value);
    setSelectedGradeId('');
    setActiveListId(null);
    setSelectedReplacements({});
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedGradeId(val);
    setSelectedReplacements({});

    const matchedGrade = grades.find(g => g.id === parseInt(val));
    if (matchedGrade && matchedGrade.schoolLists.length > 0) {
      setActiveListId(matchedGrade.schoolLists[0].id);
    } else {
      setActiveListId(null);
    }
  };

  // Reemplazar un producto por su sustituto sugerido
  const handleSelectSubstitute = (listItemId: number, sub: any) => {
    setSelectedReplacements(prev => ({
      ...prev,
      [listItemId]: {
        productId: sub.id,
        nombre: sub.nombre,
        precio: sub.precio,
        stock: sub.stock,
        unidad: 'pza'
      }
    }));
  };

  // Restablecer el artículo original
  const handleResetToOriginal = (listItemId: number) => {
    const updated = { ...selectedReplacements };
    delete updated[listItemId];
    setSelectedReplacements(updated);
  };

  // Cargar todos los elementos validados/sustituidos al Carrito del POS
  const handleAddAllToCart = () => {
    if (!listData) return;

    let itemsAddedCount = 0;

    listData.items.forEach(item => {
      // Si hay un reemplazo activo para este renglón, usar el sustituto
      const replacement = selectedReplacements[item.listItemId];
      
      if (replacement) {
        addItemToCart({
          productId: replacement.productId,
          nombre: replacement.nombre,
          precio: replacement.precio,
          stock: replacement.stock,
          unidad: replacement.unidad
        }, item.cantidadRequerida);
        itemsAddedCount++;
      } else {
        // De lo contrario, usar el original si está disponible (o si deciden agregarlo aun insuficiente)
        addItemToCart({
          productId: item.productId,
          nombre: item.nombre,
          precio: item.precio,
          stock: item.stock,
          unidad: 'pza'
        }, item.cantidadRequerida);
        itemsAddedCount++;
      }
    });

    alert(`Se agregaron exitosamente ${itemsAddedCount} artículos de la lista escolar al carrito de ventas.`);
    onNavigateToPOS(); // Redirigir a POS
  };

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full">
      {/* Encabezado */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Listas Escolares</h1>
          <p className="text-muted-foreground text-sm">Validación inteligente de útiles y sugerencias de surtido rápido</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddSchool(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl hover:bg-accent text-xs font-semibold"
          >
            <School size={14} /> Registrar Escuela
          </button>
          
          <button
            onClick={() => {
              if (!selectedSchoolId) {
                alert('Selecciona una escuela primero.');
                return;
              }
              setShowAddGrade(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-xl hover:bg-accent text-xs font-semibold"
          >
            <Layers size={14} /> Registrar Lista/Grado
          </button>
        </div>
      </div>

      {/* Selectores de Selección de Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-2xl bg-card shrink-0">
        {/* Escuela */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <School size={14} /> 1. Escuela de procedencia
          </label>
          <select
            className="px-4 py-2.5 border rounded-xl bg-background text-sm font-semibold focus:outline-none"
            value={selectedSchoolId}
            onChange={handleSchoolChange}
          >
            <option value="">-- Seleccionar Escuela --</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        {/* Grado / Grupo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Layers size={14} /> 2. Grado / Grupo / Lista Escolar
          </label>
          <select
            className="px-4 py-2.5 border rounded-xl bg-background text-sm font-semibold focus:outline-none"
            value={selectedGradeId}
            onChange={handleGradeChange}
            disabled={!selectedSchoolId}
          >
            <option value="">-- Seleccionar Lista --</option>
            {grades.map(g => (
              <option key={g.id} value={g.id}>{g.grado} Grado - Grupo "{g.grupo}" ({g.cicloEscolar})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cuerpo principal de validación de útiles */}
      <div className="flex-1 border rounded-2xl overflow-hidden bg-card flex flex-col">
        {loadingList ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground animate-pulse py-20">
            Validando existencias de la lista en base de datos...
          </div>
        ) : !listData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20 space-y-3">
            <GraduationCap size={48} className="stroke-[1.2] text-slate-400" />
            <p className="text-sm font-semibold text-center">Selecciona una escuela y lista escolar para validar el stock físico.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Cabecera Info de Lista */}
            <div className="bg-muted/30 p-4 border-b flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <BookOpen size={16} className="text-blue-500" /> 
                  Surtido: {listData.escuela} - {listData.grado}º "{listData.grupo}"
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ciclo Escolar: {listData.cicloEscolar} | Artículos: {listData.items.length}</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditItems(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border rounded-xl hover:bg-accent text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <Edit3 size={13} />
                  Editar Lista
                </button>

                <button
                  onClick={handleAddAllToCart}
                  disabled={listData.items.length === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  <ShoppingCart size={14} />
                  Cargar Lista al Carrito
                </button>
              </div>
            </div>

            {/* Listado de Artículos con Alertas e Intercambio */}
            <div className="flex-1 overflow-y-auto divide-y">
              {listData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
                  <BookOpen size={40} className="stroke-[1.5]" />
                  <p className="text-sm font-semibold">Esta lista escolar está vacía.</p>
                  <button
                    type="button"
                    onClick={() => setShowEditItems(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <Plus size={14} /> Agregar Artículos
                  </button>
                </div>
              ) : (
                listData.items.map(item => {
                // Revisar si este renglón está siendo reemplazado por un sustituto
                const replacement = selectedReplacements[item.listItemId];
                
                // Si hay reemplazo, los datos activos cambian
                const activeProdName = replacement ? replacement.nombre : item.nombre;
                const activeProdStock = replacement ? replacement.stock : item.stock;
                const activeProdPrice = replacement ? replacement.precio : item.precio;

                // El estatus activo depende del stock del producto seleccionado
                let activeStatus = item.estatus;
                if (replacement) {
                  activeStatus = replacement.stock >= item.cantidadRequerida ? 'DISPONIBLE' : 'INSUFICIENTE';
                }

                return (
                  <div key={item.listItemId} className="p-4 flex flex-col space-y-3 hover:bg-muted/10 transition-colors">
                    
                    {/* Fila principal del artículo */}
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{activeProdName}</span>
                          {replacement && (
                            <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full">
                              Sustituido
                            </span>
                          )}
                        </div>
                        {item.observaciones && (
                          <span className="text-xs text-muted-foreground block mt-0.5 italic">Obs: {item.observaciones}</span>
                        )}
                      </div>

                      {/* Info de stock requerido / disponible */}
                      <div className="flex items-center gap-6 text-xs text-right">
                        <div>
                          <span className="text-muted-foreground block">Requerido:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.cantidadRequerida} pzas</span>
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground block">Stock Físico:</span>
                          <span className={`font-bold ${activeProdStock <= 0 ? 'text-red-500' : (activeProdStock < item.cantidadRequerida ? 'text-amber-500' : 'text-emerald-500')}`}>
                            {activeProdStock} uds
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground block">Unitario:</span>
                          <span className="font-bold">${activeProdPrice.toFixed(2)}</span>
                        </div>

                        {/* Indicador Visual del Estatus */}
                        <div className="w-28 flex justify-end">
                          {activeStatus === 'DISPONIBLE' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} /> Listo
                            </span>
                          )}
                          {activeStatus === 'INSUFICIENTE' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={12} /> Insuficiente
                            </span>
                          )}
                          {activeStatus === 'AGOTADO' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                              <XCircle size={12} /> Agotado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fila secundaria: Bloque de sustitutos si falta stock */}
                    {item.estatus !== 'DISPONIBLE' && item.sustitutos.length > 0 && (
                      <div className="bg-slate-500/5 p-3 rounded-xl flex flex-col gap-2 border border-slate-700/5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <HelpCircle size={12} /> Opciones de reemplazo recomendadas (mismo rubro):
                        </span>
                        
                        <div className="flex gap-2 flex-wrap">
                          {item.sustitutos.map(sub => {
                            const isCurrentlySelected = replacement?.productId === sub.id;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => handleSelectSubstitute(item.listItemId, sub)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${isCurrentlySelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-background hover:bg-accent text-slate-700 dark:text-slate-300'}`}
                              >
                                {sub.nombre}
                                <span className={`text-[10px] font-bold ${isCurrentlySelected ? 'text-white' : 'text-blue-500'}`}>
                                  ${sub.precio.toFixed(2)} (Stock: {sub.stock})
                                </span>
                              </button>
                            );
                          })}

                          {replacement && (
                            <button
                              onClick={() => handleResetToOriginal(item.listItemId)}
                              className="px-2 py-1 text-xs text-red-500 hover:underline font-bold transition-all"
                            >
                              Restablecer original
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>

          </div>
        )}
      </div>

      {/* MODAL: AGREGAR ESCUELA */}
      {showAddSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-3">Registrar Nueva Escuela</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newSchoolName.trim()) {
                  createSchoolMutation.mutate(newSchoolName.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre de la Escuela</label>
                <input
                  type="text"
                  placeholder="Ej: Primaria Benito Juárez"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSchool(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createSchoolMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  {createSchoolMutation.isPending ? 'Guardando...' : 'Guardar Escuela'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR GRADO / LISTA */}
      {showAddGrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-3">Crear Lista por Grado/Grupo</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createGradeMutation.mutate({
                  schoolId: parseInt(selectedSchoolId),
                  grado: newGradeVal,
                  grupo: newGroupVal,
                  cicloEscolar: newCicloVal
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Grado</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={newGradeVal}
                  onChange={(e) => setNewGradeVal(e.target.value)}
                  placeholder="Ej: 1º, 2º"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Grupo</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={newGroupVal}
                  onChange={(e) => setNewGroupVal(e.target.value)}
                  placeholder="Ej: A, B"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Ciclo Escolar</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={newCicloVal}
                  onChange={(e) => setNewCicloVal(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGrade(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createGradeMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  {createGradeMutation.isPending ? 'Creando...' : 'Crear Lista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR ARTÍCULOS DE LA LISTA */}
      {showEditItems && listData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <h2 className="text-xl font-bold font-outfit">
                Editar Artículos: {listData.escuela} - {listData.grado}º "{listData.grupo}"
              </h2>
              <button
                type="button"
                onClick={() => setShowEditItems(false)}
                className="text-slate-500 hover:text-slate-700 text-sm font-bold"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* SECCIÓN 1: AGREGAR PRODUCTO */}
            <div className="bg-slate-500/5 p-4 rounded-xl border border-slate-700/5 mb-4 shrink-0 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block uppercase">
                Añadir producto a la lista
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                {/* Selector de Producto */}
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Seleccionar Producto</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código..."
                      className="w-full px-3 py-1.5 border rounded-lg bg-background text-xs mb-1 focus:outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select
                      className="w-full px-3 py-2 border rounded-lg bg-background text-xs font-semibold focus:outline-none"
                      value={selectedProdForAdd}
                      onChange={(e) => setSelectedProdForAdd(e.target.value)}
                    >
                      <option value="">-- Seleccionar --</option>
                      {allProducts
                        .filter(p => p.activo && (
                          p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.codigoBarras && p.codigoBarras.includes(searchTerm))
                        ))
                        .map(p => (
                          <option key={p.id} value={p.id.toString()}>
                            {p.nombre} (SKU: {p.sku || 'N/A'}) - ${parseFloat(p.precioVenta).toFixed(2)}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                {/* Cantidad y Observación */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-xs font-bold text-center"
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Observación</label>
                    <input
                      type="text"
                      placeholder="Ej: Rojo"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-xs"
                      value={addObs}
                      onChange={(e) => setAddObs(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedProdForAdd) {
                      alert('Selecciona un producto primero.');
                      return;
                    }
                    addListItemMutation.mutate({
                      listId: listData.listaId,
                      productId: parseInt(selectedProdForAdd),
                      cantidad: parseInt(addQty),
                      observaciones: addObs
                    });
                  }}
                  disabled={addListItemMutation.isPending}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/10"
                >
                  {addListItemMutation.isPending ? 'Agregando...' : 'Añadir a la Lista'}
                </button>
              </div>
            </div>

            {/* SECCIÓN 2: LISTA DE PRODUCTOS ACTUALES */}
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 block uppercase shrink-0">
              Productos en la lista escolar ({listData.items.length})
            </span>

            <div className="flex-1 overflow-y-auto border rounded-xl divide-y bg-background">
              {listData.items.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Esta lista no tiene productos. Agrega algunos utilizando el buscador superior.
                </div>
              ) : (
                listData.items.map((item) => (
                  <div key={item.listItemId} className="p-3 flex justify-between items-center text-xs">
                    <div className="space-y-0.5 flex-1 pr-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.nombre}</span>
                      {item.observaciones && (
                        <span className="text-[10px] text-muted-foreground block italic">Obs: {item.observaciones}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Cantidad:</span>
                        <input
                          type="number"
                          min="1"
                          className="w-12 px-1.5 py-0.5 border rounded bg-background text-center font-bold text-xs"
                          value={item.cantidadRequerida}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value);
                            if (newQty > 0) {
                              addListItemMutation.mutate({
                                listId: listData.listaId,
                                productId: item.productId,
                                cantidad: newQty,
                                observaciones: item.observaciones
                              });
                            }
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar ${item.nombre} de esta lista?`)) {
                            deleteListItemMutation.mutate(item.listItemId);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 border rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Eliminar de la lista"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
