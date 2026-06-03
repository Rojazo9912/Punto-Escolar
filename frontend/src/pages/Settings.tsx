import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../store/sessionStore';
import { 
  Database, 
  ShieldAlert, 
  Building, 
  FileCheck,
  Search,
  FileDown
} from 'lucide-react';

interface AuditLog {
  id: number;
  userId: number | null;
  accion: string;
  fecha: string;
  modulo: string;
  ipLocal: string;
  user: { username: string } | null;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const currentUser = useSessionStore(state => state.user);
  
  // Bitácora search
  const [logSearch, setLogSearch] = useState('');

  // Estados de carga de datos
  const [form, setForm] = useState({
    nombreNegocio: '',
    direccion: '',
    telefono: '',
    correo: '',
    rfc: '',
    mensajeTicket: ''
  });

  // Consultar Parámetros del Negocio
  const { isLoading } = useQuery({
    queryKey: ['businessSettings'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/settings');
      const data = await res.json();
      setForm({
        nombreNegocio: data.nombreNegocio || '',
        direccion: data.direccion || '',
        telefono: data.telefono || '',
        correo: data.correo || '',
        rfc: data.rfc || '',
        mensajeTicket: data.mensajeTicket || ''
      });
      return data;
    }
  });

  // Consultar Bitácora de Auditoría (Solo administradores)
  const { data: auditLogs = [], isLoading: loadingLogs } = useQuery<AuditLog[]>({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/settings/audit-logs');
      return res.json();
    },
    enabled: currentUser?.role.name === 'Administrador'
  });

  // Mutación: Guardar Ajustes
  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('http://localhost:3001/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, userId: currentUser?.id })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessSettings'] });
      alert('Configuraciones actualizadas con éxito.');
    }
  });

  // Mutación: Ejecutar Restauración SQL
  const restoreMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await fetch('http://localhost:3001/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, userId: currentUser?.id })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al restaurar base de datos');
      }
      return res.json();
    },
    onSuccess: () => {
      alert('Base de datos restaurada correctamente. La información se encuentra actualizada.');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate(form);
  };

  // Triger de selección de archivo SQL nativo de Electron
  const handleRestoreClick = async () => {
    if (currentUser?.role.name !== 'Administrador') {
      alert('Solo el Administrador puede restaurar la base de datos.');
      return;
    }

    if (!(window as any).electronAPI) {
      alert('Esta función nativa requiere la aplicación de escritorio.');
      return;
    }

    if (!confirm('¡ADVERTENCIA CRÍTICA!\n\nRestaurar una base de datos reemplazará la información actual por el archivo seleccionado. ¿Estás absolutamente seguro de continuar?')) {
      return;
    }

    const selectedFile = await (window as any).electronAPI.selectSqlFile();
    if (selectedFile) {
      restoreMutation.mutate(selectedFile);
    }
  };

  // Filtrado de auditoría
  const filteredLogs = auditLogs.filter(log => 
    log.accion.toLowerCase().includes(logSearch.toLowerCase()) ||
    log.modulo.toLowerCase().includes(logSearch.toLowerCase()) ||
    log.user?.username.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-h-screen flex flex-col h-full overflow-y-auto">
      {/* Encabezado */}
      <div className="shrink-0">
        <h1 className="text-3xl font-extrabold tracking-tight font-outfit">Configuración General</h1>
        <p className="text-muted-foreground text-sm">Ajustes de ticket, bitácora de auditoría y restaurador de base de datos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Panel Izquierdo & Centro: Ajustes Corporativos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold font-outfit mb-4 flex items-center gap-1.5 border-b pb-2">
              <Building className="text-blue-500" size={18} /> Datos Comerciales
            </h2>

            {isLoading ? (
              <div className="animate-pulse py-8 text-center text-xs">Cargando configuraciones locales...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre del Negocio</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold"
                      value={form.nombreNegocio}
                      onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-500">RFC Fiscal del Negocio</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono"
                      placeholder="XAXX010101000"
                      value={form.rfc}
                      onChange={(e) => setForm({ ...form, rfc: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-500">Teléfono</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1 text-slate-500">Dirección Física</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                      value={form.direccion}
                      onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1 text-slate-500">Mensaje de pie de ticket (Agradecimiento)</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm italic"
                      placeholder="Gracias por su preferencia en papelería Punto Escolar"
                      value={form.mensajeTicket}
                      onChange={(e) => setForm({ ...form, mensajeTicket: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    disabled={saveSettingsMutation.isPending}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/10 transition-all flex items-center gap-1.5"
                  >
                    <FileCheck size={14} />
                    {saveSettingsMutation.isPending ? 'Guardando...' : 'Actualizar Parámetros'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Panel Derecho: Copias de seguridad y restauración */}
        <div className="space-y-6">
          <div className="border bg-card rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold font-outfit flex items-center gap-1.5 border-b pb-3 text-red-500">
              <Database size={18} /> Mantenimiento de Base de Datos
            </h2>
            
            <p className="text-xs text-muted-foreground leading-relaxed">
              El sistema realiza respaldos automáticos de MySQL en cada corte de caja. Si deseas restaurar información anterior o migrar el sistema, puedes seleccionar un respaldo SQL local.
            </p>

            <button
              onClick={handleRestoreClick}
              disabled={restoreMutation.isPending}
              className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              <FileDown size={16} />
              {restoreMutation.isPending ? 'Restaurando...' : 'Restaurar Base de Datos'}
            </button>
          </div>
        </div>

      </div>

      {/* Bitácora de Auditoría (Para Administradores) */}
      {currentUser?.role.name === 'Administrador' && (
        <div className="border bg-card rounded-2xl p-6 shadow-sm flex flex-col flex-1 min-h-[300px]">
          <div className="flex justify-between items-center border-b pb-4 shrink-0">
            <h2 className="text-base font-bold font-outfit flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
              <ShieldAlert className="text-amber-500" size={18} />
              Bitácora de Auditoría (Control de Seguridad)
            </h2>
            <div className="relative w-64 text-xs">
              <Search className="absolute left-2.5 top-2 text-muted-foreground" size={14} />
              <input
                type="text"
                placeholder="Filtrar bitácora..."
                className="w-full pl-8 pr-3 py-1.5 border rounded-lg bg-background"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 text-xs mt-3 border rounded-xl bg-muted/10">
            <table className="w-full text-left">
              <thead className="bg-muted/40 font-bold border-b sticky top-0 bg-card z-10">
                <tr>
                  <th className="px-4 py-2.5">Fecha / Hora</th>
                  <th className="px-4 py-2.5">Usuario</th>
                  <th className="px-4 py-2.5">Acción</th>
                  <th className="px-4 py-2.5">Módulo</th>
                  <th className="px-4 py-2.5 text-right">Dirección IP Local</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 dark:text-slate-300">
                {loadingLogs ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground animate-pulse">Cargando bitácora de auditoría...</td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground">Sin registros de auditoría que coincidan.</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5">{new Date(log.fecha).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-semibold">{log.user?.username || 'Sistema'}</td>
                      <td className="px-4 py-2.5">{log.accion}</td>
                      <td className="px-4 py-2.5 font-bold uppercase text-[10px] tracking-wide">{log.modulo}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{log.ipLocal}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
