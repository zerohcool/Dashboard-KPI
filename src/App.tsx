import { useState, useEffect, useCallback, useRef } from 'react';
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
import { ConfirmDialog } from './components/ConfirmDialog';

function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isDailyLogDirty, setIsDailyLogDirty] = useState<boolean>(false);
  const dailyLogRef = useRef<{ saveCurrentTab: () => Promise<void> } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    saveLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onSave?: () => void;
    onCancel?: () => void;
    variant?: 'danger' | 'warning' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleViewChange = (view: string) => {
    if (isDailyLogDirty && activeView === 'dailylog') {
      setConfirmDialog({
        isOpen: true,
        title: "Cambios sin guardar",
        message: "Tiene cambios sin guardar en el Registro Diario. ¿Desea salir sin guardar?",
        confirmLabel: "Sí, salir sin guardar",
        saveLabel: "Guardar",
        cancelLabel: "Cancelar",
        onConfirm: () => {
          setIsDailyLogDirty(false);
          setActiveView(view);
        },
        onSave: () => {
          if (dailyLogRef.current) {
            dailyLogRef.current.saveCurrentTab()
              .then(() => {
                setIsDailyLogDirty(false);
                setActiveView(view);
              })
              .catch(err => {
                console.error("Failed to save before navigating:", err);
              });
          }
        }
      });
      return;
    }
    setActiveView(view);
  };

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
    if (isDailyLogDirty && activeView === 'dailylog') {
      setConfirmDialog({
        isOpen: true,
        title: "Cambios sin guardar",
        message: "Tiene cambios sin guardar en el Registro Diario. ¿Desea salir sin guardar?",
        confirmLabel: "Sí, salir sin guardar",
        saveLabel: "Guardar",
        cancelLabel: "Cancelar",
        onConfirm: () => {
          setIsDailyLogDirty(false);
          setCurrentUser(null);
          localStorage.removeItem('disponibilidad_equipos_session');
          setActiveView('dashboard');
          addToast('Sesión cerrada con éxito', 'success');
        },
        onSave: () => {
          if (dailyLogRef.current) {
            dailyLogRef.current.saveCurrentTab()
              .then(() => {
                setIsDailyLogDirty(false);
                setCurrentUser(null);
                localStorage.removeItem('disponibilidad_equipos_session');
                setActiveView('dashboard');
                addToast('Sesión cerrada con éxito', 'success');
              })
              .catch(err => {
                console.error("Failed to save before logging out:", err);
              });
          }
        }
      });
      return;
    }
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
          ? <DailyLogView ref={dailyLogRef} fleet={fleet} addToast={addToast} onDirtyChange={setIsDailyLogDirty} /> 
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
        setActiveView={handleViewChange} 
        theme={theme} 
        setTheme={setTheme} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {renderView()}
      </main>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        saveLabel={confirmDialog.saveLabel}
        cancelLabel={confirmDialog.cancelLabel}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        onSave={confirmDialog.onSave ? () => {
          confirmDialog.onSave?.();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } : undefined}
        onCancel={() => {
          if (confirmDialog.onCancel) {
            confirmDialog.onCancel();
          }
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        variant={confirmDialog.variant}
      />
    </div>
  );
}

export default App;
