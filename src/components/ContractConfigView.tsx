import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import type { ContractSettings, Equipment, ContractKPI, ContractRole } from '../services/db';
import { getPluralType } from '../utils/calculations';
import { Save, AlertCircle, ShieldCheck, Users, Percent, X } from 'lucide-react';

interface ContractConfigViewProps {
  fleet: Equipment[];
  onConfigChanged: () => void;
  addToast: (text: string, type: 'success' | 'error') => void;
}

const SAFETY_KPI_DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  'kpi-seg-trirf': {
    title: 'Incidentes que afectan al TRIRF (Accidentes de alto potencial / Incidentes Alto impacto)',
    desc: 'Fatal(FI) - Tiempo Perdido (LTI) - Tratamiento medico (MTI) - Trabajo Restringido (RWI) - Alto Potencial - Alto Impacto.'
  },
  'kpi-seg-notrirf': {
    title: 'Incidentes que no afectan al TRIRF',
    desc: 'Accidentes STP (FA) - Daños a equipos - Fallas Operacionales - Impactos Ambientales Significativos.'
  },
  'kpi-seg-legal': {
    title: 'Cumplimiento legal (fiscalizaciones estatales)',
    desc: 'Hallazgos o sumarios de Sernageomin, Ministerio de Salud, Dirección del trabajo, SUCESO, SMA u otro organismo gubernamental, así como también de los Organismo administrador de la Ley.'
  },
  'kpi-seg-auditorias': {
    title: 'Auditorías Internas',
    desc: 'Evaluaciones bajo lo esperado de auditorías que realice SGSCM de manera Interna o Externa.'
  },
  'kpi-seg-incumplimiento': {
    title: 'Incumplimiento de temas generales de salud, seguridad y medio ambiente',
    desc: 'No cumplimiento de los Planes y Programas informados a la compañía.\n• No entrega de estadística E-200.\n• No entregar los Avances y Control de Programas SSMA Empresas contratistas / SG-GSSM-FOR-010.\n• No participar en actividades relevantes de salud, seguridad y medio ambiente de la compañía: reuniones Cero Daño, Campañas de seguridad, CPHS de faena, DPRF, etc.'
  }
};

