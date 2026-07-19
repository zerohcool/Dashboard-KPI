import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { DailyLogView } from './components/DailyLogView';
import { FleetView } from './components/FleetView';
import { ContractConfigView } from './components/ContractConfigView';
import { MethodologyView } from './components/MethodologyView';
import { LoginView } from './components/LoginView';
import { UsersConfigView } from './components/UsersConfigView';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { dbService } from './services/db';
import type { Equipment, ContractUser } from './services/db';

function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [fleet, setFleet] = useState<Equipment[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // User session state
  const [currentUser, setCurrentUser] = useState<ContractUser | null>(() => {
    const saved = localStorage.getItem('disponibilidad_equipos_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Toggle theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [theme]);

  // Toast helper
  const addToast = useCallback((text: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Fetch fleet list
  const refreshFleet = useCallback(() => {
    setFleet(dbService.getEquipment());
  }, []);

  useEffect(() => {
    refreshFleet();
    
    if (dbService.isSupabaseEnabled()) {
      dbService.syncFromSupabase()
        .then(() => {
          refreshFleet();
          // Seed users locally too after sync
          dbService.getUsers();
          addToast('Datos sincronizados con Supabase', 'success');
        })
        .catch(err => {
          console.error("Supabase sync error:", err);
          addToast('Error al sincronizar con Supabase. Operando localmente.', 'error');
        });
    } else {
      // Seed users locally
      dbService.getUsers();
    }
  }, [refreshFleet, addToast]);

  const handleLogin = (user: ContractUser) => {
    setCurrentUser(user);
    localStorage.setItem('disponibilidad_equipos_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('disponibilidad_equipos_session');
    setActiveView('dashboard');
    addToast('Sesión cerrada con éxito', 'success');
  };

  const renderView = () => {
    if (!currentUser) return null;

    switch (activeView) {
      case 'dashboard':
        return <DashboardView fleet={fleet} addToast={addToast} />;
      case 'dailylog':
        return currentUser.role === 'Administrador' 
          ? <DailyLogView fleet={fleet} addToast={addToast} /> 
          : <DashboardView fleet={fleet} addToast={addToast} />;
      case 'fleet':
        return currentUser.role === 'Administrador' ? (
          <FleetView
            fleet={fleet}
            onFleetChanged={refreshFleet}
            addToast={addToast}
          />
        ) : <DashboardView fleet={fleet} addToast={addToast} />;
      case 'contract':
        return currentUser.role === 'Administrador' ? (
          <ContractConfigView
            fleet={fleet}
            onConfigChanged={refreshFleet}
            addToast={addToast}
          />
        ) : <DashboardView fleet={fleet} addToast={addToast} />;
      case 'users':
        return currentUser.role === 'Administrador'
          ? <UsersConfigView currentUser={currentUser} addToast={addToast} />
          : <DashboardView fleet={fleet} addToast={addToast} />;
      case 'methodology':
        return <MethodologyView />;
      default:
        return <DashboardView fleet={fleet} addToast={addToast} />;
    }
  };

  if (!currentUser) {
    return (
      <>
        <LoginView onLogin={handleLogin} theme={theme} setTheme={setTheme} addToast={addToast} />
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </>
    );
  }

  return (
    <div className="app-container">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        theme={theme} 
        setTheme={setTheme} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {renderView()}
      </main>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default App;
