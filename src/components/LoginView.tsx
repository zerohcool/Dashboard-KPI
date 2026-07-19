import React, { useState } from 'react';
import logoBlanca from '../Logo Enaex Letra Blanca.png';
import logoGris from '../Logo Enaex Letra Gris.png';
import { dbService } from '../services/db';
import type { ContractUser } from '../services/db';
import { Sun, Moon, LogIn, ShieldAlert, UserCheck } from 'lucide-react';

interface LoginViewProps {
  onLogin: (user: ContractUser) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  addToast: (text: string, type: 'success' | 'error') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, theme, setTheme, addToast }) => {
  const [activeTab, setActiveTab] = useState<'usuario' | 'admin'>('usuario');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleGuestLogin = () => {
    const guestUser: ContractUser = {
      id: 'user-guest',
      username: 'usuario',
      name: 'Usuario',
      email: 'usuario@enaex.com',
      role: 'Usuario'
    };
    onLogin(guestUser);
    addToast('Sesión iniciada como Usuario', 'success');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Por favor ingrese su usuario y contraseña.');
      return;
    }

    const authenticated = dbService.authenticate(username.trim(), password.trim());
    if (authenticated) {
      onLogin(authenticated);
      addToast(`Bienvenido ${authenticated.name}`, 'success');
    } else {
      setErrorMsg('Usuario o contraseña incorrectos.');
      addToast('Credenciales incorrectas', 'error');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'var(--bg-main)',
      position: 'relative',
      overflow: 'hidden',
      padding: '20px'
    }}>
      {/* Background Glows */}
      <div className="glow-effect" style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        background: 'var(--glow-1)',
        filter: 'blur(120px)',
        borderRadius: '50%',
        zIndex: 0
      }}></div>
      <div className="glow-effect" style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '50vw',
        height: '50vw',
        background: 'var(--glow-2)',
        filter: 'blur(120px)',
        borderRadius: '50%',
        zIndex: 0
      }}></div>

      {/* Floating Theme Toggle */}
      <button 
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md)',
          zIndex: 10,
          transition: 'all 0.15s ease'
        }}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Main Login Card */}
      <div className="glass" style={{
        width: '100%',
        maxWidth: '440px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '40px 30px',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'slideIn 0.3s ease-out'
      }}>
        {/* Enaex Logo */}
        <img 
          src={theme === 'dark' ? logoBlanca : logoGris} 
          alt="Enaex Logo" 
          style={{ height: '40px', objectFit: 'contain', marginBottom: '12px' }}
        />
        
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '0.2px' }}>
            Planta Sierra Gorda
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Plataforma KPI de Disponibilidad y Contrato
          </p>
        </div>

        {/* Access Role Tabs */}
        <div style={{ 
          display: 'flex', 
          width: '100%', 
          background: 'var(--bg-main)', 
          borderRadius: '10px', 
          padding: '4px', 
          marginBottom: '24px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => { setActiveTab('usuario'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: activeTab === 'usuario' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'usuario' ? 'var(--primary-light)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'usuario' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Usuario
          </button>
          <button
            onClick={() => { setActiveTab('admin'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: activeTab === 'admin' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'admin' ? 'var(--primary-light)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'admin' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Administración
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'usuario' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ 
              background: 'var(--primary-glow)', 
              border: '1px solid var(--primary-light)', 
              padding: '16px', 
              borderRadius: '10px', 
              fontSize: '0.82rem', 
              lineHeight: '1.5',
              color: 'var(--text-primary)',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              Acceso con privilegios para visualizar el Dashboard de KPIs y Fórmulas del Contrato.
            </div>
            
            <button
              onClick={handleGuestLogin}
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              className="btn btn-primary"
            >
              <UserCheck size={18} />
              <span>Ingresar como Usuario</span>
            </button>
          </div>
        ) : (
          <form 
            onSubmit={handleAdminLogin} 
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}
          >
            {errorMsg && (
              <div style={{
                background: 'var(--color-mantencioncorrectiva-bg)',
                border: '1px solid var(--color-mantencioncorrectiva)',
                color: 'var(--color-mantencioncorrectiva)',
                fontSize: '0.8rem',
                padding: '10px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Usuario Administrador
              </label>
              <input 
                type="text" 
                placeholder="ej: andres.alquinta"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-input)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Contraseña
              </label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-input)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '8px'
              }}
              className="btn btn-primary"
            >
              <LogIn size={18} />
              <span>Ingresar como Administrador</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
