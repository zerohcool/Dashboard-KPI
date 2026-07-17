import React, { useState, useEffect } from 'react';
import { 
  dbService, parseBlastingTimeToDecimal, getWednesdayStartDate 
} from '../services/db';
import type { 
  Equipment, AvailabilityRecord, ContractKPI, ContractRole
} from '../services/db';
import { getPluralType } from '../utils/calculations';
import { Save, AlertCircle, Copy, Truck, Layers, Settings, Users, Calendar } from 'lucide-react';

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
  
  // Tabs State
  const [activeSubTab, setActiveSubTab] = useState<'equipos' | 'insumos' | 'calidad' | 'dotacion'>('equipos');

  // Tab 1: Equipments State
  const [formState, setFormState] = useState<Record<string, FormRecordState>>({});
  const [selectedEqIds, setSelectedEqIds] = useState<Set<string>>(new Set());
  const [blastingTime, setBlastingTime] = useState<string>('19:00');
  const [showEqSelector, setShowEqSelector] = useState<boolean>(false);

  // Tab 2: Raw Materials State
  const [nitratoStock, setNitratoStock] = useState<number>(200);
  const [matrizStock, setMatrizStock] = useState<number>(200);

  // Tab 3: Service Quality State
  const [qualityKpis, setQualityKpis] = useState<ContractKPI[]>([]);
  const [qualityCompliance, setQualityCompliance] = useState<Record<string, number>>({});

  // Tab 4: Weekly Roster/Attendance State
  const [activeWeekStart, setActiveWeekStart] = useState<string>('');
  const [roles, setRoles] = useState<ContractRole[]>([]);
  const [weeklyRoster, setWeeklyRoster] = useState<Record<string, number[]>>({});

  // Load blasting time & raw materials & quality compliance on date change
  useEffect(() => {
    const dailyBlasting = dbService.getBlastingTimeForDate(selectedDate);
    setBlastingTime(dailyBlasting);

    const raw = dbService.getRawMaterialsForDate(selectedDate);
    setNitratoStock(raw.nitratoStock);
    setMatrizStock(raw.matrizStock);

    const qualityList = dbService.getContractKPIs().filter(k => k.category === 'calidad');
    setQualityKpis(qualityList);

    const existingQual = dbService.getQualityComplianceForDate(selectedDate);
    const initialQualMap: Record<string, number> = {};
    qualityList.forEach(k => {
      const found = existingQual.find(q => q.kpiId === k.id);
      initialQualMap[k.id] = found ? found.compliancePct : 100.0; // default 100%
    });
    setQualityCompliance(initialQualMap);

    // Sync week start date to matching date
    setActiveWeekStart(getWednesdayStartDate(selectedDate));
  }, [selectedDate]);

  // Load roster data when weekStartDate changes
  useEffect(() => {
    if (!activeWeekStart) return;
    const contractRoles = dbService.getContractRoles();
    setRoles(contractRoles);

    const existingAtt = dbService.getWeeklyAttendance(activeWeekStart);
    const initialRoster: Record<string, number[]> = {};
    contractRoles.forEach(r => {
      initialRoster[r.roleName] = existingAtt.attendanceData[r.roleName]
        ? [...existingAtt.attendanceData[r.roleName]]
        : Array(7).fill(r.requiredCount);
    });
    setWeeklyRoster(initialRoster);
  }, [activeWeekStart]);

  // Load records for selected date (Equipments)
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
      } else {
        next.add(eqId);
      }
      return next;
    });
  };

  const handleSelectAllEquipments = () => {
    setSelectedEqIds(new Set(fleet.map(eq => eq.id)));
  };

  const handleSelectNoneEquipments = () => {
    setSelectedEqIds(new Set());
  };

  const handleStatusChange = (eqId: string, status: AvailabilityRecord['status']) => {
    setFormState(prev => ({
      ...prev,
      [eqId]: {
        ...prev[eqId],
        status,
        startHour: status === 'Operativo' ? 7 : prev[eqId].startHour,
        endHour: status === 'Operativo' ? 7 : prev[eqId].endHour,
        comment: status === 'Operativo' ? '' : prev[eqId].comment
      }
    }));
  };

  const handleStartHourChange = (eqId: string, startHour: number) => {
    setFormState(prev => {
      const current = prev[eqId];
      const newEnd = current.endHour < startHour ? startHour : current.endHour;
      return {
        ...prev,
        [eqId]: {
          ...current,
          startHour,
          endHour: newEnd
        }
      };
    });
  };

  const handleEndHourChange = (eqId: string, endHour: number) => {
    setFormState(prev => {
      const current = prev[eqId];
      const newStart = current.startHour > endHour ? endHour : current.startHour;
      return {
        ...prev,
        [eqId]: {
          ...current,
          startHour: newStart,
          endHour
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

  const handleQualityCompChange = (kpiId: string, val: number) => {
    setQualityCompliance(prev => ({
      ...prev,
      [kpiId]: Math.min(100, Math.max(0, val))
    }));
  };

  const handleRosterCellChange = (roleName: string, dayIdx: number, val: number) => {
    setWeeklyRoster(prev => {
      const arr = [...(prev[roleName] || Array(7).fill(0))];
      arr[dayIdx] = Math.max(0, val);
      return {
        ...prev,
        [roleName]: arr
      };
    });
  };

  // Save Daily Records (Availability, Raw Materials, Quality compliance)
  const handleSaveDaily = () => {
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
    const existingRaw = dbService.getRawMaterials().some(r => r.date === selectedDate);
    
    if (existingRecords.length > 0 || existingRaw) {
      const confirmOverwrite = window.confirm(
        `¿Está seguro de sobreescribir los registros existentes para el día ${selectedDate}?`
      );
      if (!confirmOverwrite) {
        return;
      }
    }

    // Save parallel promises
    const promises: Promise<any>[] = [
      dbService.saveBlastingTimeForDate(selectedDate, blastingTime),
      dbService.saveAvailabilityRecords(selectedDate, recordsToSave),
      dbService.saveRawMaterialsForDate(selectedDate, nitratoStock, matrizStock)
    ];

    // Save quality compliance values
    Object.keys(qualityCompliance).forEach(kpiId => {
      promises.push(
        dbService.saveQualityComplianceForDate(selectedDate, kpiId, qualityCompliance[kpiId])
      );
    });

    Promise.all(promises)
      .then(() => {
        addToast(`Registro del día ${selectedDate} guardado exitosamente.`, 'success');
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar datos en Supabase.', 'error');
      });
  };

  // Save Weekly Attendance Roster
  const handleSaveWeeklyRoster = () => {
    dbService.saveWeeklyAttendance(activeWeekStart, weeklyRoster)
      .then(() => {
        addToast(`Asistencia de la semana del ${activeWeekStart} guardada exitosamente.`, 'success');
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar asistencia en Supabase.', 'error');
      });
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

    const prevRaw = dbService.getRawMaterialsForDate(prevDateStr);
    setNitratoStock(prevRaw.nitratoStock);
    setMatrizStock(prevRaw.matrizStock);

    addToast(`Datos de equipos, stock de insumos y hora de tronadura copiados de ayer. Recuerde guardar.`, 'success');
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

  // Generate week dates labels (Wednesday to Tuesday)
  const getWeekDates = (startStr: string) => {
    if (!startStr) return [];
    const datesList = [];
    const d = new Date(startStr + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const temp = new Date(d);
      temp.setDate(d.getDate() + i);
      datesList.push({
        dayName: temp.toLocaleDateString('es-ES', { weekday: 'short' }),
        dateStr: temp.toISOString().split('T')[0],
        shortLabel: temp.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
      });
    }
    return datesList;
  };

  const weekDays = getWeekDates(activeWeekStart);

  return (
    <div>
      {/* Header section */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div className="page-title-group">
          <h1>Registro de Operaciones Diarias</h1>
          <p>Seleccione la fecha de registro y cargue los parámetros diarios e insumos</p>
        </div>
        <div className="actions-group">
          {activeSubTab !== 'dotacion' && (
            <>
              <button className="btn btn-secondary" onClick={copyFromPreviousDay}>
                <Copy size={16} />
                <span>Copiar de ayer</span>
              </button>
              <button className="btn btn-primary" onClick={handleSaveDaily}>
                <Save size={16} />
                <span>Guardar Registro Diario</span>
              </button>
            </>
          )}
          {activeSubTab === 'dotacion' && (
            <button className="btn btn-primary" onClick={handleSaveWeeklyRoster}>
              <Save size={16} />
              <span>Guardar Asistencia Semanal</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Selector Row */}
      <div className="glass filter-bar" style={{ gap: '24px', marginBottom: '20px' }}>
        <div className="filter-group">
          <span className="filter-label">Fecha del Registro</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            style={{ width: '180px' }}
          />
        </div>

        {activeSubTab === 'equipos' && (
          <>
            <div className="filter-group">
              <span className="filter-label">Hora de Tronadura (24 hrs)</span>
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
                  {hoursList.map(h => (
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
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>hrs</span>
              </div>
            </div>

            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setShowEqSelector(!showEqSelector)}
              style={{ alignSelf: 'flex-end', height: '40px' }}
            >
              {showEqSelector ? 'Ocultar Selector de Equipos' : 'Seleccionar Equipos del Día'}
            </button>
          </>
        )}

        {activeSubTab === 'dotacion' && (
          <div className="filter-group">
            <span className="filter-label">Turno Semanal Activo (Miércoles a Martes)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} className="text-secondary" />
              <strong style={{ fontSize: '0.9rem' }}>Semana del miércoles {activeWeekStart} al martes {weekDays[6]?.dateStr}</strong>
            </div>
          </div>
        )}

        {activeSubTab === 'equipos' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <AlertCircle size={16} style={{ color: 'var(--color-mantencioncorrectiva)' }} />
            <span>Fallas después de tronadura ({blastingTime} hrs) no restan disponibilidad.</span>
          </div>
        )}
      </div>

      {/* Tabs Menu Navigation */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: '4px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveSubTab('equipos')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeSubTab === 'equipos' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'equipos' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Truck size={16} />
          <span>1. Disponibilidad de Equipos</span>
        </button>

        <button 
          onClick={() => setActiveSubTab('insumos')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeSubTab === 'insumos' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'insumos' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={16} />
          <span>2. Stock de Insumos (Materias Primas)</span>
        </button>

        <button 
          onClick={() => setActiveSubTab('calidad')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeSubTab === 'calidad' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'calidad' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Settings size={16} />
          <span>3. Calidad de Servicio (KPIs Manuales)</span>
        </button>

        <button 
          onClick={() => setActiveSubTab('dotacion')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeSubTab === 'dotacion' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'dotacion' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={16} />
          <span>4. Roster de Dotación (Semanal)</span>
        </button>
      </div>

      {/* TAB 1: EQUIPOS CONTENT */}
      {activeSubTab === 'equipos' && (
        <>
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
        </>
      )}

      {/* TAB 2: INSUMOS CONTENT */}
      {activeSubTab === 'insumos' && (
        <div className="glass table-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 className="chart-title">Inventario Diario de Materias Primas</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '-8px' }}>
            Ingrese el stock disponible para hoy de los insumos principales del contrato.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Nitrato */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Nitrato de Amonio</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mínimo establecido por contrato: <strong>200 ton</strong></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="0"
                  value={nitratoStock}
                  onChange={(e) => setNitratoStock(parseFloat(e.target.value) || 0)}
                  style={{ width: '120px', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>ton</span>
              </div>
            </div>

            {/* Matriz */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Matriz</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mínimo establecido por contrato: <strong>200 ton</strong></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min="0"
                  value={matrizStock}
                  onChange={(e) => setMatrizStock(parseFloat(e.target.value) || 0)}
                  style={{ width: '120px', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>ton</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--primary-glow)', padding: '14px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '20px' }}>
            <AlertCircle size={20} style={{ float: 'left', marginRight: '8px', color: 'var(--primary)' }} />
            <span>
              <strong>Cálculo de Disponibilidad de Insumos:</strong> Si el stock diario es igual o superior al mínimo (200 ton), el cumplimiento es del 100%. De lo contrario, se calcula proporcionalmente (ej. 170 ton = 85% de cumplimiento).
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={handleSaveDaily}>
              <Save size={16} />
              <span>Guardar Registro Diario</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: CALIDAD DE SERVICIO CONTENT */}
      {activeSubTab === 'calidad' && (
        <div className="glass table-card">
          <h2 className="chart-title">Cumplimiento Calidad de Servicio</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '-8px' }}>
            Ingrese manualmente el porcentaje de cumplimiento para cada uno de los criterios del contrato de servicio para la fecha seleccionada.
          </p>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre del KPI de Calidad</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Mínimo</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Esperado</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Máximo</th>
                  <th style={{ width: '200px', textAlign: 'center' }}>% Cumplimiento Actual</th>
                </tr>
              </thead>
              <tbody>
                {qualityKpis.map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{k.name}</td>
                    <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.minVal}</td>
                    <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.expectedVal}</td>
                    <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.maxVal}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={qualityCompliance[k.id] ?? 100}
                          onChange={(e) => handleQualityCompChange(k.id, parseFloat(e.target.value) || 0)}
                          style={{ width: '80px', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={handleSaveDaily}>
              <Save size={16} />
              <span>Guardar Registro Diario</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: ROSTER DE DOTACION CONTENT */}
      {activeSubTab === 'dotacion' && (
        <div className="glass table-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h2 className="chart-title" style={{ margin: 0 }}>Asistencia Semanal de Turnos</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
                Registre diariamente la cantidad de personal que asistió a sus turnos para cada cargo. El ciclo es de <strong>miércoles a martes</strong>.
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleSaveWeeklyRoster}>
              <Save size={16} />
              <span>Guardar Asistencia Semanal</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cargo / Función</th>
                  <th style={{ width: '100px', textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}>Exigida (Contrato)</th>
                  {weekDays.map((d) => (
                    <th key={d.dateStr} style={{ textAlign: 'center', width: '110px' }}>
                      <div style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{d.dayName}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{d.shortLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map(r => {
                  const arr = weeklyRoster[r.roleName] || Array(7).fill(r.requiredCount);
                  return (
                    <tr key={r.roleName}>
                      <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{r.roleName}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', background: 'rgba(0,0,0,0.02)', color: 'var(--text-secondary)' }}>
                        {r.requiredCount} pers
                      </td>
                      {arr.map((val, idx) => (
                        <td key={idx} style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            value={val}
                            onChange={(e) => handleRosterCellChange(r.roleName, idx, parseInt(e.target.value) || 0)}
                            style={{ 
                              width: '60px', 
                              padding: '6px', 
                              textAlign: 'center',
                              border: val < r.requiredCount ? '1px solid var(--color-mantencioncorrectiva)' : '1px solid var(--border-color)',
                              background: val < r.requiredCount ? 'var(--color-mantencioncorrectiva-bg)' : 'none',
                              color: val < r.requiredCount ? 'var(--color-mantencioncorrectiva)' : 'inherit',
                              fontWeight: '600'
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '10px', background: 'var(--primary-glow)', padding: '14px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '20px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: 'var(--primary)' }} />
            <div>
              <strong>Indicador de Alerta:</strong> Los campos de asistencia diaria se marcarán en **rojo** si la asistencia ingresada es menor al personal teórico exigido por contrato para esa función, permitiendo identificar faltas de personal instantáneamente.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
