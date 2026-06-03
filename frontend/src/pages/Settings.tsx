import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '../store/sessionStore';
import { 
  Database, 
  ShieldAlert, 
  Building, 
  FileCheck,
  Search,
  FileDown,
  Users
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

  // Gestión de Usuarios
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    roleId: '2',
    active: true
  });

  // Consultar Cajeros (Usuarios)
  const { data: users = [], isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ['usersList'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/auth/users');
      return res.json();
    }
  });

  // Mutación: Guardar / Editar Usuario
  const saveUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!payload.id;
      const url = isEdit 
        ? `http://localhost:3001/api/auth/users/${payload.id}`
        : 'http://localhost:3001/api/auth/users';
      const method = isEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar el usuario');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      alert(editingUser ? 'Usuario modificado con éxito.' : 'Cajero registrado con éxito.');
      setShowUserModal(false);
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  // Gestión de Roles y Permisos
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleForm, setRoleForm] = useState<{
    name: string;
    description: string;
    permissionIds: number[];
  }>({
    name: '',
    description: '',
    permissionIds: []
  });

  // Consultar Roles
  const { data: roles = [], isLoading: loadingRoles } = useQuery<any[]>({
    queryKey: ['rolesList'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/auth/roles');
      return res.json();
    }
  });

  // Consultar Permisos Base
  const { data: permissions = [] } = useQuery<any[]>({
    queryKey: ['permissionsList'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/auth/permissions');
      return res.json();
    }
  });

  // Mutación: Guardar / Editar Rol
  const saveRoleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const isEdit = !!payload.id;
      const url = isEdit 
        ? `http://localhost:3001/api/auth/roles/${payload.id}`
        : 'http://localhost:3001/api/auth/roles';
      const method = isEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar el rol');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolesList'] });
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      alert(editingRole ? 'Rol modificado con éxito.' : 'Rol creado con éxito.');
      setShowRoleModal(false);
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });


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

        {/* Panel Derecho: Mantenimiento y Usuarios */}
        <div className="space-y-6">
          {/* Mantenimiento de Base de Datos */}
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

          {/* Gestión de Usuarios y Cajeros */}
          <div className="border bg-card rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold font-outfit flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                <Users size={18} className="text-blue-500" /> Gestión de Cajeros
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({ username: '', password: '', roleId: '2', active: true });
                  setShowUserModal(true);
                }}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-md shadow-blue-500/10"
              >
                + Registrar
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {loadingUsers ? (
                <div className="text-xs text-muted-foreground py-4 text-center">Cargando cajeros...</div>
              ) : users.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">No hay usuarios registrados.</div>
              ) : (
                users.map(u => (
                  <div key={u.id} className="p-2 border rounded-xl flex justify-between items-center text-xs bg-muted/10">
                    <div>
                      <span className="font-bold block text-slate-800 dark:text-slate-200">{u.username}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Rol: {u.role.name} | Status: {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(u);
                        setUserForm({
                          username: u.username,
                          password: '', // Password en blanco para no sobreescribir si no se edita
                          roleId: u.roleId.toString(),
                          active: u.active
                        });
                        setShowUserModal(true);
                      }}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-500 hover:text-white rounded text-[10px] font-bold transition-all text-slate-600 dark:text-slate-300"
                    >
                      Editar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Gestión de Roles y Permisos */}
          <div className="border bg-card rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold font-outfit flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                <Users size={18} className="text-blue-500" /> Roles y Permisos
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingRole(null);
                  setRoleForm({ name: '', description: '', permissionIds: [] });
                  setShowRoleModal(true);
                }}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold transition-all shadow-md shadow-blue-500/10"
              >
                + Crear Rol
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {loadingRoles ? (
                <div className="text-xs text-muted-foreground py-4 text-center">Cargando roles...</div>
              ) : roles.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">No hay roles registrados.</div>
              ) : (
                roles.map((r: any) => (
                  <div key={r.id} className="p-2.5 border rounded-xl flex justify-between items-start text-xs bg-muted/10">
                    <div className="space-y-1 max-w-[70%]">
                      <span className="font-bold block text-slate-800 dark:text-slate-200">{r.name}</span>
                      {r.description && <span className="text-[10px] text-muted-foreground block leading-tight">{r.description}</span>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.permissions.map((p: any) => (
                          <span key={p.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole(r);
                        setRoleForm({
                          name: r.name,
                          description: r.description || '',
                          permissionIds: r.permissions.map((p: any) => p.id)
                        });
                        setShowRoleModal(true);
                      }}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-500 hover:text-white rounded text-[10px] font-bold transition-all text-slate-600 dark:text-slate-300"
                    >
                      Permisos
                    </button>
                  </div>
                ))
              )}
            </div>
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

      {/* MODAL: REGISTRAR/EDITAR USUARIO */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-3">
              {editingUser ? 'Modificar Usuario' : 'Registrar Nuevo Cajero'}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!userForm.username.trim()) return;
                if (!editingUser && !userForm.password) {
                  alert('La contraseña es obligatoria para nuevos usuarios');
                  return;
                }
                saveUserMutation.mutate({
                  id: editingUser?.id,
                  username: userForm.username.trim(),
                  password: userForm.password ? userForm.password : undefined,
                  roleId: parseInt(userForm.roleId),
                  active: userForm.active
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre de Usuario</label>
                <input
                  type="text"
                  placeholder="Ej: cajero2, supervisor"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">
                  Contraseña {editingUser && '(Dejar en blanco para no cambiar)'}
                </label>
                <input
                  type="password"
                  placeholder={editingUser ? '••••••••' : 'Ingresa contraseña'}
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Rol de Usuario</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold focus:outline-none"
                  value={userForm.roleId}
                  onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                >
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id.toString()}>{r.name}</option>
                  ))}
                </select>
              </div>

              {editingUser && (
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="userActiveCheck"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    checked={userForm.active}
                    onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })}
                  />
                  <label htmlFor="userActiveCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Usuario Activo (Permite iniciar sesión)
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveUserMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/10"
                >
                  {saveUserMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR/EDITAR ROL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl p-6 relative animate-in fade-in duration-150">
            <h2 className="text-xl font-bold font-outfit mb-3">
              {editingRole ? 'Editar Permisos del Rol' : 'Crear Nuevo Rol'}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!roleForm.name.trim()) return;
                saveRoleMutation.mutate({
                  id: editingRole?.id,
                  name: roleForm.name.trim(),
                  description: roleForm.description.trim(),
                  permissionIds: roleForm.permissionIds
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Nombre del Rol</label>
                <input
                  type="text"
                  placeholder="Ej: Cajero Limitado, Supervisor"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-semibold"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  disabled={editingRole?.name === 'Administrador' || editingRole?.name === 'Cajero'}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500">Descripción</label>
                <input
                  type="text"
                  placeholder="Ej: Acceso a ventas, sin ver inventario"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-500">Permisos Asignados</label>
                <div className="space-y-2 border rounded-lg p-3 bg-muted/10 max-h-[200px] overflow-y-auto">
                  {permissions.map((p: any) => {
                    const isChecked = roleForm.permissionIds.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-start gap-2.5 py-1">
                        <input
                          type="checkbox"
                          id={`perm-${p.id}`}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 mt-0.5"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRoleForm({
                                ...roleForm,
                                permissionIds: [...roleForm.permissionIds, p.id]
                              });
                            } else {
                              setRoleForm({
                                ...roleForm,
                                permissionIds: roleForm.permissionIds.filter(id => id !== p.id)
                              });
                            }
                          }}
                        />
                        <label htmlFor={`perm-${p.id}`} className="text-xs cursor-pointer select-none">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground leading-normal">{p.description}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-accent text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveRoleMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/10"
                >
                  {saveRoleMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
