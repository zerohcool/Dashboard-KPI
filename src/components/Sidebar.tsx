import React from 'react';
import { LayoutDashboard, CalendarDays, Truck, FileText, Sun, Moon } from 'lucide-react';
import logoBlanca from '../Logo Enaex Letra Blanca.png';
import logoGris from '../Logo Enaex Letra Gris.png';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, theme, setTheme }) => {
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-details">
          <img 
            src={theme === 'dark' ? logoBlanca : logoGris} 
            className="enaex-logo" 
            alt="Enaex Logo" 
          />
          <div className="sidebar-subtitle" style={{ fontSize: '1rem', fontWeight: '700', lineHeight: '1.2', marginTop: '4px' }}>
            KPI Disponibilidad
          </div>
          <div className="sidebar-subtitle" style={{ fontSize: '0.9rem', fontWeight: '500', opacity: 0.8, lineHeight: '1.2' }}>
            Enaex
          </div>
          <div className="sidebar-site" style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
            Planta Sierra Gorda
          </div>
        </div>
      </div>
      
      <ul className="sidebar-menu">
        <li>
          <a
            onClick={() => setActiveView('dashboard')}
            className={`menu-item ${activeView === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard KPI</span>
          </a>
        </li>
        <li>
          <a
            onClick={() => setActiveView('dailylog')}
            className={`menu-item ${activeView === 'dailylog' ? 'active' : ''}`}
          >
            <CalendarDays size={18} />
            <span>Registro Diario</span>
          </a>
        </li>
        <li>
          <a
            onClick={() => setActiveView('fleet')}
            className={`menu-item ${activeView === 'fleet' ? 'active' : ''}`}
          >
            <Truck size={18} />
            <span>Gestión de Flota</span>
          </a>
        </li>
        <li>
          <a
            onClick={() => setActiveView('contract')}
            className={`menu-item ${activeView === 'contract' ? 'active' : ''}`}
          >
            <FileText size={18} />
            <span>Configuración Contrato</span>
          </a>
        </li>
      </ul>

      <button className="theme-toggle-btn" onClick={toggleTheme}>
        {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
      </button>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center', width: '100%' }}>
        <p style={{ fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.5px' }}>razecl web design Ⓡ</p>
        <p style={{ fontSize: '0.72rem', opacity: 0.7 }}>Andres Alquinta Ayala</p>
        <p style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: 0.8, marginTop: '2px' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ color: '#25d366' }}>
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.517 2.266 2.27 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.739-1.446L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.528 2.083 14.069.988 11.451.988c-5.437 0-9.862 4.371-9.866 9.8.001 1.716.463 3.39 1.337 4.866L1.825 22l6.589-1.748L8.4 20.25a9.73 9.73 0 0 1-1.753-1.096zM17.486 14.4c-.3-.15-1.774-.875-2.049-.976-.275-.101-.475-.149-.675.15-.199.299-.775.975-.95 1.174-.175.2-.35.224-.65.074-3-.15-5.324-1.106-7.355-2.91-.555-.494-.905-1.106-1.012-1.32-.107-.215-.012-.331.093-.435.095-.094.215-.249.324-.374.11-.124.145-.214.219-.359.074-.149.037-.28-.019-.38-.056-.1-.475-1.149-.65-1.574-.17-.412-.358-.356-.492-.363-.127-.007-.274-.008-.42-.008-.146 0-.384.054-.585.273-.201.22-1.118 1.094-1.118 2.666 0 1.573 1.147 3.091 1.306 3.3.16.21 2.257 3.447 5.467 4.832 2.63 1.137 3.407 1.027 4.607.848 1.144-.17 2.476-.799 2.825-1.573.348-.775.348-1.44.244-1.574-.105-.135-.305-.213-.605-.363z" />
          </svg>
          <span style={{ fontWeight: '500' }}>+56 9 6673 5408</span>
        </p>
      </div>
    </aside>
  );
};
