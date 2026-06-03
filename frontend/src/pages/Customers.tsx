import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../store/sessionStore';
import { 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Phone, 
  Mail, 
  FileText, 
  TrendingUp, 
  CalendarDays
} from 'lucide-react';

interface Customer {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  comprasRealizadas: number;
  montoAcumulado: number;
  fechaUltimaCompra: string | null;
}

export default function Customers() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore(state => state.user);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    notas: ''
  });

  // Consultar Clientes
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/customers');
      if (!res.ok) throw new Error('Error al obtener clientes');
      return res.json();
    }
  });

  // Mutación: Crear/Editar Cliente
  const saveCustomerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!editingCustomer;
      const url = isEdit ? `http://localhost:3001/api/customers/${editingCustomer.id}` : 'http://localhost:3001/api/customers';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, userId: currentUser?.id })
      });
      if (!res.ok) throw new Error('Error al guardar cliente');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-pos'] });
      setShowModal(false);
      setEditingCustomer(null);
    }
  });

  // Mutación: Eliminar Cliente
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`http://localhost:3001/api/customers/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar cliente');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-pos'] });
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setForm({ nombre: '', telefono: '', correo: '', notas: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      nombre: c.nombre,
      telefono: c.telefono || '',
      correo: c.correo || '',
      notas: c.notas || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomerMutation.mutate(form);
  };

  const filteredCustomers = customers.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono?.includes(search) ||
    c.correo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full">
      {/* Encabezado */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Historial de Clientes</h1>
          <p className="text-muted-foreground text-sm">Registro de compras y consumo acumulado en mostrador</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/10 transition-all"
        >
          <Plus size={16} />
          Registrar Cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
        <input
          type="text"
          placeholder="Buscar cliente por nombre, teléfono o correo..."
          className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid de Clientes */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 border rounded-2xl animate-pulse bg-muted/20"></div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2">
            <Users size={40} className="stroke-[1.5]" />
            <p className="text-sm font-semibold">No se encontraron clientes registrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map(c => (
              <div key={c.id} className="border bg-card rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col justify-between space-y-4">
                
                {/* Datos Personales */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-base font-outfit text-slate-800 dark:text-slate-200 line-clamp-1">{c.nombre}</h3>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => handleOpenEdit(c)} className="p-1 border rounded-lg text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Edit3 size={13} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('¿Deseas eliminar este perfil de cliente? (No se borrarán sus ventas del historial)')) {
                            deleteMutation.mutate(c.id);
                          }
                        }}
                        className="p-1 border rounded-lg text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5"><Phone size={12} /> {c.telefono || 'Sin teléfono'}</div>
                    <div className="flex items-center gap-1.5"><Mail size={12} /> {c.correo || 'Sin correo'}</div>
                    {c.notas && <div className="flex items-start gap-1.5"><FileText size={12} className="mt-0.5" /> <span className="line-clamp-2">{c.notas}</span></div>}
                  </div>
                </div>

                {/* Resumen Acumulado */}
                <div className="grid grid-cols-2 gap-4 border-t pt-3 bg-muted/10 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <TrendingUp size={10} /> Consumo
                    </span>
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 font-outfit mt-0.5 block">
                      ${c.montoAcumulado.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-muted-foreground mt-0.5 block">Compras: {c.comprasRealizadas}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <CalendarDays size={10} /> Último Pago
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 block">
                      {c.fechaUltimaCompra ? new Date(c.fechaUltimaCompra).toLocaleDateString() : 'Ninguno'}
                    </span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: CLIENTE (REGISTRAR / EDITAR) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-4">
              {editingCustomer ? 'Modificar Perfil de Cliente' : 'Registrar Nuevo Cliente'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre Completo</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Número de Teléfono</label>
                <input
                  type="text"
                  placeholder="Ej: 5512345678"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="Ej: cliente@correo.com"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Notas Adicionales</label>
                <textarea
                  rows={3}
                  placeholder="Ej: Datos de facturación frecuentes, especificaciones, etc."
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                />
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
                  disabled={saveCustomerMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold"
                >
                  {saveCustomerMutation.isPending ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
