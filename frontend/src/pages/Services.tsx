import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../store/sessionStore';
import { 
  Calculator, 
  Plus, 
  Edit3, 
  Trash2, 
  Tag
} from 'lucide-react';

interface Service {
  id: number;
  nombre: string;
  precio: string;
  unidad: string;
  activo: boolean;
}

export default function Services() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore(state => state.user);

  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  const [form, setForm] = useState({
    nombre: '',
    precio: '',
    unidad: 'Servicio'
  });

  // Consultar Servicios
  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/services');
      if (!res.ok) throw new Error('Error al obtener servicios');
      return res.json();
    }
  });

  // Mutación: Guardar Servicio
  const saveServiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingService;
      const url = isEdit ? `http://localhost:3001/api/services/${editingService.id}` : 'http://localhost:3001/api/services';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, userId: currentUser?.id })
      });
      if (!res.ok) throw new Error('Error al guardar servicio');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-pos'] });
      setShowModal(false);
      setEditingService(null);
    }
  });

  // Mutación: Eliminar Servicio (Desactivar)
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`http://localhost:3001/api/services/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      if (!res.ok) throw new Error('Error al desactivar el servicio');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-pos'] });
    }
  });

  const handleOpenAdd = () => {
    setEditingService(null);
    setForm({ nombre: '', precio: '', unidad: 'Servicio' });
    setShowModal(true);
  };

  const handleOpenEdit = (s: Service) => {
    setEditingService(s);
    setForm({
      nombre: s.nombre,
      precio: parseFloat(s.precio).toString(),
      unidad: s.unidad
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveServiceMutation.mutate(form);
  };

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full">
      {/* Encabezado */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Servicios Cobrables</h1>
          <p className="text-muted-foreground text-sm">Administración de catálogo de copiado, engargolados y enmicados</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/10 transition-all"
        >
          <Plus size={16} />
          Registrar Servicio
        </button>
      </div>

      {/* Grid de Servicios */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 border rounded-2xl animate-pulse bg-muted/20"></div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2">
            <Calculator size={40} className="stroke-[1.5]" />
            <p className="text-sm font-semibold">No hay servicios registrados en la base de datos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map(s => (
              <div key={s.id} className={`border rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col justify-between space-y-4 ${s.activo ? 'bg-card' : 'bg-muted/10 opacity-70'}`}>
                
                {/* Info */}
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {s.unidad}
                    </span>
                    
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleOpenEdit(s)} className="p-1 border rounded-lg text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Edit3 size={13} />
                      </button>
                      
                      {s.activo && (
                        <button
                          onClick={() => {
                            if (confirm('¿Deseas dar de baja este servicio de la venta activa?')) {
                              deleteMutation.mutate(s.id);
                            }
                          }}
                          className="p-1 border rounded-lg text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-base font-outfit text-slate-800 dark:text-slate-200 line-clamp-2 pt-1">{s.nombre}</h3>
                </div>

                {/* Precio */}
                <div className="flex justify-between items-end border-t pt-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                    <Tag size={10} /> Tarifa cobro
                  </span>
                  <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-outfit leading-none">
                    ${parseFloat(s.precio).toFixed(2)}
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: SERVICIO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-4">
              {editingService ? 'Modificar Servicio' : 'Registrar Nuevo Servicio'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre del Servicio</label>
                <input
                  type="text"
                  placeholder="Ej: Copias B/N Carta, Engargolado, etc."
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Tarifa / Precio Venta ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-bold"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Unidad de Medida</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                >
                  <option value="Servicio">Servicio (General)</option>
                  <option value="Copia">Copia (Impresión/Fotocopia)</option>
                  <option value="Impresión">Impresión</option>
                  <option value="Pieza">Pieza (Engargolados/Laminados)</option>
                  <option value="Escaneo">Escaneo</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveServiceMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  {saveServiceMutation.isPending ? 'Guardando...' : 'Guardar Servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
