import React from 'react';
import { LayoutDashboard, CalendarDays, Truck, FileText, Sun, Moon, HelpCircle, Users, LogOut } from 'lucide-react';
import logoBlanca from '../Logo Enaex Letra Blanca.png';
import logoGris from '../Logo Enaex Letra Gris.png';
import type { ContractUser } from '../services/db';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  currentUser: ContractUser;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeView, 
  setActiveView, 
  theme, 
  setTheme,
  currentUser,
  onLogout
}) => {
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const isAdmin = currentUser.role === 'Administrador';

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

      <div style={{ padding: '0 20px', marginBottom: '16px', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Sesión activa:</span>
        <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={currentUser.name}>
          {currentUser.name}
        </strong>
        <span style={{ fontSize: '0.72rem', color: currentUser.role === 'Administrador' ? 'var(--color-operativo)' : 'var(--text-secondary)' }}>
          • {currentUser.role}
        </span>
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

        {isAdmin && (
          <>
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
            <li>
              <a
                onClick={() => setActiveView('users')}
                className={`menu-item ${activeView === 'users' ? 'active' : ''}`}
              >
                <Users size={18} />
                <span>Control de Usuarios</span>
              </a>
            </li>
          </>
        )}

        <li>
          <a
            onClick={() => setActiveView('methodology')}
            className={`menu-item ${activeView === 'methodology' ? 'active' : ''}`}
          >
            <HelpCircle size={18} />
            <span>Metodología de KPIs</span>
          </a>
        </li>
      </ul>

      <button className="theme-toggle-btn" onClick={onLogout} style={{ marginTop: 'auto', marginBottom: '6px', color: 'var(--color-mantencioncorrectiva)' }}>
        <LogOut size={15} />
        <span>Cerrar Sesión</span>
      </button>

      <button className="theme-toggle-btn" onClick={toggleTheme} style={{ marginTop: '0', marginBottom: '12px' }}>
        {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
      </button>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center', width: '100%' }}>
        <p style={{ fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.5px' }}>razecl web design Ⓡ</p>
        <p style={{ fontSize: '0.72rem', opacity: 0.7 }}>Andres Alquinta Ayala</p>
      </div>
    </aside>
  );
};
