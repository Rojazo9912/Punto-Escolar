import React, { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { LogIn, KeyRound, Store, HelpCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para Modal de Recuperación
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [rfc, setRfc] = useState('');
  const [phone, setPhone] = useState('');
  const [recoverMsg, setRecoverMsg] = useState('');
  const [recoverError, setRecoverError] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);

  const loginSession = useSessionStore(state => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor llena todos los campos.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Error al iniciar sesión.');
      } else {
        loginSession(data);
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor local del sistema.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError('');
    setRecoverMsg('');
    setRecoverLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfc, telefono: phone })
      });

      const data = await response.json();
      if (!response.ok) {
        setRecoverError(data.error || 'Datos incorrectos.');
      } else {
        setRecoverMsg(data.message || 'Contraseña restablecida con éxito.');
      }
    } catch (err) {
      setRecoverError('Error de red al intentar recuperar.');
    } finally {
      setRecoverLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-cover bg-center relative" style={{ backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
      {/* Círculos decorativos flotantes */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 text-blue-400 rounded-xl mb-3 border border-blue-500/20">
            <Store size={36} className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-white font-outfit tracking-tight">Punto Escolar</h1>
          <p className="text-slate-400 text-sm mt-1">v1.0 MVP - Sistema de Escritorio Local</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Usuario</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Contraseña</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between text-sm text-slate-300">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
              />
              <span>Recordarme</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setRecoverMsg('');
                setRecoverError('');
                setRfc('');
                setPhone('');
                setShowRecoverModal(true);
              }}
              className="text-blue-400 hover:text-blue-300 hover:underline text-xs flex items-center gap-1 font-medium transition-colors"
            >
              <HelpCircle size={14} /> ¿Olvidaste la clave?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn size={18} />
                <span>Ingresar al Sistema</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Modal de Recuperación Local */}
      {showRecoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2 font-outfit">
              <KeyRound className="text-blue-400" />
              Recuperación de Contraseña
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Ingresa los datos fiscales registrados en tu configuración para restablecer el acceso del Administrador a la clave predeterminada.
            </p>

            {recoverError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {recoverError}
              </div>
            )}

            {recoverMsg && (
              <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
                {recoverMsg}
              </div>
            )}

            <form onSubmit={handleRecover} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">RFC del Negocio</label>
                <input
                  type="text"
                  placeholder="Ej: XAXX010101000"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">Teléfono del Negocio</label>
                <input
                  type="text"
                  placeholder="Ej: 5512345678"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecoverModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={recoverLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-2"
                >
                  {recoverLoading ? 'Validando...' : 'Restablecer Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
