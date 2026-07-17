import React, { useState, useEffect } from 'react';
import { dbService, parseBlastingTimeToDecimal } from '../services/db';
import type { Equipment, AvailabilityRecord } from '../services/db';
import { getPluralType } from '../utils/calculations';
import { Save, AlertCircle, Copy } from 'lucide-react';

const getStatusClass = (status: string) => {
  return status
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
};

interface DailyLogViewProps {
  fleet: Equipment[];
  addToast: (text: string, type: 'success' | 'error') => void;
}

interface FormRecordState {
  equipmentId: string;
  status: AvailabilityRecord['status'];
  startHour: number;
  endHour: number;
  comment: string;
}

export const DailyLogView: React.FC<DailyLogViewProps> = ({ fleet, addToast }) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formState, setFormState] = useState<Record<string, FormRecordState>>({});
  const [selectedEqIds, setSelectedEqIds] = useState<Set<string>>(new Set());
  const [blastingTime, setBlastingTime] = useState<string>('19:00');
  const [showEqSelector, setShowEqSelector] = useState<boolean>(false);

  // Load blasting time on date change
  useEffect(() => {
    const dailyBlasting = dbService.getBlastingTimeForDate(selectedDate);
    setBlastingTime(dailyBlasting);
  }, [selectedDate]);

  // Load records for selected date
  useEffect(() => {
    const existing = dbService.getAvailabilityForDate(selectedDate);
    const selectedIds = new Set<string>();
    const initialState: Record<string, FormRecordState> = {};
    
    if (existing.length > 0) {
      existing.forEach(r => {
        if (fleet.some(eq => eq.id === r.equipmentId)) {
          selectedIds.add(r.equipmentId);
          initialState[r.equipmentId] = {
            equipmentId: r.equipmentId,
            status: r.status,
            startHour: r.startHour !== undefined ? r.startHour : 7,
            endHour: r.endHour !== undefined ? r.endHour : 7,
            comment: r.comment || ''
          };
        }
      });
    } else {
      // New day: select all registered equipments in fleet by default
      fleet.forEach(eq => {
        selectedIds.add(eq.id);
        initialState[eq.id] = {
          equipmentId: eq.id,
          status: 'Operativo',
          startHour: 7,
          endHour: 7,
          comment: ''
        };
      });
    }

    setSelectedEqIds(selectedIds);
    setFormState(initialState);
  }, [selectedDate, fleet]);

  const handleToggleEquipment = (eqId: string) => {
    setSelectedEqIds(prev => {
      const next = new Set(prev);
      if (next.has(eqId)) {
        next.delete(eqId);
        setFormState(prevForm => {
          const nextForm = { ...prevForm };
          delete nextForm[eqId];
          return nextForm;
        });
      } else {
        next.add(eqId);
        setFormState(prevForm => ({
          ...prevForm,
          [eqId]: {
            equipmentId: eqId,
            status: 'Operativo',
            startHour: 7,
            endHour: 7,
            comment: ''
          }
        }));
      }
      return next;
    });
  };

  const handleSelectAllEquipments = () => {
    const allIds = new Set(fleet.map(e => e.id));
    setSelectedEqIds(allIds);
    setFormState(prev => {
      const nextForm = { ...prev };
      fleet.forEach(eq => {
        if (!nextForm[eq.id]) {
          nextForm[eq.id] = {
            equipmentId: eq.id,
            status: 'Operativo',
            startHour: 7,
            endHour: 7,
            comment: ''
          };
        }
      });
      return nextForm;
    });
  };

  const handleSelectNoneEquipments = () => {
    setSelectedEqIds(new Set());
    setFormState({});
  };

  const handleStatusChange = (eqId: string, status: AvailabilityRecord['status']) => {
    setFormState(prev => {
      const currentRecord = prev[eqId];
      let startHour = 7;
      let endHour = 7;
      if (status !== 'Operativo') {
        startHour = currentRecord?.startHour !== 7 ? currentRecord?.startHour || 7 : 8;
        endHour = currentRecord?.endHour !== 7 ? currentRecord?.endHour || 12 : 12;
      }
      const comment = status === 'Operativo' ? '' : currentRecord?.comment || '';
      
      return {
        ...prev,
        [eqId]: {
          ...currentRecord,
          status,
          startHour,
          endHour,
          comment
        }
      };
    });
  };

  const handleStartHourChange = (eqId: string, hour: number) => {
    setFormState(prev => {
      const currentRecord = prev[eqId];
      const newStart = Math.min(19, Math.max(7, hour));
      const newEnd = Math.max(newStart, currentRecord.endHour);
      return {
        ...prev,
        [eqId]: {
          ...currentRecord,
          startHour: newStart,
          endHour: newEnd
        }
      };
    });
  };

  const handleEndHourChange = (eqId: string, hour: number) => {
    setFormState(prev => {
      const currentRecord = prev[eqId];
      const newEnd = Math.min(19, Math.max(7, hour));
      const newStart = Math.min(newEnd, currentRecord.startHour);
      return {
        ...prev,
        [eqId]: {
          ...currentRecord,
          startHour: newStart,
          endHour: newEnd
        }
      };
    });
  };

  const handleCommentChange = (eqId: string, comment: string) => {
    setFormState(prev => ({
      ...prev,
      [eqId]: {
        ...prev[eqId],
        comment
      }
    }));
  };

  const handleSave = () => {
    const recordsToSave = Object.values(formState).filter(r => selectedEqIds.has(r.equipmentId));
    
    const invalidRecords = recordsToSave.filter(r => {
      return r.status !== 'Operativo' && r.endHour - r.startHour <= 0;
    });

    if (invalidRecords.length > 0) {
      addToast('Los equipos fuera de servicio deben tener un rango de horas válido (Término > Inicio).', 'error');
      return;
    }

    // Check if there are existing records saved for this date
    const existingRecords = dbService.getAvailabilityForDate(selectedDate);
    if (existingRecords.length > 0) {
      const confirmOverwrite = window.confirm(
        `¿Está seguro de sobreescribir los registros existentes para el día ${selectedDate}?`
      );
      if (!confirmOverwrite) {
        return;
      }
    }

    dbService.saveBlastingTimeForDate(selectedDate, blastingTime);
    dbService.saveAvailabilityRecords(selectedDate, recordsToSave);
    addToast(`Registro del día ${selectedDate} guardado exitosamente.`, 'success');
  };

  const copyFromPreviousDay = () => {
    const prevDate = new Date(selectedDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const prevRecords = dbService.getAvailabilityForDate(prevDateStr);

    if (prevRecords.length === 0) {
      addToast(`No existen registros para el día anterior (${prevDateStr}).`, 'error');
      return;
    }

    const selectedIds = new Set<string>();
    setFormState(prev => {
      const newState = { ...prev };
      fleet.forEach(eq => {
        const prevRec = prevRecords.find(r => r.equipmentId === eq.id);
        if (prevRec) {
          selectedIds.add(eq.id);
          newState[eq.id] = {
            equipmentId: eq.id,
            status: prevRec.status,
            startHour: prevRec.startHour !== undefined ? prevRec.startHour : 7,
            endHour: prevRec.endHour !== undefined ? prevRec.endHour : 7,
            comment: prevRec.comment || ''
          };
        }
      });
      return newState;
    });

    setSelectedEqIds(selectedIds);
    const prevBlasting = dbService.getBlastingTimeForDate(prevDateStr);
    setBlastingTime(prevBlasting);

    addToast(`Equipos activos, datos y hora de tronadura copiados del día ${prevDateStr}. Recuerde guardar.`, 'success');
  };

  const handleBlastingTimeChange = (val: string) => {
    setBlastingTime(val);
  };

  const types: Equipment['type'][] = ['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil', 'Camioneta'];
  const hoursList = Array.from({ length: 13 }, (_, i) => i + 7);

  const getAvailHours = (state: FormRecordState, bTime: string) => {
    if (state.status === 'Operativo') return 12;
    const totalDown = state.endHour - state.startHour;
    const blastingTimeDec = parseBlastingTimeToDecimal(bTime);
    const postBlastingDown = Math.max(0, state.endHour - Math.max(state.startHour, blastingTimeDec));
    const effectiveDown = totalDown - postBlastingDown;
    return parseFloat((12 - effectiveDown).toFixed(2));
  };

  const blastingHour = parseInt(blastingTime.split(':')[0], 10) || 19;
  const blastingMin = parseInt(blastingTime.split(':')[1], 10) || 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Registro Diario de Disponibilidad</h1>
          <p>Régimen operativo diario de 12 horas (07:00 am a 19:00 hrs)</p>
        </div>
        <div className="actions-group">
          <button className="btn btn-secondary" onClick={copyFromPreviousDay}>
            <Copy size={16} />
            <span>Copiar de ayer</span>
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} />
            <span>Guardar Registro</span>
          </button>
        </div>
      </div>

      <div className="glass filter-bar" style={{ gap: '24px' }}>
        <div className="filter-group">
          <span className="filter-label">Fecha de Registro</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            style={{ width: '180px' }}
          />
        </div>
        
        <div className="filter-group">
          <span className="filter-label">Hora de Tronadura del Día (24 hrs)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={blastingHour}
              onChange={(e) => {
                const h = parseInt(e.target.value, 10);
                const hStr = h < 10 ? `0${h}` : `${h}`;
                const mStr = blastingMin < 10 ? `0${blastingMin}` : `${blastingMin}`;
                handleBlastingTimeChange(`${hStr}:${mStr}`);
              }}
              style={{ width: '70px', fontWeight: 'bold', padding: '8px' }}
            >
              {Array.from({ length: 13 }, (_, i) => i + 7).map(h => (
                <option key={h} value={h}>{h < 10 ? `0${h}` : `${h}`}</option>
              ))}
            </select>
            <span style={{ fontWeight: 'bold' }}>:</span>
            <select
              value={blastingMin}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10);
                const hStr = blastingHour < 10 ? `0${blastingHour}` : `${blastingHour}`;
                const mStr = m < 10 ? `0${m}` : `${m}`;
                handleBlastingTimeChange(`${hStr}:${mStr}`);
              }}
              style={{ width: '75px', fontWeight: 'bold', padding: '8px' }}
            >
              {Array.from({ length: 60 }, (_, i) => i).map(m => (
                <option key={m} value={m}>{m < 10 ? `0${m}` : `${m}`}</option>
              ))}
            </select>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', marginLeft: '2px', color: 'var(--text-secondary)' }}>hrs</span>
          </div>
        </div>

        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => setShowEqSelector(!showEqSelector)}
          style={{ marginLeft: '12px', alignSelf: 'flex-end', height: '40px' }}
        >
          {showEqSelector ? 'Ocultar Selector de Equipos' : 'Seleccionar Equipos del Día'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-mantencioncorrectiva)' }} />
          <span>Las indisponibilidades ocurridas después de la hora de tronadura del día ({blastingTime} hrs) no restan disponibilidad.</span>
        </div>
      </div>

      {/* Equipment Selector Panel */}
      {showEqSelector && (
        <div className="glass table-card" style={{ marginBottom: '24px', padding: '20px', animation: 'slideIn 0.15s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="chart-title" style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Equipos Operando en esta Fecha ({selectedEqIds.size} de {fleet.length})
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleSelectAllEquipments}>Seleccionar Todos</button>
              <button className="btn btn-secondary btn-sm" onClick={handleSelectNoneEquipments}>Ninguno</button>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Desmarque los equipos que no estuvieron programados/operando en este turno. Los equipos no seleccionados no sumarán horas, afectando la disponibilidad.
          </p>
          
          {/* Checkboxes grouped by type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {types.map(t => {
              const typeFleet = fleet.filter(eq => eq.type === t);
              if (typeFleet.length === 0) return null;
              return (
                <div key={t}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    {getPluralType(t)}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {typeFleet.map(eq => {
                      const isChecked = selectedEqIds.has(eq.id);
                      return (
                        <label 
                          key={eq.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            fontSize: '0.85rem', 
                            fontWeight: '500',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            background: isChecked ? 'rgba(79, 70, 229, 0.05)' : 'none',
                            border: `1px solid ${isChecked ? 'var(--primary-light)' : 'var(--border-color)'}`,
                            borderRadius: '8px',
                            transition: 'all 0.15s ease',
                            userSelect: 'none'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEquipment(eq.id)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <span>{eq.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {types.map(type => {
        const typeEquipments = fleet.filter(eq => eq.type === type && selectedEqIds.has(eq.id));
        if (typeEquipments.length === 0) return null;

        return (
          <div key={type} className="glass table-card" style={{ marginBottom: '24px' }}>
            <h2 className="chart-title" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              {getPluralType(type)}
            </h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Patente</th>
                    <th>Estado Operativo</th>
                    <th style={{ textAlign: 'center' }}>Hora Inicio</th>
                    <th style={{ textAlign: 'center' }}>Hora Término</th>
                    <th style={{ textAlign: 'center' }}>Horas Disponibles</th>
                    <th>Comentario / Detalle de Falla</th>
                  </tr>
                </thead>
                <tbody>
                  {typeEquipments.map(eq => {
                    const state = formState[eq.id] || {
                      equipmentId: eq.id,
                      status: 'Operativo',
                      startHour: 7,
                      endHour: 7,
                      comment: ''
                    };

                    const availHours = getAvailHours(state, blastingTime);

                    return (
                      <tr key={eq.id}>
                        <td style={{ fontWeight: '600' }}>{eq.name}</td>
                        <td><code>{eq.patent || '-'}</code></td>
                        <td>
                          <select
                            value={state.status}
                            onChange={(e) => handleStatusChange(eq.id, e.target.value as any)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              borderLeft: `4px solid var(--color-${getStatusClass(state.status)})`
                            }}
                          >
                            <option value="Operativo">Operativo</option>
                            <option value="Mantención Programada">Mantención Programada</option>
                            <option value="Mantención Preventiva">Mantención Preventiva</option>
                            <option value="Mantención Predictiva">Mantención Predictiva</option>
                            <option value="Mantención Correctiva">Mantención Correctiva</option>
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <select
                            value={state.startHour}
                            onChange={(e) => handleStartHourChange(eq.id, parseInt(e.target.value) || 7)}
                            disabled={state.status === 'Operativo'}
                            style={{
                              padding: '6px',
                              fontSize: '0.85rem',
                              opacity: state.status === 'Operativo' ? 0.3 : 1,
                              width: '100px'
                            }}
                          >
                            {hoursList.map(h => (
                              <option key={h} value={h}>{h < 10 ? `0${h}:00` : `${h}:00`}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <select
                            value={state.endHour}
                            onChange={(e) => handleEndHourChange(eq.id, parseInt(e.target.value) || 7)}
                            disabled={state.status === 'Operativo'}
                            style={{
                              padding: '6px',
                              fontSize: '0.85rem',
                              opacity: state.status === 'Operativo' ? 0.3 : 1,
                              width: '100px'
                            }}
                          >
                            {hoursList.map(h => (
                              <option key={h} value={h} disabled={h < state.startHour}>{h < 10 ? `0${h}:00` : `${h}:00`}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          <span style={{ color: availHours === 12 ? 'var(--color-operativo)' : availHours === 0 ? 'var(--color-mantencioncorrectiva)' : 'var(--color-mantencionprogramada)' }}>
                            {availHours} hrs
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder={state.status === 'Operativo' ? 'N/A' : 'Escriba causa de la falla...'}
                            value={state.comment}
                            onChange={(e) => handleCommentChange(eq.id, e.target.value)}
                            disabled={state.status === 'Operativo'}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: '0.85rem',
                              opacity: state.status === 'Operativo' ? 0.3 : 1
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {selectedEqIds.size === 0 && (
        <div className="glass table-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            No se han seleccionado equipos operando para este día. Haga clic en <strong>"Seleccionar Equipos del Día"</strong> en la barra superior para agregarlos.
          </p>
        </div>
      )}
    </div>
  );
};