export const ContractConfigView: React.FC<ContractConfigViewProps> = ({ fleet, onConfigChanged, addToast }) => {
  const [settings, setSettings] = useState<ContractSettings>({
    requiredFactoryTrucks: 5,
    requiredFrontLoaders: 2,
    requiredPowderKegs: 2,
    requiredPickups: 8
  });

  const [kpis, setKpis] = useState<ContractKPI[]>([]);
  const [roles, setRoles] = useState<ContractRole[]>([]);
  const [hoveredKpiId, setHoveredKpiId] = useState<string | null>(null);

  // Add custom role form states
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCount, setNewRoleCount] = useState(1);
  const [newRoleAffects, setNewRoleAffects] = useState(true);

  useEffect(() => {
    setSettings(dbService.getContractSettings());
    setKpis(dbService.getContractKPIs());
    setRoles(dbService.getContractRoles());
  }, []);

  const handleAddRole = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      addToast('El nombre del cargo no puede estar vacío.', 'error');
      return;
    }
    if (roles.some(r => r.roleName.toLowerCase() === newRoleName.trim().toLowerCase())) {
      addToast('Este cargo ya existe.', 'error');
      return;
    }
    const newRole: ContractRole = {
      roleName: newRoleName.trim(),
      requiredCount: newRoleCount,
      affectsKPI: newRoleAffects
    };
    setRoles(prev => [...prev, newRole]);
    setNewRoleName('');
    setNewRoleCount(1);
    setNewRoleAffects(true);
    addToast('Cargo agregado. Guarde la configuración general para persistir.', 'success');
  };

  const handleDeleteRole = (roleName: string) => {
    setRoles(prev => prev.filter(r => r.roleName !== roleName));
    addToast('Cargo eliminado. Guarde la configuración general para persistir.', 'success');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations: Required numbers must be non-negative
    if (
      settings.requiredFactoryTrucks < 0 ||
      settings.requiredFrontLoaders < 0 ||
      settings.requiredPowderKegs < 0 ||
      settings.requiredPickups < 0
    ) {
      addToast('Las cantidades obligadas por contrato deben ser mayores o iguales a 0.', 'error');
      return;
    }

    // Role count validation
    for (const r of roles) {
      if (r.requiredCount < 0) {
        addToast('La dotación requerida de personal debe ser mayor o igual a 0.', 'error');
        return;
      }
    }

    // KPI weights validation
    for (const k of kpis) {
      if (k.weight < 0) {
        addToast('La ponderación de los KPIs debe ser mayor o igual a 0%.', 'error');
        return;
      }
    }

    Promise.all([
      dbService.saveContractSettings(settings),
      dbService.saveContractKPIs(kpis),
      dbService.saveContractRoles(roles)
    ])
      .then(() => {
        addToast('Configuración de contrato y KPIs guardada exitosamente.', 'success');
        onConfigChanged();
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar en Supabase.', 'error');
      });
  };

  const handleChange = (key: keyof ContractSettings, val: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleKPIChange = (id: string, field: keyof ContractKPI, val: any) => {
    setKpis(prev => prev.map(k => k.id === id ? { ...k, [field]: val } : k));
  };

  const handleRoleChange = (roleName: string, val: number) => {
    setRoles(prev => prev.map(r => r.roleName === roleName ? { ...r, requiredCount: val } : r));
  };

  // Fleet stats by type
  const countByType = (type: Equipment['type']) => fleet.filter(eq => eq.type === type).length;
  
  const stats = {
    factory: { registered: countByType('Camión Fábrica'), required: settings.requiredFactoryTrucks },
    loaders: { registered: countByType('Cargador Frontal'), required: settings.requiredFrontLoaders },
    powder: { registered: countByType('Polvorín Móvil'), required: settings.requiredPowderKegs },
    pickups: { registered: countByType('Camioneta'), required: settings.requiredPickups }
  };

  const kpisByCategory = {
    disponibilidad: kpis.filter(k => k.category === 'disponibilidad'),
    calidad: kpis.filter(k => k.category === 'calidad'),
    dotacion: kpis.filter(k => k.category === 'dotacion'),
    seguridad: kpis.filter(k => k.category === 'seguridad')
  };

  const totalWeightSum = kpis.reduce((acc, k) => acc + k.weight, 0);

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Configuración de Contrato y KPIs</h1>
          <p>Gestione los vehículos requeridos, dotación de personal y ponderaciones de KPIs del contrato de servicio</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Section 1: Fleet required */}
          <div className="glass table-card">
            <h2 className="chart-title">Vehículos Exigidos por Contrato</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Factory Trucks */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>Camiones Fábrica</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.factory.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Exigidos:</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.requiredFactoryTrucks}
                    onChange={(e) => handleChange('requiredFactoryTrucks', parseInt(e.target.value) || 0)}
                    style={{ width: '80px', textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* Front Loaders */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>Cargadores Frontales (Tapapozos)</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.loaders.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Exigidos:</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.requiredFrontLoaders}
                    onChange={(e) => handleChange('requiredFrontLoaders', parseInt(e.target.value) || 0)}
                    style={{ width: '80px', textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* Powder Kegs */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>Polvorines Móviles</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.powder.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Exigidos:</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.requiredPowderKegs}
                    onChange={(e) => handleChange('requiredPowderKegs', parseInt(e.target.value) || 0)}
                    style={{ width: '80px', textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* Pickups */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>Camionetas</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.pickups.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Exigidos:</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.requiredPickups}
                    onChange={(e) => handleChange('requiredPickups', parseInt(e.target.value) || 0)}
                    style={{ width: '80px', textAlign: 'center' }}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Section 2: Info */}
          <div className="glass table-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} className="text-secondary" /> Información del Contrato
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
              Esta configuración define las metas exigidas de horas por tipo de flota en el contrato de servicio. Las horas comprometidas diarias equivalen a la cantidad de vehículos exigidos por 12 horas operativas.
            </p>
            <div style={{ background: 'rgba(0, 0, 0, 0.02)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.85rem' }}>Horas diarias comprometidas por categoría:</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', padding: 0, margin: 0 }}>
                <li>
                  <strong>{getPluralType('Camión Fábrica')}:</strong> {settings.requiredFactoryTrucks} exigidos ({settings.requiredFactoryTrucks * 12} hrs/día)
                </li>
                <li>
                  <strong>{getPluralType('Cargador Frontal')}:</strong> {settings.requiredFrontLoaders} exigidos ({settings.requiredFrontLoaders * 12} hrs/día)
                </li>
                <li>
                  <strong>{getPluralType('Polvorín Móvil')}:</strong> {settings.requiredPowderKegs} exigidos ({settings.requiredPowderKegs * 12} hrs/día)
                </li>
                <li>
                  <strong>{getPluralType('Camioneta')}:</strong> {settings.requiredPickups} exigidos ({settings.requiredPickups * 12} hrs/día)
                </li>
              </ul>
            </div>
            
            {/* Warning sum of weights */}
            {totalWeightSum !== 100 ? (
              <div style={{ display: 'flex', gap: '10px', background: 'var(--color-mantencioncorrectiva-bg)', padding: '12px', borderRadius: '12px', color: 'var(--color-mantencioncorrectiva)', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Advertencia:</strong> La suma de las ponderaciones de los KPIs es <strong>{totalWeightSum}%</strong>. Debe ser exactamente <strong>100%</strong> para garantizar consistencia.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', background: 'var(--color-operativo-bg)', padding: '12px', borderRadius: '12px', color: 'var(--color-operativo)', fontSize: '0.85rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                <div>
                  Suma de ponderaciones de KPIs correcta (<strong>100%</strong>).
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Roles and Headcounts */}
        <div className="glass table-card" style={{ marginBottom: '24px' }}>
          <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} className="text-secondary" /> Dotación de Personal Operativo
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '-8px' }}>
            Defina y gestione la dotación del personal. Los cargos marcados como "Afecta KPI" serán evaluados para el cumplimiento del contrato. Los cargos extras no afectarán la nota final.
          </p>

          {/* Form to Add New Role */}
          <div style={{ 
            background: 'rgba(0,0,0,0.02)', 
            padding: '16px', 
            borderRadius: '12px', 
            marginBottom: '24px', 
            border: '1px dashed var(--border-color)', 
            display: 'flex', 
            gap: '16px', 
            alignItems: 'flex-end', 
            flexWrap: 'wrap' 
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Nombre del Cargo / Turno</label>
              <input 
                type="text" 
                placeholder="ej. Cargador Extra Enaex (7x7) o Supervisor (4x3)" 
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Dotación</label>
              <input 
                type="number" 
                min="0"
                value={newRoleCount}
                onChange={(e) => setNewRoleCount(parseInt(e.target.value) || 0)}
                style={{ padding: '8px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                id="affects-kpi-chk"
                checked={newRoleAffects}
                onChange={(e) => setNewRoleAffects(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="affects-kpi-chk" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600', color: 'var(--text-primary)' }}>Afecta KPI</label>
            </div>
            <button className="btn btn-secondary" onClick={handleAddRole} style={{ height: '38px', padding: '0 16px' }}>
              Agregar Cargo
            </button>
          </div>

          {/* List of Roles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {roles.map(r => (
              <div 
                key={r.roleName} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '8px', 
                  padding: '12px 14px', 
                  background: 'rgba(0,0,0,0.01)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '10px' 
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={r.roleName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setRoles(prev => prev.map(item => item.roleName === r.roleName ? { ...item, roleName: newName } : item));
                    }}
                    style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: '600', 
                      border: 'none', 
                      background: 'transparent',
                      flex: 1,
                      marginRight: '8px',
                      color: 'var(--text-primary)',
                      borderBottom: '1px solid transparent'
                    }}
                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary-light)'}
                    onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                  />
                  <button 
                    type="button"
                    onClick={() => handleDeleteRole(r.roleName)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--color-mantencioncorrectiva)', 
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Eliminar cargo"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      id={`chk-${r.roleName.replace(/\s+/g, '-')}`}
                      checked={r.affectsKPI ?? true}
                      onChange={(e) => {
                        const newVal = e.target.checked;
                        setRoles(prev => prev.map(item => item.roleName === r.roleName ? { ...item, affectsKPI: newVal } : item));
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <label 
                      htmlFor={`chk-${r.roleName.replace(/\s+/g, '-')}`} 
                      style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500' }}
                    >
                      Afecta KPI
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Requerido:</span>
                    <input
                      type="number"
                      min="0"
                      value={r.requiredCount}
                      onChange={(e) => handleRoleChange(r.roleName, parseInt(e.target.value) || 0)}
                      style={{ width: '60px', textAlign: 'center', padding: '4px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: KPIs Weighting Tables */}
        <div className="glass table-card" style={{ marginBottom: '24px' }}>
          <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Percent size={20} className="text-secondary" /> Ponderación y Parámetros de KPIs de Contrato
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '-8px' }}>
            Configure el peso e intervalos de rendimiento (Mínimo, Esperado, Máximo) para cada elemento de la evaluación contractual.
          </p>

          {/* Table: Disponibilidad */}
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)' }}>
            1. Tabla de Disponibilidad de Equipos y Materias Primas
          </h3>
          <div className="table-wrapper" style={{ marginBottom: '24px' }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre KPI</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Ponderación</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Medición</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Periodicidad</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Mínimo</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Esperado</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Máximo</th>
                </tr>
              </thead>
              <tbody>
                {kpisByCategory.disponibilidad.map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{k.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          value={k.weight}
                          onChange={(e) => handleKPIChange(k.id, 'weight', parseFloat(e.target.value) || 0)}
                          style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.unit} onChange={(e) => handleKPIChange(k.id, 'unit', e.target.value)} style={{ width: '70px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.periodicity} onChange={(e) => handleKPIChange(k.id, 'periodicity', e.target.value)} style={{ width: '80px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.minVal} onChange={(e) => handleKPIChange(k.id, 'minVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.expectedVal} onChange={(e) => handleKPIChange(k.id, 'expectedVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.maxVal} onChange={(e) => handleKPIChange(k.id, 'maxVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table: Calidad de Servicio */}
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)' }}>
            2. Tabla de Calidad de Servicio
          </h3>
          <div className="table-wrapper" style={{ marginBottom: '24px' }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre KPI</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Ponderación</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Medición</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Periodicidad</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Mínimo</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Esperado</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Máximo</th>
                </tr>
              </thead>
              <tbody>
                {kpisByCategory.calidad.map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{k.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          value={k.weight}
                          onChange={(e) => handleKPIChange(k.id, 'weight', parseFloat(e.target.value) || 0)}
                          style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.unit} onChange={(e) => handleKPIChange(k.id, 'unit', e.target.value)} style={{ width: '70px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.periodicity} onChange={(e) => handleKPIChange(k.id, 'periodicity', e.target.value)} style={{ width: '80px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.minVal} onChange={(e) => handleKPIChange(k.id, 'minVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.expectedVal} onChange={(e) => handleKPIChange(k.id, 'expectedVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.maxVal} onChange={(e) => handleKPIChange(k.id, 'maxVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table: Dotación */}
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)', marginTop: '24px' }}>
            3. Tabla de Dotación
          </h3>
          <div className="table-wrapper" style={{ marginBottom: '24px' }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre KPI</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Ponderación</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Medición</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Periodicidad</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Mínimo</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Esperado</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Máximo</th>
                </tr>
              </thead>
              <tbody>
                {kpisByCategory.dotacion.map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{k.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          value={k.weight}
                          onChange={(e) => handleKPIChange(k.id, 'weight', parseFloat(e.target.value) || 0)}
                          style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.unit} onChange={(e) => handleKPIChange(k.id, 'unit', e.target.value)} style={{ width: '70px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.periodicity} onChange={(e) => handleKPIChange(k.id, 'periodicity', e.target.value)} style={{ width: '80px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.minVal} onChange={(e) => handleKPIChange(k.id, 'minVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.expectedVal} onChange={(e) => handleKPIChange(k.id, 'expectedVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.maxVal} onChange={(e) => handleKPIChange(k.id, 'maxVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table: Seguridad */}
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)', marginTop: '24px' }}>
            4. Tabla de Seguridad
          </h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre KPI</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Ponderación</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Medición</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Periodicidad</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Mínimo</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Esperado</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Máximo</th>
                </tr>
              </thead>
              <tbody>
                {kpisByCategory.seguridad.map(k => {
                  const tooltipData = SAFETY_KPI_DESCRIPTIONS[k.id];
                  return (
                    <tr key={k.id}>
                      <td 
                        style={{ fontWeight: '600', fontSize: '0.85rem', position: 'relative' }}
                        onMouseEnter={() => setHoveredKpiId(k.id)}
                        onMouseLeave={() => setHoveredKpiId(null)}
                      >
                        <span style={{ borderBottom: '1px dotted var(--primary)', cursor: 'help' }}>
                          {k.name}
                        </span>
                        {hoveredKpiId === k.id && tooltipData && (
                          <div className="glass" style={{
                            position: 'absolute',
                            left: '100%',
                            top: '0',
                            marginLeft: '12px',
                            width: '340px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: 'var(--shadow-xl)',
                            padding: '12px',
                            zIndex: 100,
                            pointerEvents: 'none',
                            textAlign: 'left'
                          }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)' }}>
                              {tooltipData.title}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                              {tooltipData.desc}
                            </p>
                          </div>
                        )}
                      </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          value={k.weight}
                          onChange={(e) => handleKPIChange(k.id, 'weight', parseFloat(e.target.value) || 0)}
                          style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.unit} onChange={(e) => handleKPIChange(k.id, 'unit', e.target.value)} style={{ width: '70px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.periodicity} onChange={(e) => handleKPIChange(k.id, 'periodicity', e.target.value)} style={{ width: '80px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.minVal} onChange={(e) => handleKPIChange(k.id, 'minVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.expectedVal} onChange={(e) => handleKPIChange(k.id, 'expectedVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                    <td style={{ textAlign: 'center' }}><input type="text" value={k.maxVal} onChange={(e) => handleKPIChange(k.id, 'maxVal', e.target.value)} style={{ width: '90px', textAlign: 'center', padding: '4px' }} /></td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

        </div>

        {/* Global Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button type="submit" className="btn btn-primary btn-lg" style={{ padding: '14px 28px' }}>
            <Save size={20} />
            <span>Guardar Configuración General de Contrato</span>
          </button>
        </div>

      </form>
    </div>
  );
};
