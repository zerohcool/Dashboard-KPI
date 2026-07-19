import React, { useState } from 'react';
import { LayoutDashboard, CalendarDays, Truck, FileText, Sun, Moon, HelpCircle } from 'lucide-react';
import logoBlanca from '../Logo Enaex Letra Blanca.png';
import logoGris from '../Logo Enaex Letra Gris.png';
import { dbService } from '../services/db';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, theme, setTheme }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const kpisList = dbService.getContractKPIs();
  
  const getWeight = (id: string) => kpisList.find(k => k.id === id)?.weight ?? 0;
  const getKpiMin = (id: string) => kpisList.find(k => k.id === id)?.minVal ?? '';
  const getKpiExpected = (id: string) => kpisList.find(k => k.id === id)?.expectedVal ?? '';
  const getKpiMax = (id: string) => kpisList.find(k => k.id === id)?.maxVal ?? '';

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

      <button className="theme-toggle-btn" onClick={() => setIsModalOpen(true)} style={{ marginTop: 'auto', marginBottom: '6px' }}>
        <HelpCircle size={15} />
        <span>Metodología de KPIs</span>
      </button>

      <button className="theme-toggle-btn" onClick={toggleTheme} style={{ marginTop: '0', marginBottom: '12px' }}>
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

      {isModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="glass modal-content" style={{
            width: '90%',
            maxWidth: '800px',
            maxHeight: '85vh',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-xl)',
            padding: '28px',
            color: 'var(--text-primary)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={22} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                  Metodología y Fórmulas de KPIs de Contrato
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: 'none',
                  color: 'var(--color-mantencioncorrectiva)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cerrar
              </button>
            </div>

            <div style={{ fontSize: '0.9rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ margin: 0, background: 'rgba(25, 118, 210, 0.08)', border: '1px solid rgba(25, 118, 210, 0.2)', padding: '12px 16px', borderRadius: '8px' }}>
                <strong>Resumen de Evaluación:</strong> Este sistema permite auditar de forma continua el cumplimiento del contrato de servicio de Enaex para la faena Sierra Gorda. Evalúa de manera ponderada la disponibilidad física y contractual de la flota, el stock diario de materias primas, la dotación semanal programada y los incidentes/desvíos SSMA.
              </div>

              <div>
                <h4 style={{ color: 'var(--primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  1. Disponibilidad de Flota y Materias Primas ({getWeight('kpi-camiones') + getWeight('kpi-cargadores') + getWeight('kpi-polvorines') + getWeight('kpi-insumos')}% peso total)
                </h4>
                <ul style={{ paddingLeft: '20px' }}>
                  <li><strong>Camiones Fábrica ({getWeight('kpi-camiones')}%):</strong> Meta: {getKpiMax('kpi-camiones')}.</li>
                  <li><strong>Cargadores Frontales ({getWeight('kpi-cargadores')}%):</strong> Meta: {getKpiMax('kpi-cargadores')}.</li>
                  <li><strong>Polvorines Móviles ({getWeight('kpi-polvorines')}%):</strong> Meta: {getKpiMax('kpi-polvorines')}.</li>
                  <li><strong>Materias Primas ({getWeight('kpi-insumos')}%):</strong> Meta: {getKpiExpected('kpi-insumos')} ton diaria (Mínimo contractual: {getKpiMin('kpi-insumos')} ton).</li>
                </ul>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', fontSize: '0.82rem', marginTop: '8px' }}>
                  <strong>Fórmulas de Cálculo:</strong><br />
                  • <em>Disponibilidad Física (DF):</em> <code>(24 - Horas Fuera de Servicio) / 24 * 100</code><br />
                  • <em>Disponibilidad Contractual (DC):</em> <code>(24 - (Horas Fuera de Servicio - Detención Post-Tronadura)) / 24 * 100</code> (Descuenta horas de bloqueo si hay tronada o se marca sin tronadura).<br />
                  • <em>Materias Primas:</em> promedio de cumplimiento diario: <code>(Stock real / {getKpiExpected('kpi-insumos')} * 100)</code> topado al 100%.
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--secondary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  2. Evaluación de Calidad de Servicio ({getWeight('kpi-innovacion') + getWeight('kpi-costos') + getWeight('kpi-horario-tronadura') + getWeight('kpi-programa-tronadura') + getWeight('kpi-p80') + getWeight('kpi-criterios-danio') + getWeight('kpi-tiros-quedados') + getWeight('kpi-ptq') + getWeight('kpi-flyrock') + getWeight('kpi-vod') + getWeight('kpi-gases')}% peso total)
                </h4>
                <p style={{ margin: '0 0 6px 0' }}>Se evalúan al cierre del período. Los 5 indicadores basados en eventos se calculan automáticamente ingresando su valor real:</p>
                <ul style={{ paddingLeft: '20px' }}>
                  <li><strong>Tiros Quedados (TQ) ({getWeight('kpi-tiros-quedados')}%):</strong> 0 = 100% cumplimiento | 1 o más = 0% cumplimiento.</li>
                  <li><strong>Benchmark PTQ ({getWeight('kpi-ptq')}%):</strong> ≤3 = 100% cumplimiento | 4 = 75% cumplimiento | ≥5 = 0% cumplimiento.</li>
                  <li><strong>Impacto por Flyrock ({getWeight('kpi-flyrock')}%):</strong> 0 = 100% cumplimiento | 1 o más = 0% cumplimiento.</li>
                  <li><strong>VOD en Productos ({getWeight('kpi-vod')}%):</strong> ≥8 = 100% | 6 a 7 = 75% | 4 a 5 = 50% | ≤3 = 0% cumplimiento.</li>
                  <li><strong>Gases Nitrosos ({getWeight('kpi-gases')}%):</strong> ≤1 evento = 100% cumplimiento | ≥2 eventos = 0% cumplimiento.</li>
                  <li><strong>Otros (Ingreso Directo):</strong> Innovación ({getWeight('kpi-innovacion')}%), Costos ({getWeight('kpi-costos')}%), Horario Tronadura ({getWeight('kpi-horario-tronadura')}%), Programa ({getWeight('kpi-programa-tronadura')}%), P80 ({getWeight('kpi-p80')}%), Criterios Daño ({getWeight('kpi-criterios-danio')}%).</li>
                </ul>
              </div>

              <div>
                <h4 style={{ color: 'var(--color-mantencionpreventiva)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  3. Evaluación de Dotación Semanal ({getWeight('kpi-dotacion-comprometida')}% peso total)
                </h4>
                <p style={{ margin: '0 0 6px 0' }}>Calculado del registro semanal programado (miércoles a martes):</p>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '6px', fontSize: '0.82rem' }}>
                  <strong>Reglas de exclusión:</strong><br />
                  • <em>Cargos Planta Enaex:</em> Si se desactiva "Afecta KPI", el cargo se excluye de toda estadística.<br />
                  • <em>Jornadas 4x3:</em> Se bloquean y excluyen los viernes, sábados y domingos (no restan asistencia).<br />
                  • <em>Fórmula de Asistencia:</em> <code>(Suma de Asistencia Real / Suma de Dotación Contractual Requerida) * 100</code>.
                </div>
              </div>

              <div>
                <h4 style={{ color: '#10b981', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                  4. Evaluación de Seguridad ({getWeight('kpi-seg-trirf') + getWeight('kpi-seg-notrirf') + getWeight('kpi-seg-legal') + getWeight('kpi-seg-auditorias') + getWeight('kpi-seg-incumplimiento')}% peso total)
                </h4>
                <ul style={{ paddingLeft: '20px' }}>
                  <li><strong>Incidentes TRIRF ({getWeight('kpi-seg-trirf')}%):</strong> 0 = 100% | 1 = 50% | ≥2 = 0% cumplimiento.</li>
                  <li><strong>Incidentes No TRIRF ({getWeight('kpi-seg-notrirf')}%):</strong> 0 = 100% | 1 = 75% | 2 = 50% | ≥3 = 0% cumplimiento.</li>
                  <li><strong>Cumplimiento Legal ({getWeight('kpi-seg-legal')}%):</strong> 0 = 100% | 1 = 75% | 2 = 50% | ≥3 = 0% cumplimiento.</li>
                  <li><strong>Auditorías ({getWeight('kpi-seg-auditorias')}%):</strong> Score ≥90% = 100% | ≥70% = 75% | ≥26% = 50% | &lt;26% = 0% cumplimiento.</li>
                  <li><strong>Incumplimiento SSMA ({getWeight('kpi-seg-incumplimiento')}%):</strong> 0 desvíos = 100% | 1-2 = 75% | 3-4 = 50% | ≥5 = 0% cumplimiento.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
