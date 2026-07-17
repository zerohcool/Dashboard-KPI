import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import type { ContractSettings, Equipment } from '../services/db';
import { getPluralType } from '../utils/calculations';
import { Save, AlertCircle, ShieldCheck } from 'lucide-react';

interface ContractConfigViewProps {
  fleet: Equipment[];
  onConfigChanged: () => void;
  addToast: (text: string, type: 'success' | 'error') => void;
}

export const ContractConfigView: React.FC<ContractConfigViewProps> = ({ fleet, onConfigChanged, addToast }) => {
  const [settings, setSettings] = useState<ContractSettings>({
    requiredFactoryTrucks: 5,
    requiredFrontLoaders: 2,
    requiredPowderKegs: 2,
    requiredPickups: 8
  });

  useEffect(() => {
    setSettings(dbService.getContractSettings());
  }, []);

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

    dbService.saveContractSettings(settings)
      .then(() => {
        addToast('Configuración de contrato guardada exitosamente.', 'success');
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

  // Fleet stats by type
  const countByType = (type: Equipment['type']) => fleet.filter(eq => eq.type === type).length;
  
  const stats = {
    factory: {
      registered: countByType('Camión Fábrica'),
      required: settings.requiredFactoryTrucks
    },
    loaders: {
      registered: countByType('Cargador Frontal'),
      required: settings.requiredFrontLoaders
    },
    powder: {
      registered: countByType('Polvorín Móvil'),
      required: settings.requiredPowderKegs
    },
    pickups: {
      registered: countByType('Camioneta'),
      required: settings.requiredPickups
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Configuración de Contrato</h1>
          <p>Estipule el número de vehículos requeridos obligatoriamente por el contrato de servicio</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="glass table-card">
          <h2 className="chart-title">Vehículos Exigidos por Contrato</h2>
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Factory Trucks */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Camiones Fábrica</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.factory.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Exigidos:</label>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Cargadores Frontales</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.loaders.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Exigidos:</label>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Polvorines Móviles</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.powder.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Exigidos:</label>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Camionetas</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrados en flota: <strong>{stats.pickups.registered}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Exigidos:</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.requiredPickups}
                    onChange={(e) => handleChange('requiredPickups', parseInt(e.target.value) || 0)}
                    style={{ width: '80px', textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} />
                  <span>Guardar Configuración</span>
                </button>
              </div>

            </div>
          </form>
        </div>

        <div className="glass table-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} className="text-secondary" /> Información del Contrato
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Esta configuración define las metas exigidas de horas por tipo de flota en el contrato de servicio. Las horas comprometidas diarias equivalen a la cantidad de vehículos exigidos por 12 horas operativas.
          </p>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.9rem' }}>Horas diarias comprometidas por categoría:</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <li>
                <strong>{getPluralType('Camión Fábrica')}:</strong> {settings.requiredFactoryTrucks} exigidos ({settings.requiredFactoryTrucks * 12} hrs comprometidas/día)
              </li>
              <li>
                <strong>{getPluralType('Cargador Frontal')}:</strong> {settings.requiredFrontLoaders} exigidos ({settings.requiredFrontLoaders * 12} hrs comprometidas/día)
              </li>
              <li>
                <strong>{getPluralType('Polvorín Móvil')}:</strong> {settings.requiredPowderKegs} exigidos ({settings.requiredPowderKegs * 12} hrs comprometidas/día)
              </li>
              <li>
                <strong>{getPluralType('Camioneta')}:</strong> {settings.requiredPickups} exigidos ({settings.requiredPickups * 12} hrs comprometidas/día)
              </li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: '10px', background: 'var(--primary-glow)', padding: '14px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: 'var(--primary)' }} />
            <div>
              <strong>Cálculo de Disponibilidad:</strong> La disponibilidad se calcula dividiendo las horas operativas entregadas por los equipos seleccionados en cada jornada sobre la cuota diaria comprometida, con un tope máximo del 100% por día.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
