import React, { useState, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { 
  dbService, getWednesdayStartDate, getRoleShiftType 
} from '../services/db';
import type { 
  Equipment, AvailabilityRecord, ContractRole 
} from '../services/db';
import { getPluralType } from '../utils/calculations';
import { Save, AlertCircle, Copy, Truck, Layers, Users, Calendar, CheckCircle2 } from 'lucide-react';
import { DatePicker, getShiftForDate } from './DatePicker';
import { ConfirmDialog } from './ConfirmDialog';

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
  onDirtyChange?: (isDirty: boolean) => void;
  syncVersion?: number;
}

interface FormRecordState {
  equipmentId: string;
  status: AvailabilityRecord['status'];
  startHour: number;
  endHour: number;
  comment: string;
}

export const DailyLogView = React.forwardRef<{ saveCurrentTab: () => Promise<void> }, DailyLogViewProps>(({ fleet, addToast, onDirtyChange, syncVersion }, ref) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Tabs State (Phase 17: removed 'calidad')
  const [activeSubTab, setActiveSubTab] = useState<'equipos' | 'insumos' | 'dotacion'>('equipos');

  // Tab 1: Equipments State
  const [formState, setFormState] = useState<Record<string, FormRecordState>>({});
  const [selectedEqIds, setSelectedEqIds] = useState<Set<string>>(new Set());
  const [blastingTime, setBlastingTime] = useState<string>('19:00');
  const [blastingObservations, setBlastingObservations] = useState<string>('');
  const [isNoBlasting, setIsNoBlasting] = useState<boolean>(false);
  const [showEqSelector, setShowEqSelector] = useState<boolean>(false);

  // Tab 2: Raw Materials State
  const [nitratoStock, setNitratoStock] = useState<number>(200);
  const [matrizStock, setMatrizStock] = useState<number>(200);

  // Tab 3: Weekly Roster/Attendance State
  const [activeWeekStart, setActiveWeekStart] = useState<string>('');
  const [roles, setRoles] = useState<ContractRole[]>([]);
  const [weeklyRoster, setWeeklyRoster] = useState<Record<string, number[]>>({});
  const [weeklyComments, setWeeklyComments] = useState<Record<string, string>>({});

  // Dirty States for Unsaved Changes prompts
  const [isEquipmentsDirty, setIsEquipmentsDirty] = useState<boolean>(false);
  const [isRawMaterialsDirty, setIsRawMaterialsDirty] = useState<boolean>(false);
  const [isRosterDirty, setIsRosterDirty] = useState<boolean>(false);

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

  // State for missing dates tracking and dropdown
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number>(0);
  const [showPendingMenu, setShowPendingMenu] = useState<boolean>(false);
  const pendingMenuRef = useRef<HTMLDivElement>(null);

  // Status indicators for current selectedDate
  const isDateEquipmentsSaved = useMemo(() => {
    return dbService.hasAvailabilityForDate(selectedDate);
  }, [selectedDate, lastSavedTimestamp, syncVersion]);

  const isDateRawMaterialsSaved = useMemo(() => {
    return dbService.hasRawMaterialsForDate(selectedDate);
  }, [selectedDate, lastSavedTimestamp, syncVersion]);

  const isWeekRosterSaved = useMemo(() => {
    return dbService.hasWeeklyAttendance(activeWeekStart);
  }, [activeWeekStart, lastSavedTimestamp, syncVersion]);

  const savedEquipmentsCount = useMemo(() => {
    return dbService.getAvailabilityForDate(selectedDate).length;
  }, [selectedDate, lastSavedTimestamp, syncVersion]);

  // Close pending menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pendingMenuRef.current && !pendingMenuRef.current.contains(event.target as Node)) {
        setShowPendingMenu(false);
      }
    };
    if (showPendingMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPendingMenu]);

  // Compute missing operational daily records for the viewed month
  const missingDaysInfo = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const parts = selectedDate.split('-');
    const year = parseInt(parts[0], 10) || today.getFullYear();
    const monthIndex = parseInt(parts[1], 10) - 1; // 0-indexed

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthName = monthNames[monthIndex] || '';

    const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const allRecords = dbService.getAllRecords();
    const datesWithEquipments = new Set(allRecords.map(r => r.date));
    const allRaw = dbService.getRawMaterials();
    const datesWithRaw = new Set(allRaw.map(r => r.date));

    const missing: { 
      dateStr: string; 
      dayNum: number; 
      formatted: string; 
      detail: string;
      missingEquipments: boolean;
      missingRaw: boolean;
    }[] = [];

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dayFormatted = String(d).padStart(2, '0');
      const monthFormatted = String(monthIndex + 1).padStart(2, '0');
      const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;

      // Do not consider future dates as pending
      if (dateStr > todayStr) {
        continue;
      }

      const hasEq = datesWithEquipments.has(dateStr);
      const hasRaw = datesWithRaw.has(dateStr);

      if (!hasEq || !hasRaw) {
        const dObj = new Date(year, monthIndex, d);
        const dayOfWeek = dObj.toLocaleDateString('es-ES', { weekday: 'short' });

        let detail = 'Faltan Equipos y Materias Primas';
        if (hasEq && !hasRaw) {
          detail = 'Falta Stock de Materias Primas';
        } else if (!hasEq && hasRaw) {
          detail = 'Falta Disponibilidad de Equipos';
        }

        missing.push({
          dateStr,
          dayNum: d,
          formatted: `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)} ${d} de ${monthName}`,
          detail,
          missingEquipments: !hasEq,
          missingRaw: !hasRaw
        });
      }
    }

    return {
      missingDates: missing,
      monthName,
      year,
      count: missing.length,
      isCurrentMonth: (year === today.getFullYear() && monthIndex === today.getMonth())
    };
  }, [selectedDate, lastSavedTimestamp, syncVersion]);

  const anyDirty = isEquipmentsDirty || isRawMaterialsDirty || isRosterDirty;

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(anyDirty);
    }
  }, [anyDirty, onDirtyChange]);

  useImperativeHandle(ref, () => ({
    saveCurrentTab: async () => {
      if (activeSubTab === 'dotacion') {
        await handleSaveWeeklyRoster();
      } else if (activeSubTab === 'insumos') {
        await handleSaveRawMaterials();
      } else {
        await handleSaveEquipments();
      }
    }
  }));

  const checkDirtyAndProceed = (proceed: () => void, tab: 'equipos' | 'insumos' | 'dotacion' | 'all') => {
    let dirty = false;
    let message = "Tiene cambios sin guardar en esta sección. ¿Desea salir sin guardar?";
    let title = "Cambios sin guardar";

    if (tab === 'equipos' && isEquipmentsDirty) {
      dirty = true;
      message = "Tiene cambios sin guardar en Disponibilidad de Equipos. ¿Desea salir sin guardar?";
    } else if (tab === 'insumos' && isRawMaterialsDirty) {
      dirty = true;
      message = "Tiene cambios sin guardar en Stock de Materias Primas. ¿Desea salir sin guardar?";
    } else if (tab === 'dotacion' && isRosterDirty) {
      dirty = true;
      message = "Tiene cambios sin guardar en Disponibilidad de Dotación. ¿Desea salir sin guardar?";
    } else if (tab === 'all' && anyDirty) {
      dirty = true;
      if (isEquipmentsDirty) message = "Tiene cambios sin guardar en Disponibilidad de Equipos. ¿Desea cambiar de fecha sin guardar?";
      else if (isRawMaterialsDirty) message = "Tiene cambios sin guardar en Stock de Materias Primas. ¿Desea cambiar de fecha sin guardar?";
      else if (isRosterDirty) message = "Tiene cambios sin guardar en Disponibilidad de Dotación. ¿Desea cambiar de fecha sin guardar?";
    }

    if (dirty) {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        confirmLabel: "Sí, salir sin guardar",
        saveLabel: "Guardar",
        cancelLabel: "Cancelar",
        onConfirm: () => {
          if (tab === 'equipos' || tab === 'all') setIsEquipmentsDirty(false);
          if (tab === 'insumos' || tab === 'all') setIsRawMaterialsDirty(false);
          if (tab === 'dotacion' || tab === 'all') setIsRosterDirty(false);
          proceed();
        },
        onSave: () => {
          if (tab === 'dotacion') {
            handleSaveWeeklyRoster().then(() => {
              proceed();
            });
          } else if (tab === 'insumos') {
            handleSaveRawMaterials().then(() => {
              proceed();
            });
          } else if (tab === 'equipos') {
            handleSaveEquipments().then(() => {
              proceed();
            });
          } else {
            const promises: Promise<any>[] = [];
            if (isEquipmentsDirty) promises.push(executeSaveEquipments());
            if (isRawMaterialsDirty) promises.push(executeSaveRawMaterials());
            if (isRosterDirty) promises.push(handleSaveWeeklyRoster());
            Promise.all(promises).then(() => {
              proceed();
            });
          }
        }
      });
      return;
    }
    
    proceed();
  };

  const handleSubTabChange = (newTab: 'equipos' | 'insumos' | 'dotacion') => {
    checkDirtyAndProceed(() => {
      setActiveSubTab(newTab);
    }, activeSubTab);
  };

  const handleDateChange = (newDate: string) => {
    checkDirtyAndProceed(() => {
      setSelectedDate(newDate);
      setIsEquipmentsDirty(false);
      setIsRawMaterialsDirty(false);
      setIsRosterDirty(false);
    }, 'all');
  };

  // Load blasting time & raw materials on date change or sync
  useEffect(() => {
    const dailyBlasting = dbService.getBlastingTimeForDate(selectedDate);
    setBlastingTime(dailyBlasting);
    setIsNoBlasting(dailyBlasting === '07:00');

    const dailyObs = dbService.getBlastingObservationsForDate(selectedDate);
    setBlastingObservations(dailyObs);

    const raw = dbService.getRawMaterialsForDate(selectedDate);
    setNitratoStock(raw.nitratoStock);
    setMatrizStock(raw.matrizStock);

    // Sync week start date to matching date
    setActiveWeekStart(getWednesdayStartDate(selectedDate));
  }, [selectedDate, syncVersion, lastSavedTimestamp]);

  // Load roster data when weekStartDate changes or sync
  useEffect(() => {
    if (!activeWeekStart) return;
    const contractRoles = dbService.getContractRoles();
    setRoles(contractRoles);

    const existingAtt = dbService.getWeeklyAttendance(activeWeekStart);
    const initialRoster: Record<string, number[]> = {};
    const initialComments: Record<string, string> = {};

    contractRoles.forEach(r => {
      const shift = getRoleShiftType(r.roleName);
      const requiredDaily = shift === '7x7' ? r.requiredCount / 2 : r.requiredCount;
      
      const defaultArray = Array(7).fill(requiredDaily);
      if (shift === '4x3') {
        defaultArray[2] = 0; // Friday
        defaultArray[3] = 0; // Saturday
        defaultArray[4] = 0; // Sunday
      }

      initialRoster[r.roleName] = existingAtt.attendanceData[r.roleName]
        ? [...existingAtt.attendanceData[r.roleName]]
        : defaultArray;

      // Force 0 for 4x3 rest days for compatibility with old saved weekly logs
      if (shift === '4x3' && initialRoster[r.roleName]) {
        initialRoster[r.roleName][2] = 0;
        initialRoster[r.roleName][3] = 0;
        initialRoster[r.roleName][4] = 0;
      }

      // Load comments from existing weekly attendance
      initialComments[r.roleName] = (existingAtt.comments && existingAtt.comments[r.roleName])
        ? existingAtt.comments[r.roleName]
        : '';
    });
    setWeeklyRoster(initialRoster);
    setWeeklyComments(initialComments);
  }, [activeWeekStart, syncVersion, lastSavedTimestamp]);

  // Load records for selected date (Equipments)
  useEffect(() => {
    const existing = dbService.getAvailabilityForDate(selectedDate);
    const selectedIds = new Set<string>();
    const initialState: Record<string, FormRecordState> = {};
    
    // Always initialize default status for all fleet equipment
    fleet.forEach(eq => {
      initialState[eq.id] = {
        equipmentId: eq.id,
        status: 'Operativo',
        startHour: 7,
        endHour: 7,
        comment: ''
      };
    });

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
      // Default: select all fleet if no record exists for this date
      fleet.forEach(eq => {
        selectedIds.add(eq.id);
      });
    }

    setSelectedEqIds(selectedIds);
    setFormState(initialState);
  }, [selectedDate, fleet, syncVersion, lastSavedTimestamp]);

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
    setIsEquipmentsDirty(true);
  };

  const handleSelectAllEquipments = () => {
    setSelectedEqIds(new Set(fleet.map(eq => eq.id)));
    setIsEquipmentsDirty(true);
  };

  const handleSelectNoneEquipments = () => {
    setSelectedEqIds(new Set());
    setIsEquipmentsDirty(true);
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
    setIsEquipmentsDirty(true);
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
    setIsEquipmentsDirty(true);
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
    setIsEquipmentsDirty(true);
  };

  const handleCommentChange = (eqId: string, comment: string) => {
    setFormState(prev => ({
      ...prev,
      [eqId]: {
        ...prev[eqId],
        comment
      }
    }));
    setIsEquipmentsDirty(true);
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
    setIsRosterDirty(true);
  };

  // 1. Save Equipments & Blasting Time
  const executeSaveEquipments = () => {
    const recordsToSave = Object.values(formState).filter(r => selectedEqIds.has(r.equipmentId));
    const promises: Promise<any>[] = [
      dbService.saveBlastingTimeForDate(selectedDate, blastingTime, blastingObservations),
      dbService.saveAvailabilityRecords(selectedDate, recordsToSave)
    ];

    return Promise.all(promises)
      .then(() => {
        addToast(`Disponibilidad de equipos para el día ${selectedDate} guardada exitosamente.`, 'success');
        setIsEquipmentsDirty(false);
        setLastSavedTimestamp(Date.now());
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar datos de equipos en Supabase.', 'error');
        throw err;
      });
  };

  const handleSaveEquipments = (): Promise<void> => {
    const recordsToSave = Object.values(formState).filter(r => selectedEqIds.has(r.equipmentId));
    
    const invalidRecords = recordsToSave.filter(r => {
      return r.status !== 'Operativo' && r.endHour - r.startHour <= 0;
    });

    if (invalidRecords.length > 0) {
      addToast('Los equipos fuera de servicio deben tener un rango de horas válido (Término > Inicio).', 'error');
      return Promise.reject('Invalid records');
    }

    if (dbService.hasAvailabilityForDate(selectedDate)) {
      return new Promise<void>((resolve, reject) => {
        setConfirmDialog({
          isOpen: true,
          title: "Sobreescribir registros de equipos",
          message: `¿Está seguro de sobreescribir la disponibilidad de equipos existente para el día ${selectedDate}?`,
          confirmLabel: "Sobreescribir",
          cancelLabel: "Cancelar",
          variant: 'danger',
          onConfirm: () => {
            executeSaveEquipments().then(resolve).catch(reject);
          },
          onCancel: () => {
            reject('Cancelled by user');
          }
        });
      });
    }

    return executeSaveEquipments();
  };

  // 2. Save Raw Materials
  const executeSaveRawMaterials = () => {
    return dbService.saveRawMaterialsForDate(selectedDate, nitratoStock, matrizStock)
      .then(() => {
        addToast(`Stock de materias primas para el día ${selectedDate} guardado exitosamente.`, 'success');
        setIsRawMaterialsDirty(false);
        setLastSavedTimestamp(Date.now());
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar stock de materias primas en Supabase.', 'error');
        throw err;
      });
  };

  const handleSaveRawMaterials = (): Promise<void> => {
    if (dbService.hasRawMaterialsForDate(selectedDate)) {
      return new Promise<void>((resolve, reject) => {
        setConfirmDialog({
          isOpen: true,
          title: "Sobreescribir stock de materias primas",
          message: `¿Está seguro de sobreescribir el stock de materias primas existente para el día ${selectedDate}?`,
          confirmLabel: "Sobreescribir",
          cancelLabel: "Cancelar",
          variant: 'danger',
          onConfirm: () => {
            executeSaveRawMaterials().then(resolve).catch(reject);
          },
          onCancel: () => {
            reject('Cancelled by user');
          }
        });
      });
    }

    return executeSaveRawMaterials();
  };

  // 3. Save Both (Equipments + Raw Materials) if needed
  const executeSaveDaily = () => {
    return Promise.all([
      executeSaveEquipments(),
      executeSaveRawMaterials()
    ]).then(() => {});
  };

  const handleSaveDaily = (): Promise<void> => {
    return executeSaveDaily();
  };

  // 4. Save Weekly Attendance Roster
  const handleSaveWeeklyRoster = (): Promise<void> => {
    return dbService.saveWeeklyAttendance(activeWeekStart, weeklyRoster, weeklyComments)
      .then(() => {
        addToast(`Asistencia de la semana del ${activeWeekStart} guardada exitosamente.`, 'success');
        setIsRosterDirty(false);
        setLastSavedTimestamp(Date.now());
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar asistencia en Supabase.', 'error');
        throw err;
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
    setIsNoBlasting(prevBlasting === '07:00');

    const prevObs = dbService.getBlastingObservationsForDate(prevDateStr);
    setBlastingObservations(prevObs);

    const prevRaw = dbService.getRawMaterialsForDate(prevDateStr);
    setNitratoStock(prevRaw.nitratoStock);
    setMatrizStock(prevRaw.matrizStock);

    setIsEquipmentsDirty(true);
    setIsRawMaterialsDirty(true);

    addToast(`Datos de equipos, stock de materias primas y hora de tronadura copiados de ayer. Recuerde guardar.`, 'success');
  };

  const handleBlastingTimeChange = (val: string) => {
    setBlastingTime(val);
  };

  const types: Equipment['type'][] = ['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil', 'Camioneta'];
  const hoursList = Array.from({ length: 13 }, (_, i) => i + 7);

  const getAvailHours = (state: FormRecordState) => {
    if (state.status === 'Operativo') return 12;
    const totalDown = Math.max(0, state.endHour - state.startHour);
    return parseFloat(Math.max(0, 12 - totalDown).toFixed(2));
  };

  const formatDateDMY = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const formatFullDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const blastingHour = parseInt(blastingTime.split(':')[0], 10) || 19;
  const blastingMin = parseInt(blastingTime.split(':')[1], 10) || 0;

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
  const activeWeekEnd = weekDays.length > 0 ? weekDays[weekDays.length - 1].dateStr : '';

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div className="page-title-group">
          <h1>Registro de Operaciones Diarias</h1>
          <p>Seleccione la fecha de registro y cargue los parámetros diarios y materias primas</p>
        </div>
        <div className="actions-group">
          {activeSubTab === 'equipos' && (
            <>
              <button className="btn btn-secondary" onClick={copyFromPreviousDay}>
                <Copy size={16} />
                <span>Copiar de ayer</span>
              </button>
              <button className="btn btn-primary" onClick={handleSaveEquipments}>
                <Save size={16} />
                <span>Guardar Disponibilidad de Equipos</span>
              </button>
            </>
          )}
          {activeSubTab === 'insumos' && (
            <>
              <button className="btn btn-secondary" onClick={copyFromPreviousDay}>
                <Copy size={16} />
                <span>Copiar de ayer</span>
              </button>
              <button className="btn btn-primary" onClick={handleSaveRawMaterials}>
                <Save size={16} />
                <span>Guardar Stock de Materias Primas</span>
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

      {/* Banner de Estado de Registros Diarios (Opción 3) */}
      {missingDaysInfo.count > 0 ? (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            marginBottom: '18px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: 'var(--text-primary)',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '34px', 
              height: '34px', 
              borderRadius: '8px', 
              background: 'rgba(245, 158, 11, 0.18)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#f59e0b',
              flexShrink: 0
            }}>
              <AlertCircle size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {missingDaysInfo.count === 1 
                  ? `Falta 1 día sin registrar en ${missingDaysInfo.monthName} ${missingDaysInfo.year}`
                  : `Faltan ${missingDaysInfo.count} días sin registrar en ${missingDaysInfo.monthName} ${missingDaysInfo.year}`}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Fechas pendientes: {missingDaysInfo.missingDates.slice(0, 6).map(m => m.dayNum).join(', ')}
                {missingDaysInfo.missingDates.length > 6 ? ` y ${missingDaysInfo.missingDates.length - 6} más...` : ''}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleDateChange(missingDaysInfo.missingDates[0].dateStr)}
            style={{
              borderColor: 'rgba(245, 158, 11, 0.5)',
              color: '#f59e0b',
              fontWeight: '600',
              padding: '6px 14px',
              fontSize: '0.82rem'
            }}
          >
            Completar primer día ({missingDaysInfo.missingDates[0].dateStr.split('-').reverse().join('/')}) →
          </button>
        </div>
      ) : (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            marginBottom: '18px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '8px', 
            background: 'rgba(16, 185, 129, 0.15)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#10b981',
            flexShrink: 0
          }}>
            <CheckCircle2 size={16} />
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
            ✓ Todos los registros de {missingDaysInfo.monthName} {missingDaysInfo.year} se encuentran al día hasta la fecha.
          </span>
        </div>
      )}

      {/* Date Selector Card with Permanent Inline Calendar */}
      <div 
        className="glass table-card" 
        style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          gap: '24px', 
          alignItems: 'flex-start', 
          padding: '20px', 
          marginBottom: '24px',
          position: 'relative', 
          zIndex: 90,
          flexWrap: 'wrap'
        }}
      >
        {/* Columna Izquierda: Calendario Inline Permanente */}
        <div style={{ flexShrink: 0, width: '290px' }}>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="filter-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={13} style={{ color: 'var(--primary)' }} />
              {activeSubTab === 'dotacion' ? 'Seleccionar Semana' : 'Seleccionar Fecha'}
            </span>
            {activeSubTab === 'dotacion' && (
              <span style={{ fontSize: '0.72rem', color: '#0066ff', fontWeight: '600' }}>
                Turno Miér - Mart
              </span>
            )}
          </div>
          <DatePicker
            inline={true}
            value={selectedDate}
            onChange={(val) => handleDateChange(val)}
            max={new Date().toISOString().split('T')[0]}
            rangeStart={activeSubTab === 'dotacion' ? activeWeekStart : undefined}
            rangeEnd={activeSubTab === 'dotacion' ? activeWeekEnd : undefined}
            style={{ width: '100%' }}
          />
        </div>

        {/* Columna Derecha: Información y Controles */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Fila superior: Fecha / Turno Activo y Estado del Mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span className="filter-label" style={{ display: 'block', marginBottom: '4px' }}>
                {activeSubTab === 'dotacion' ? 'Turno Semanal Activo' : 'Fecha de Registro Activa'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {activeSubTab === 'dotacion' ? (
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Semana del {formatDateDMY(activeWeekStart)} al {formatDateDMY(activeWeekEnd)}
                  </div>
                ) : (
                  <div style={{ fontSize: '1.12rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                    {formatFullDate(selectedDate)}
                  </div>
                )}

                {/* Badge Turno A / B */}
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    background: getShiftForDate(selectedDate) === 'A' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                    color: getShiftForDate(selectedDate) === 'A' ? '#2563eb' : '#d97706',
                    border: getShiftForDate(selectedDate) === 'A' ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid rgba(217, 119, 6, 0.3)'
                  }}
                  title={`Semana correspondiente al Turno ${getShiftForDate(selectedDate)}`}
                >
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: getShiftForDate(selectedDate) === 'A' ? '#2563eb' : '#d97706'
                  }} />
                  Turno {getShiftForDate(selectedDate)}
                </span>
              </div>
            </div>

            {/* Acceso Rápido a Días Pendientes (Opción 2) */}
            <div ref={pendingMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowPendingMenu(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: missingDaysInfo.count > 0 
                    ? '1px solid rgba(245, 158, 11, 0.4)' 
                    : '1px solid rgba(16, 185, 129, 0.3)',
                  background: missingDaysInfo.count > 0 
                    ? 'rgba(245, 158, 11, 0.08)' 
                    : 'rgba(16, 185, 129, 0.08)',
                  color: missingDaysInfo.count > 0 ? '#f59e0b' : '#10b981',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {missingDaysInfo.count > 0 ? (
                  <>
                    <AlertCircle size={15} />
                    <span>{missingDaysInfo.count} {missingDaysInfo.count === 1 ? 'Día Pendiente' : 'Días Pendientes'}</span>
                    <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>▼</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Mes al día</span>
                  </>
                )}
              </button>

              {/* Menú desplegable de fechas pendientes */}
              {showPendingMenu && missingDaysInfo.count > 0 && (
                <div
                  className="glass table-card"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 1000,
                    width: '320px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    padding: '12px',
                    borderRadius: '12px',
                    boxShadow: '0 10px 30px -5px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.15s ease-out'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>DÍAS SIN REGISTRO</span>
                    <span>{missingDaysInfo.count} en total</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {missingDaysInfo.missingDates.map(m => (
                      <button
                        key={m.dateStr}
                        type="button"
                        onClick={() => {
                          setShowPendingMenu(false);
                          handleDateChange(m.dateStr);
                          if (m.missingEquipments) {
                            handleSubTabChange('equipos');
                          } else if (m.missingRaw) {
                            handleSubTabChange('insumos');
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: m.dateStr === selectedDate ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = m.dateStr === selectedDate ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)'}
                      >
                        <div>
                          <div style={{ fontWeight: '600', textTransform: 'capitalize' }}>{m.formatted}</div>
                          <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '2px' }}>
                            {m.detail}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '700' }}>Cargar →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fila de Badges de Estado del Registro */}
          <div>
            <span className="filter-label" style={{ display: 'block', marginBottom: '6px' }}>
              Estado del Día Seleccionado ({formatDateDMY(selectedDate)})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Equipos badge */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '600',
                background: isDateEquipmentsSaved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                color: isDateEquipmentsSaved ? '#10b981' : '#ef4444',
                border: isDateEquipmentsSaved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)'
              }}>
                {isDateEquipmentsSaved ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>Equipos: {isDateEquipmentsSaved ? `Guardado (${savedEquipmentsCount})` : 'Sin registrar'}</span>
              </span>

              {/* Materias Primas badge */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '600',
                background: isDateRawMaterialsSaved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                color: isDateRawMaterialsSaved ? '#10b981' : '#ef4444',
                border: isDateRawMaterialsSaved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)'
              }}>
                {isDateRawMaterialsSaved ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>Materias Primas: {isDateRawMaterialsSaved ? 'Guardado' : 'Sin registrar'}</span>
              </span>

              {/* Dotación Semanal badge */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '600',
                background: isWeekRosterSaved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                color: isWeekRosterSaved ? '#10b981' : '#f59e0b',
                border: isWeekRosterSaved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.25)'
              }}>
                {isWeekRosterSaved ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>Semana Dotación: {isWeekRosterSaved ? 'Guardada' : 'Pendiente'}</span>
              </span>
            </div>
          </div>

          {/* Controles contextuales según subtab activa */}
          {activeSubTab === 'equipos' && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-color)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-end', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '12px' 
              }}>
                <div className="filter-group">
                  <span className="filter-label">Hora de Tronadura (24 hrs)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <select
                      disabled={isNoBlasting}
                      value={blastingHour}
                      onChange={(e) => {
                        const h = parseInt(e.target.value, 10);
                        const hStr = h < 10 ? `0${h}` : `${h}`;
                        const mStr = blastingMin < 10 ? `0${blastingMin}` : `${blastingMin}`;
                        handleBlastingTimeChange(`${hStr}:${mStr}`);
                      }}
                      style={{ width: '70px', fontWeight: 'bold', padding: '8px', opacity: isNoBlasting ? 0.6 : 1, cursor: isNoBlasting ? 'not-allowed' : 'default' }}
                    >
                      {hoursList.map(h => (
                        <option key={h} value={h}>{h < 10 ? `0${h}` : `${h}`}</option>
                      ))}
                    </select>
                    <span style={{ fontWeight: 'bold', opacity: isNoBlasting ? 0.6 : 1 }}>:</span>
                    <select
                      disabled={isNoBlasting}
                      value={blastingMin}
                      onChange={(e) => {
                        const m = parseInt(e.target.value, 10);
                        const hStr = blastingHour < 10 ? `0${blastingHour}` : `${blastingHour}`;
                        const mStr = m < 10 ? `0${m}` : `${m}`;
                        handleBlastingTimeChange(`${hStr}:${mStr}`);
                      }}
                      style={{ width: '75px', fontWeight: 'bold', padding: '8px', opacity: isNoBlasting ? 0.6 : 1, cursor: isNoBlasting ? 'not-allowed' : 'default' }}
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map(m => (
                        <option key={m} value={m}>{m < 10 ? `0${m}` : `${m}`}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', opacity: isNoBlasting ? 0.6 : 1, marginRight: '8px' }}>hrs</span>
                    
                    {/* Sin Tronadura Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.03)', padding: '6px 10px', borderRadius: '6px', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        id="no-blasting-chk"
                        checked={isNoBlasting}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsNoBlasting(checked);
                          if (checked) {
                            handleBlastingTimeChange('07:00');
                          } else {
                            handleBlastingTimeChange('19:00'); // default
                          }
                        }}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor="no-blasting-chk" style={{ fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        Sin Tronadura
                      </label>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowEqSelector(!showEqSelector)}
                  style={{ height: '40px' }}
                >
                  {showEqSelector ? 'Ocultar Selector de Equipos' : 'Seleccionar Equipos del Día'}
                </button>
              </div>

              {/* Input Observaciones Horario de Tronadura */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <label htmlFor="blasting-obs-input" className="filter-label" style={{ marginBottom: 0 }}>
                    Observaciones Horario de Tronadura
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    (Cumplimiento, causas de retraso o alteraciones)
                  </span>
                </div>
                <input
                  id="blasting-obs-input"
                  type="text"
                  value={blastingObservations}
                  onChange={(e) => {
                    setBlastingObservations(e.target.value);
                    setIsEquipmentsDirty(true);
                  }}
                  placeholder="Ej: Tronadura efectuada en horario programado sin novedades / Retraso de 20 min por despeje de área..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    color: 'var(--text-input)'
                  }}
                />
              </div>
            </div>
          )}

          {activeSubTab === 'dotacion' && (
            <div style={{ 
              paddingTop: '12px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              <Calendar size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>
                El turno semanal rige de <strong>miércoles a martes</strong> (resaltado en azul en el calendario). Puede cambiar de semana seleccionando cualquier día.
              </span>
            </div>
          )}

          {activeSubTab === 'insumos' && (
            <div style={{ 
              paddingTop: '12px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              <AlertCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span>
                Registre el stock físico remanente al cierre del turno para Nitrato y Matriz del día seleccionado.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Menu Navigation (Phase 17: removed 'calidad') */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: '4px', marginBottom: '24px' }}>
        <button 
          onClick={() => handleSubTabChange('equipos')}
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
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '700',
            background: isDateEquipmentsSaved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
            color: isDateEquipmentsSaved ? '#10b981' : '#ef4444',
            border: isDateEquipmentsSaved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)'
          }}>
            {isDateEquipmentsSaved ? '✓ Guardado' : '● Sin registrar'}
          </span>
        </button>

        <button 
          onClick={() => handleSubTabChange('insumos')}
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
          <span>2. Stock de Materias Primas</span>
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '700',
            background: isDateRawMaterialsSaved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
            color: isDateRawMaterialsSaved ? '#10b981' : '#ef4444',
            border: isDateRawMaterialsSaved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)'
          }}>
            {isDateRawMaterialsSaved ? '✓ Guardado' : '● Sin registrar'}
          </span>
        </button>

        <button 
          onClick={() => handleSubTabChange('dotacion')}
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
          <span>3. Disponibilidad de Dotación (Semanal)</span>
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: '700',
            background: isWeekRosterSaved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.12)',
            color: isWeekRosterSaved ? '#10b981' : '#f59e0b',
            border: isWeekRosterSaved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.25)'
          }}>
            {isWeekRosterSaved ? '✓ Guardada' : '● Sin registrar'}
          </span>
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

                        const availHours = getAvailHours(state);

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
            Ingrese el stock disponible para hoy de las materias primas principales del contrato.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                  onChange={(e) => {
                    setNitratoStock(parseFloat(e.target.value) || 0);
                    setIsRawMaterialsDirty(true);
                  }}
                  style={{ width: '120px', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>ton</span>
              </div>
            </div>

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
                  onChange={(e) => {
                    setMatrizStock(parseFloat(e.target.value) || 0);
                    setIsRawMaterialsDirty(true);
                  }}
                  style={{ width: '120px', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>ton</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--primary-glow)', padding: '14px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '20px' }}>
            <AlertCircle size={20} style={{ float: 'left', marginRight: '8px', color: 'var(--primary)' }} />
            <span>
              <strong>Cálculo de Disponibilidad de Materias Primas:</strong> Si el stock diario es igual o superior al mínimo (200 ton), el cumplimiento es del 100%. De lo contrario, se calcula proporcionalmente (ej. 170 ton = 85% de cumplimiento).
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

      {/* TAB 3: ROSTER DE DOTACION CONTENT (Phase 17: turn shift validation divided by 2 for 7x7) */}
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
                  <th style={{ width: '120px', textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}>Exigida Diario</th>
                  {weekDays.map((d) => (
                    <th key={d.dateStr} style={{ textAlign: 'center', width: '110px' }}>
                      <div style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{d.dayName}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{d.shortLabel}</div>
                    </th>
                  ))}
                  <th style={{ minWidth: '220px', textAlign: 'left' }}>Observaciones / Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(r => {
                  const shift = getRoleShiftType(r.roleName);
                  const requiredDaily = shift === '7x7' ? r.requiredCount / 2 : r.requiredCount;
                  const arr = weeklyRoster[r.roleName] || Array(7).fill(requiredDaily);
                  
                  return (
                    <tr key={r.roleName}>
                      <td style={{ fontWeight: '600', fontSize: '0.85rem' }}>{r.roleName}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', background: 'rgba(0,0,0,0.02)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {shift === '4x3' ? `${requiredDaily} pers (4d)` : `${requiredDaily} pers`}
                      </td>
                      {arr.map((val, idx) => {
                        const isRestDay4x3 = shift === '4x3' && (idx === 2 || idx === 3 || idx === 4);
                        const cellVal = isRestDay4x3 ? 0 : val;
                        const isUnderstaffed = !isRestDay4x3 && cellVal < requiredDaily;
                        
                        return (
                          <td key={idx} style={{ textAlign: 'center', background: isRestDay4x3 ? 'rgba(0,0,0,0.04)' : 'none' }}>
                            <input
                              type="number"
                              min="0"
                              step={shift === '7x7' ? '0.5' : '1'}
                              value={cellVal}
                              disabled={isRestDay4x3}
                              onChange={(e) => handleRosterCellChange(r.roleName, idx, parseFloat(e.target.value) || 0)}
                              style={{ 
                                width: '65px', 
                                padding: '6px', 
                                textAlign: 'center',
                                border: isUnderstaffed ? '1px solid var(--color-mantencioncorrectiva)' : '1px solid var(--border-color)',
                                background: isRestDay4x3 ? 'rgba(0,0,0,0.02)' : isUnderstaffed ? 'var(--color-mantencioncorrectiva-bg)' : 'none',
                                color: isRestDay4x3 ? 'var(--text-muted)' : isUnderstaffed ? 'var(--color-mantencioncorrectiva)' : 'inherit',
                                fontWeight: '600',
                                opacity: isRestDay4x3 ? 0.6 : 1
                              }}
                            />
                          </td>
                        );
                      })}
                      <td>
                        <input 
                          type="text"
                          placeholder="Ej: Ausencia justificada..."
                          value={weeklyComments[r.roleName] || ''}
                          onChange={(e) => {
                            setWeeklyComments(prev => ({ ...prev, [r.roleName]: e.target.value }));
                            setIsRosterDirty(true);
                          }}
                          style={{
                            width: '100%',
                            minWidth: '200px',
                            padding: '6px 10px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            background: 'var(--bg-input)',
                            color: 'var(--text-input)',
                            fontSize: '0.82rem'
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '10px', background: 'var(--primary-glow)', padding: '14px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '20px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: 'var(--primary)' }} />
            <div>
              <strong>Regla de Turnos Contractuales:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>Los cargos con jornada **7x7** se dividen entre dos grupos (Turno A y Turno B). Por lo tanto, la exigencia diaria de asistencia es la **mitad (50%)** del total contratado.</li>
                <li>Los cargos con jornada **4x3** no se dividen, exigiéndose el **100%** de asistencia en sus días hábiles.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

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
});
