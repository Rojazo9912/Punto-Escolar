import { useState } from 'react';
import { useSessionStore } from './store/sessionStore';
import { useThemeStore } from './store/themeStore';
import { useCashStore } from './store/cashStore';

// Importar Vistas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import SchoolLists from './pages/SchoolLists';
import Customers from './pages/Customers';
import Services from './pages/Services';
import CashRegister from './pages/CashRegister';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Purchases from './pages/Purchases';

// Iconos
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Archive, 
  GraduationCap, 
  Users, 
  Calculator, 
  Wallet, 
  TrendingUp, 
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  Truck
} from 'lucide-react';


type PageType = 'dashboard' | 'pos' | 'inventory' | 'school-lists' | 'customers' | 'services' | 'cash' | 'reports' | 'purchases' | 'settings';

export default function App() {
  const { isAuthenticated, user, logout } = useSessionStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isOpen: isCashOpen } = useCashStore();
  const [activePage, setActivePage] = useState<PageType>('dashboard');

  // Si no está autenticado, forzar pantalla de login
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // Lista de elementos de menú y restricciones de roles
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, role: 'Cajero' },
    { id: 'pos', name: 'Punto de Venta', icon: ShoppingCart, role: 'Cajero' },
    { id: 'inventory', name: 'Inventario', icon: Archive, role: 'Cajero' },
    { id: 'school-lists', name: 'Listas Escolares', icon: GraduationCap, role: 'Cajero' },
    { id: 'services', name: 'Servicios', icon: Calculator, role: 'Cajero' },
    { id: 'customers', name: 'Clientes', icon: Users, role: 'Cajero' },
    { id: 'cash', name: 'Caja Registradora', icon: Wallet, role: 'Cajero' },
    // Solo administrador
    { id: 'purchases', name: 'Compras', icon: Truck, role: 'Administrador' },
    { id: 'reports', name: 'Reportes', icon: TrendingUp, role: 'Administrador' },
    { id: 'settings', name: 'Configuración', icon: SettingsIcon, role: 'Administrador' },
  ];

  // Filtrar según el rol del usuario
  const visibleMenuItems = menuItems.filter(item => {
    if (user.role.name === 'Administrador') return true;
    return item.role === 'Cajero'; // Cajero solo ve los marcados como Cajero
  });

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'pos': return <POS />;
      case 'inventory': return <Inventory />;
      case 'school-lists': return <SchoolLists onNavigateToPOS={() => setActivePage('pos')} />;
      case 'customers': return <Customers />;
      case 'services': return <Services />;
      case 'cash': return <CashRegister />;
      case 'purchases': return <Purchases />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      
      {/* SIDEBAR NAVEGACIÓN */}
      <aside className="w-64 border-r bg-card flex flex-col justify-between shrink-0">
        
        {/* Header Sidebar */}
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden border bg-white flex items-center justify-center shadow-sm shrink-0">
                <img src="./logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-extrabold text-base font-outfit tracking-tight">Punto Escolar</span>
            </div>
            {/* Dark Mode Switch */}
            <button
              onClick={toggleTheme}
              className="p-1.5 border rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
              title="Cambiar Tema"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>

          {/* Estado de la Caja */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${isCashOpen ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600' : 'bg-red-500/5 border-red-500/10 text-red-500'}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${isCashOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            {isCashOpen ? 'Caja Registradora Abierta' : 'Caja Cerrada (Abrir Turno)'}
          </div>
        </div>

        {/* Links de Navegación */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {visibleMenuItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id as PageType)}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-3 transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                <Icon size={16} />
                {item.name}
              </button>
            )
          })}
        </nav>

        {/* Footer Sidebar (Usuario & Salir) */}
        <div className="p-4 border-t space-y-3 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="overflow-hidden">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">{user.username}</span>
              <span className="text-[10px] text-muted-foreground block font-semibold">{user.role.name}</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (confirm('¿Deseas cerrar tu sesión de trabajo?')) {
                logout();
              }
            }}
            className="w-full py-2 border rounded-xl hover:bg-red-500/5 hover:text-red-500 hover:border-red-500/20 text-xs font-bold flex items-center justify-center gap-1.5 text-muted-foreground transition-all"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>

      </aside>

      {/* CONTENEDOR DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 h-screen overflow-hidden bg-slate-50 dark:bg-slate-900/40 relative">
        {renderContent()}
      </main>

    </div>
  );
}
