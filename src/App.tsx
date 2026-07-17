import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { DailyLogView } from './components/DailyLogView';
import { FleetView } from './components/FleetView';
import { ContractConfigView } from './components/ContractConfigView';
import { ToastContainer } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { dbService } from './services/db';
import type { Equipment } from './services/db';

function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [fleet, setFleet] = useState<Equipment[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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
          addToast('Datos sincronizados con Supabase', 'success');
        })
        .catch(err => {
          console.error("Supabase sync error:", err);
          addToast('Error al sincronizar con Supabase. Operando localmente.', 'error');
        });
    }
  }, [refreshFleet, addToast]);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView fleet={fleet} addToast={addToast} />;
      case 'dailylog':
        return <DailyLogView fleet={fleet} addToast={addToast} />;
      case 'fleet':
        return (
          <FleetView
            fleet={fleet}
            onFleetChanged={refreshFleet}
            addToast={addToast}
          />
        );
      case 'contract':
        return (
          <ContractConfigView
            fleet={fleet}
            onConfigChanged={refreshFleet}
            addToast={addToast}
          />
        );
      default:
        return <DashboardView fleet={fleet} addToast={addToast} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeView={activeView} setActiveView={setActiveView} theme={theme} setTheme={setTheme} />
      <main className="main-content">
        {renderView()}
      </main>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default App;
