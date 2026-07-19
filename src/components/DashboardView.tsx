import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { dbService, getWednesdayStartDate, getRoleShiftType } from '../services/db';
import type { Equipment, PeriodCompliance, AvailabilityRecord, ContractUser } from '../services/db';
import { 
  calculateMetrics, exportToCSV, getPluralType, calculateTypeDailyHours, calculateQualityKPICompliance 
} from '../utils/calculations';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, PieChart, Pie, ReferenceLine
} from 'recharts';
import { 
  Download, FileDown, Clock, X, AlertTriangle, Award, Save, Layers, Users 
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

interface DashboardViewProps {
  fleet: Equipment[];
  addToast: (text: string, type: 'success' | 'error') => void;
  currentUser: ContractUser;
}

const getStatusClass = (status: string) => {
  return status
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
};

const formatToDDMMYYYY = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export const DashboardView: React.FC<DashboardViewProps> = ({ fleet, addToast, currentUser }) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Set default range to last 14 days
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayStr);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [modalEqId, setModalEqId] = useState<string | null>(null);
  const [selectedRoleForModal, setSelectedRoleForModal] = useState<string | null>(null);
  const [hoveredKpiId, setHoveredKpiId] = useState<string | null>(null);
  
  const getQualityKPIState = (kpiId: string) => {
    if (periodCompliancesState[kpiId]) {
      return periodCompliancesState[kpiId];
    }
    // Default fallbacks (Phase 23)
    if (kpiId === 'kpi-tiros-quedados') return { realValue: 0, compliancePct: 100.0 };
    if (kpiId === 'kpi-ptq') return { realValue: 3, compliancePct: 100.0 };
    if (kpiId === 'kpi-flyrock') return { realValue: 0, compliancePct: 100.0 };
    if (kpiId === 'kpi-vod') return { realValue: 8, compliancePct: 100.0 };
    if (kpiId === 'kpi-gases') return { realValue: 0, compliancePct: 100.0 };
    return { realValue: 100.0, compliancePct: 100.0 };
  };

  // Dashboard Tabs (Phase 18: overview, raw_materials, attendance, kpi)
  const [activeTab, setActiveTab] = useState<'overview' | 'raw_materials' | 'attendance' | 'kpi'>('overview');

  // Selective equipment types state (Phase 17: Camioneta NOT selected by default!)
  const [selectedTypes, setSelectedTypes] = useState<Equipment['type'][]>(
    ['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil']
  );

  const [edpAmount, setEdpAmount] = useState<number>(20000000);

  const getEDPMultiplier = useCallback((mdc: number): { multiplier: number; range: string; discount: number } => {
    if (mdc >= 100.0) {
      return { multiplier: 100, range: 'MDC ≥ 100%', discount: 0 };
    } else if (mdc >= 96.0) {
      return { multiplier: 98, range: '96% ≤ MDC < 100%', discount: 2 };
    } else if (mdc >= 87.0) {
      return { multiplier: 96, range: '87% ≤ MDC < 96%', discount: 4 };
    } else if (mdc >= 77.0) {
      return { multiplier: 94, range: '77% ≤ MDC < 87%', discount: 6 };
    } else if (mdc >= 67.0) {
      return { multiplier: 92, range: '67% ≤ MDC < 77%', discount: 8 };
    } else {
      return { multiplier: 90, range: '0% ≤ MDC < 67%', discount: 10 };
    }
  }, []);

  const dashboardRef = useRef<HTMLDivElement>(null);

  // Fetch contract settings & availability records for range
  const settings = useMemo(() => dbService.getContractSettings(), [fleet]);
  const records = useMemo(() => dbService.getAvailabilityRecords(startDate, endDate), [startDate, endDate, fleet]);

  // Load new KPI datasets
  const kpis = useMemo(() => dbService.getContractKPIs(), [fleet]);
  const roles = useMemo(() => dbService.getContractRoles(), [fleet]);
  const rawMaterials = useMemo(() => dbService.getRawMaterialsForRange(startDate, endDate), [startDate, endDate, fleet]);
  const qualityCompliances = useMemo(() => dbService.getQualityComplianceForRange(startDate, endDate), [startDate, endDate, fleet]);
  const weeklyAttendances = useMemo(() => dbService.getWeeklyAttendanceList(), [fleet]);

  const targetStock = useMemo(() => {
    const k = kpis.find(item => item.id === 'kpi-insumos');
    return k ? parseFloat(k.expectedVal) || 200 : 200;
  }, [kpis]);

  const minStock = useMemo(() => {
    const k = kpis.find(item => item.id === 'kpi-insumos');
    return k ? parseFloat(k.minVal) || 170 : 170;
  }, [kpis]);

  const maxStock = useMemo(() => {
    const k = kpis.find(item => item.id === 'kpi-insumos');
    return k ? parseFloat(k.maxVal) || 200 : 200;
  }, [kpis]);

  // Period compliance editing state (Phase 17: edited directly in Dashboard)
  const [periodCompliancesState, setPeriodCompliancesState] = useState<Record<string, { realValue: number; compliancePct: number }>>({});

  useEffect(() => {
    const list = dbService.getPeriodCompliancesForRange(startDate, endDate);
    const map: Record<string, { realValue: number; compliancePct: number }> = {};
    list.forEach(p => {
      map[p.kpiId] = { realValue: p.realValue, compliancePct: p.compliancePct };
    });
    setPeriodCompliancesState(map);
  }, [startDate, endDate]);

  const activePeriodCompliances = useMemo<PeriodCompliance[]>(() => {
    return Object.keys(periodCompliancesState).map(kpiId => ({
      startDate,
      endDate,
      kpiId,
      realValue: periodCompliancesState[kpiId].realValue,
      compliancePct: periodCompliancesState[kpiId].compliancePct
    }));
  }, [periodCompliancesState, startDate, endDate]);

  // Calculate days in range
  const daysCount = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  // Compute metrics with selectedTypes & activePeriodCompliances
  const metrics = useMemo(() => {
    return calculateMetrics(
      fleet, 
      records, 
      settings, 
      daysCount, 
      selectedTypes,
      startDate,
      endDate,
      rawMaterials,
      qualityCompliances,
      weeklyAttendances,
      kpis,
      roles,
      activePeriodCompliances
    );
  }, [fleet, records, settings, daysCount, selectedTypes, startDate, endDate, rawMaterials, qualityCompliances, weeklyAttendances, kpis, roles, activePeriodCompliances]);

  // Save Period KPIs to DB
  const handleSavePeriodKPIs = () => {
    const promises = Object.keys(periodCompliancesState).map(kpiId => {
      const item = periodCompliancesState[kpiId];
      return dbService.savePeriodCompliance(startDate, endDate, kpiId, item.realValue, item.compliancePct);
    });

    Promise.all(promises)
      .then(() => {
        addToast('KPIs de Calidad y Seguridad para el período guardados exitosamente.', 'success');
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar datos en Supabase.', 'error');
      });
  };

  // Quick Range Presets
  const setRangePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setMonthPreset = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };

  const setContractCyclePreset = () => {
    const today = new Date();
    const currentDay = today.getDate();
    let startYear = today.getFullYear();
    let startMonth = today.getMonth();
    let endYear = today.getFullYear();
    let endMonth = today.getMonth();

    if (currentDay >= 21) {
      endMonth = currentMonthToNextMonth(today.getMonth());
      if (endMonth === 0) endYear += 1;
    } else {
      startMonth = prevMonthIndex(today.getMonth());
      if (startMonth === 11) startYear -= 1;
    }

    function currentMonthToNextMonth(m: number) {
      return m === 11 ? 0 : m + 1;
    }
    function prevMonthIndex(m: number) {
      return m === 0 ? 11 : m - 1;
    }

    const startObj = new Date(startYear, startMonth, 21);
    const endObj = new Date(endYear, endMonth, 20);

    const todayNoon = new Date();
    todayNoon.setHours(12, 0, 0, 0);
    if (endObj.getTime() > todayNoon.getTime()) {
      endObj.setTime(todayNoon.getTime());
    }

    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset();
      const localDate = new Date(d.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split('T')[0];
    };

    setStartDate(toLocalISO(startObj));
    setEndDate(toLocalISO(endObj));
  };

  const toggleTypeSelection = (type: Equipment['type']) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) {
          addToast('Debe evaluar al menos un tipo de equipo.', 'error');
          return prev;
        }
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setExportingPDF(true);
    addToast('Generando PDF del Dashboard...', 'success');

    try {
      const exportButtons = document.getElementById('export-actions-panel');
      const checkboxPanel = document.getElementById('type-checkboxes-panel');
      const tabHeaders = document.getElementById('dashboard-tabs-headers');
      
      if (exportButtons) exportButtons.style.display = 'none';
      if (checkboxPanel) checkboxPanel.style.display = 'none';
      if (tabHeaders) tabHeaders.style.display = 'none';

      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.body.classList.contains('dark-theme') ? '#0b0f19' : '#f8fafc',
        logging: false,
      });

      if (exportButtons) exportButtons.style.display = 'flex';
      if (checkboxPanel) checkboxPanel.style.display = 'flex';
      if (tabHeaders) tabHeaders.style.display = 'flex';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`KPI-Evaluacion-Contrato-${startDate}-a-${endDate}.pdf`);
      addToast('PDF descargado correctamente.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Error al generar el PDF.', 'error');
    } finally {
      setExportingPDF(false);
    }
  };

  // Excel/CSV Export
  const handleExportCSV = () => {
    const activeFleet = fleet.filter(eq => selectedTypes.includes(eq.type));
    const activeEqIds = new Set(activeFleet.map(eq => eq.id));
    const filteredRecords = records.filter(r => activeEqIds.has(r.equipmentId));
    
    exportToCSV(activeFleet, filteredRecords, `disponibilidad_flota_${startDate}_a_${endDate}.csv`);
    addToast('Archivo Excel (CSV) descargado.', 'success');
  };

  // Convert map metrics to array for charts
  const barChartData = useMemo(() => {
    return Object.values(metrics.byType).map(t => ({
      name: t.type,
      'Disponibilidad (%)': parseFloat(t.contractualAvailability.toFixed(1))
    }));
  }, [metrics]);

  // Format date for history chart: YYYY-MM-DD to DD/MM
  const historyChartData = useMemo(() => {
    return metrics.dailyHistory.map(day => {
      const parts = day.date.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : day.date;
      return {
        date: formattedDate,
        'Disponibilidad (%)': parseFloat(day.contractAvail.toFixed(1))
      };
    });
  }, [metrics]);

  const totalContractTargetHours = useMemo(() => {
    let sum = 0;
    selectedTypes.forEach(t => {
      const req = t === 'Camión Fábrica' ? settings.requiredFactoryTrucks
                : t === 'Cargador Frontal' ? settings.requiredFrontLoaders
                : t === 'Polvorín Móvil' ? settings.requiredPowderKegs
                : settings.requiredPickups;
      sum += req * 12 * daysCount;
    });
    return sum;
  }, [selectedTypes, settings, daysCount]);

  const totalContractDeliveredHours = useMemo(() => {
    let sum = 0;
    const recordsByDate: Record<string, typeof records> = {};
    records.forEach(r => {
      if (!recordsByDate[r.date]) recordsByDate[r.date] = [];
      recordsByDate[r.date].push(r);
    });

    const dates = Object.keys(recordsByDate);
    if (dates.length === 0) return 0;

    dates.forEach(date => {
      const dayRecords = recordsByDate[date];
      selectedTypes.forEach(t => {
        const req = t === 'Camión Fábrica' ? settings.requiredFactoryTrucks
                  : t === 'Cargador Frontal' ? settings.requiredFrontLoaders
                  : t === 'Polvorín Móvil' ? settings.requiredPowderKegs
                  : settings.requiredPickups;
        
        const typeRecords = dayRecords.filter(r => {
          const eq = fleet.find(f => f.id === r.equipmentId);
          return eq?.type === t;
        });

        const dayHours = calculateTypeDailyHours(req, typeRecords);
        sum += dayHours.contractDelivered;
      });
    });

    return sum;
  }, [records, selectedTypes, settings, fleet]);

  const totalHoursDown = useMemo(() => {
    return Math.max(0, totalContractTargetHours - totalContractDeliveredHours);
  }, [totalContractTargetHours, totalContractDeliveredHours]);

  const COLORS = ['#f59e0b', '#0284c7', '#8b5cf6', '#ef4444'];

  // Table summary per vehicle
  const fleetSummaryTable = useMemo(() => {
    const activeFleet = fleet.filter(eq => selectedTypes.includes(eq.type));
    const allItems = activeFleet.map(eq => {
      const eqRecords = records.filter(r => r.equipmentId === eq.id);
      
      let availHours = 0;
      let downHours = 0;
      let lastStatus = 'Operativo';

      eqRecords.forEach(r => {
        availHours += r.hoursAvailable;
        downHours += (r.hoursOutOfService - (r.hoursPostBlasting || 0));
      });

      const totalPossibleHours = eqRecords.length * 12;
      const equipmentAvailability = eqRecords.length > 0
        ? (availHours / totalPossibleHours) * 100 
        : null;

      if (eqRecords.length > 0) {
        const sorted = [...eqRecords].sort((a, b) => b.date.localeCompare(a.date));
        lastStatus = sorted[0].status;
      } else {
        lastStatus = 'No Programado';
      }

      return {
        id: eq.id,
        name: eq.name,
        type: eq.type,
        patent: eq.patent,
        availHours,
        downHours,
        availability: equipmentAvailability,
        lastStatus
      };
    });
    return allItems.filter((row: any) => row.availability !== null) as {
      id: string;
      name: string;
      type: Equipment['type'];
      patent: string;
      availHours: number;
      downHours: number;
      availability: number;
      lastStatus: string;
    }[];
  }, [fleet, records, selectedTypes]);

  // Modal detailed data logic
  const modalEq = useMemo(() => {
    if (!modalEqId) return null;
    return fleet.find(e => e.id === modalEqId);
  }, [modalEqId, fleet]);

  const modalRecords = useMemo(() => {
    if (!modalEqId) return [];
    return records.filter(r => r.equipmentId === modalEqId && r.status !== 'Operativo')
                  .sort((a, b) => b.date.localeCompare(a.date));
  }, [modalEqId, records]);

  const failingEquipmentsRecords = useMemo(() => {
    const failingIds = new Set(
      fleetSummaryTable.filter(row => row.availability !== null && row.availability < 100).map(row => row.id)
    );
    return records.filter(r => failingIds.has(r.equipmentId) && r.status !== 'Operativo')
                  .sort((a, b) => b.date.localeCompare(a.date));
  }, [fleetSummaryTable, records]);

  // Re-organize records by date for raw materials & attendance stats
  const recordsByDate = useMemo(() => {
    const map: Record<string, AvailabilityRecord[]> = {};
    records.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return map;
  }, [records]);

  // New Tab: Materias Primas metrics
  const avgNitrato = useMemo(() => {
    if (rawMaterials.length === 0) return 0;
    const sum = rawMaterials.reduce((acc, r) => acc + r.nitratoStock, 0);
    return parseFloat((sum / rawMaterials.length).toFixed(1));
  }, [rawMaterials]);

  const avgMatriz = useMemo(() => {
    if (rawMaterials.length === 0) return 0;
    const sum = rawMaterials.reduce((acc, r) => acc + r.matrizStock, 0);
    return parseFloat((sum / rawMaterials.length).toFixed(1));
  }, [rawMaterials]);

  const rawMaterialsChartData = useMemo(() => {
    return [...rawMaterials].sort((a, b) => a.date.localeCompare(b.date)).map(row => {
      const parts = row.date.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : row.date;
      return {
        date: formattedDate,
        'Nitrato': row.nitratoStock,
        'Matriz': row.matrizStock
      };
    });
  }, [rawMaterials]);

  // New Tab: Dotación Roster metrics (Phase 20)
  const attendanceStats = useMemo(() => {
    const datesList = Object.keys(recordsByDate).sort();
    if (datesList.length === 0 || roles.length === 0) return [];
    
    // Filter out roles that do not affect the KPI (Enaex support roles)
    const activeRoles = roles.filter(r => r.affectsKPI !== false);
    
    const statsMap: Record<string, { roleName: string; shift: string; totalAttended: number; totalRequired: number; countDays: number }> = {};
    activeRoles.forEach(r => {
      const shift = getRoleShiftType(r.roleName);
      statsMap[r.roleName] = {
        roleName: r.roleName,
        shift,
        totalAttended: 0,
        totalRequired: 0,
        countDays: 0
      };
    });

    datesList.forEach(dateStr => {
      const wedDate = getWednesdayStartDate(dateStr);
      const att = weeklyAttendances.find(w => w.weekStartDate === wedDate);
      
      const d = new Date(dateStr + 'T12:00:00');
      const dayIdx = (d.getDay() + 4) % 7; // Wednesday is 0

      activeRoles.forEach(r => {
        const shift = getRoleShiftType(r.roleName);
        
        // Skip Friday (2), Saturday (3), and Sunday (4) for 4x3 shift roles
        if (shift === '4x3' && (dayIdx === 2 || dayIdx === 3 || dayIdx === 4)) {
          return;
        }

        const requiredDaily = shift === '7x7' ? r.requiredCount / 2 : r.requiredCount;
        const attended = (att && att.attendanceData[r.roleName])
          ? att.attendanceData[r.roleName][dayIdx]
          : requiredDaily;

        statsMap[r.roleName].totalAttended += attended;
        statsMap[r.roleName].totalRequired += requiredDaily;
        statsMap[r.roleName].countDays += 1;
      });
    });

    return Object.values(statsMap).map(s => {
      const avgAtt = s.countDays > 0 ? (s.totalAttended / s.countDays) : 0;
      const compliance = s.totalRequired > 0 ? (s.totalAttended / s.totalRequired) * 100 : 100;
      return {
        roleName: s.roleName,
        shift: s.shift,
        avgAttended: parseFloat(avgAtt.toFixed(1)),
        requiredDaily: s.countDays > 0 ? parseFloat((s.totalRequired / s.countDays).toFixed(1)) : 0,
        compliance: Math.min(100, parseFloat(compliance.toFixed(1)))
      };
    });
  }, [roles, weeklyAttendances, recordsByDate]);

  // Modal breakdown for dynamic dotation detail (Phase 22)
  const modalData = useMemo(() => {
    if (!selectedRoleForModal) return [];
    const r = roles.find(ro => ro.roleName === selectedRoleForModal);
    if (!r) return [];

    const shift = getRoleShiftType(r.roleName);
    const datesList = Object.keys(recordsByDate).sort();

    return datesList.map(dateStr => {
      const wedDate = getWednesdayStartDate(dateStr);
      const att = weeklyAttendances.find(w => w.weekStartDate === wedDate);
      const d = new Date(dateStr + 'T12:00:00');
      const dayIdx = (d.getDay() + 4) % 7; // Wednesday is 0

      const isRestDay4x3 = shift === '4x3' && (dayIdx === 2 || dayIdx === 3 || dayIdx === 4);
      const required = isRestDay4x3 ? 0 : (shift === '7x7' ? r.requiredCount / 2 : r.requiredCount);
      const attended = isRestDay4x3 ? 0 : ((att && att.attendanceData[r.roleName])
        ? att.attendanceData[r.roleName][dayIdx]
        : required);

      const compliance = required > 0 ? parseFloat(((attended / required) * 100).toFixed(1)) : 100.0;

      return {
        date: dateStr,
        required,
        attended,
        compliance,
        isRestDay: isRestDay4x3
      };
    });
  }, [selectedRoleForModal, roles, recordsByDate, weeklyAttendances]);

  const scoreBadge = getContractScoreBadge(metrics.weightedScore);

  return (
    <div ref={dashboardRef} style={{ paddingBottom: '20px' }}>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dashboard de Disponibilidad y Contrato</h1>
          <p>Métricas claves y visualización de KPIs del contrato de servicio ({formatToDDMMYYYY(startDate)} al {formatToDDMMYYYY(endDate)})</p>
        </div>
        <div id="export-actions-panel" className="actions-group">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} />
            <span>Descargar Excel</span>
          </button>
          <button className="btn btn-primary" onClick={handleExportPDF} disabled={exportingPDF}>
            <FileDown size={16} />
            <span>{exportingPDF ? 'Generando...' : 'Exportar PDF'}</span>
          </button>
        </div>
      </div>

      {/* Date Filters Bar */}
      <div className="glass filter-bar">
        <div className="filter-group">
          <span className="filter-label">Fecha Inicio</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">Fecha Fin</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={todayStr}
          />
        </div>
        
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <span className="filter-label">Filtros Rápidos</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setRangePreset(7)}>7D</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setRangePreset(15)}>15D</button>
            <button className="btn btn-secondary btn-sm" onClick={setMonthPreset}>Mes Actual</button>
            <button className="btn btn-secondary btn-sm" onClick={setContractCyclePreset} style={{ fontWeight: 'bold', color: 'var(--primary-light)' }}>
              Período Contrato (21-20)
            </button>
          </div>
        </div>
      </div>

      {/* TABS SWITCHER (Phase 18: order - overview, raw_materials, attendance, kpi) */}
      <div id="dashboard-tabs-headers" style={{ display: 'flex', gap: '4px', borderBottom: '2px solid var(--border-color)', marginBottom: '24px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('overview')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'overview' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Clock size={16} />
          <span>Disponibilidad de Flota</span>
        </button>

        <button 
          onClick={() => setActiveTab('raw_materials')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'raw_materials' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'raw_materials' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={16} />
          <span>Materias Primas</span>
        </button>

        <button 
          onClick={() => setActiveTab('attendance')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'attendance' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'attendance' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={16} />
          <span>Disponibilidad de Dotación</span>
        </button>

        <button 
          onClick={() => setActiveTab('kpi')}
          style={{ 
            padding: '12px 20px', 
            fontWeight: '600', 
            fontSize: '0.9rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'kpi' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'kpi' ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Award size={16} />
          <span>Evaluación de Contrato (KPI Ponderado)</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <>
          {/* Equipment Type Filter Checkboxes Bar */}
          <div id="type-checkboxes-panel" className="glass filter-bar" style={{ marginTop: '-12px', marginBottom: '24px' }}>
            <div className="filter-group" style={{ width: '100%' }}>
              <span className="filter-label" style={{ marginBottom: '8px' }}>Equipos a Evaluar en KPI</span>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {(['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil', 'Camioneta'] as Equipment['type'][]).map(t => (
                  <label 
                    key={t} 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '0.9rem', 
                      cursor: 'pointer', 
                      fontWeight: '600',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(t)}
                      onChange={() => toggleTypeSelection(t)}
                      style={{ 
                        cursor: 'pointer', 
                        width: '18px', 
                        height: '18px',
                        accentColor: 'var(--primary-light)'
                      }}
                    />
                    <span>{getPluralType(t)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="kpi-grid">
            <div className="glass kpi-card" style={{ '--card-accent': 'var(--primary)' } as any}>
              <span className="kpi-title">Disponibilidad de Flota</span>
              <div className="kpi-value" style={{ color: 'var(--primary-light)' }}>
                {metrics.overallContractual.toFixed(1)}%
              </div>
              <span className="kpi-subtext">Cumplimiento del contrato de servicio</span>
            </div>

            <div className="glass kpi-card" style={{ '--card-accent': 'var(--secondary)' } as any}>
              <span className="kpi-title">Horas Comprometidas</span>
              <div className="kpi-value" style={{ color: 'var(--secondary)' }}>
                {totalContractTargetHours.toLocaleString()} hrs
              </div>
              <span className="kpi-subtext">Horas programadas por contrato</span>
            </div>

            <div className="glass kpi-card" style={{ '--card-accent': 'var(--color-operativo)' } as any}>
              <span className="kpi-title">Horas Operativas Entregadas</span>
              <div className="kpi-value" style={{ color: 'var(--color-operativo)' }}>
                {totalContractDeliveredHours.toLocaleString()} hrs
              </div>
              <span className="kpi-subtext">Horas útiles (topadas al límite diario)</span>
            </div>

            <div className="glass kpi-card" style={{ '--card-accent': 'var(--color-mantencioncorrectiva)' } as any}>
              <span className="kpi-title">Horas Fuera de Servicio</span>
              <div className="kpi-value" style={{ color: 'var(--color-mantencioncorrectiva)' }}>
                {totalHoursDown.toLocaleString()} hrs
              </div>
              <span className="kpi-subtext">
                Sin cobertura. Respaldos cubrieron {metrics.totalBackupCoveredHours.toLocaleString()} hrs.
              </span>
            </div>
          </div>

          {/* Cards of Availability by Type */}
          <div style={{ marginTop: '24px', marginBottom: '24px' }}>
            <h2 className="chart-title" style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: '700' }}>
              Disponibilidad por Categoría de Flota
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              {(['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil', 'Camioneta'] as Equipment['type'][]).map(t => {
                const isSelected = selectedTypes.includes(t);
                const data = metrics.byType[t];
                if (!data) return null;
                
                let accentColor = 'var(--primary)';
                if (t === 'Cargador Frontal') accentColor = 'var(--secondary)';
                if (t === 'Polvorín Móvil') accentColor = 'var(--color-mantencionpreventiva)';
                if (t === 'Camioneta') accentColor = '#8b5cf6';

                const delivered = (data.contractualAvailability / 100) * data.hoursTarget;
                const target = data.hoursTarget;

                return (
                  <div 
                    key={t} 
                    className="glass kpi-card" 
                    style={{ 
                      '--card-accent': accentColor,
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '20px',
                      position: 'relative',
                      overflow: 'hidden',
                      opacity: isSelected ? 1 : 0.4,
                      transition: 'opacity var(--transition-fast)'
                    } as any}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {getPluralType(t)}
                      </span>
                      {!isSelected && (
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                          Excluido de KPI
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Disponibilidad:</span>
                        <div style={{ fontSize: '1.6rem', fontWeight: '800', color: accentColor }}>
                          {data.contractualAvailability.toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div><strong>{delivered.toFixed(0)}</strong> / {target} hrs</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, data.contractualAvailability)}%`, height: '100%', background: accentColor, borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts Grid */}
          <div className="charts-grid">
            <div className="glass chart-card">
              <h2 className="chart-title">Evolución de Disponibilidad Diaria</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorContract" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis domain={[50, 100]} stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-main)', 
                        borderColor: 'var(--border-color)', 
                        color: 'var(--text-primary)', 
                        borderRadius: '8px' 
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Area 
                      type="monotone" 
                      dataKey="Disponibilidad (%)" 
                      stroke="var(--primary-light)" 
                      fillOpacity={1} 
                      fill="url(#colorContract)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass chart-card">
              <h2 className="chart-title">Comparación por Tipo de Equipo</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-main)', 
                        borderColor: 'var(--border-color)', 
                        color: 'var(--text-primary)', 
                        borderRadius: '8px' 
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="Disponibilidad (%)" fill="var(--primary-light)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass chart-card">
              <h2 className="chart-title">Distribución de Horas Fuera de Servicio</h2>
              <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {metrics.faultBreakdown[0]?.name === 'Sin fallas' ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                    <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    Sin horas fuera de servicio registradas en este período.
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={metrics.faultBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {metrics.faultBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: any) => [`${value} hrs`, 'Tiempo de inactividad']}
                          contentStyle={{ 
                            backgroundColor: 'var(--bg-main)', 
                            borderColor: 'var(--border-color)', 
                            color: 'var(--text-primary)', 
                            borderRadius: '8px' 
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {metrics.faultBreakdown.map((entry, index) => (
                        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></span>
                          <span>{entry.name}: <strong>{entry.value} hrs</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="glass chart-card" style={{ height: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
              <h2 className="chart-title" style={{ margin: 0 }}>Análisis de Cumplimiento Contractual</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <strong>Metas Diarias:</strong> Cada tipo de equipo exige un número de unidades operativas en turno de 12 horas. Disponibilidad de flota actual: <strong>{metrics.overallContractual.toFixed(1)}%</strong>.
                </div>
                
                <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '10px', background: metrics.overallContractual >= 95 ? 'var(--color-operativo-bg)' : 'var(--color-mantencioncorrectiva-bg)' }}>
                  <div style={{ color: metrics.overallContractual >= 95 ? 'var(--color-operativo)' : 'var(--color-mantencioncorrectiva)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {metrics.overallContractual >= 95 ? '✓ EXCELENTE' : '⚠ ALERTA'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {metrics.overallContractual >= 95 
                      ? 'La disponibilidad general cumple con los niveles requeridos para la operación de Planta Sierra Gorda.'
                      : 'La disponibilidad se encuentra por debajo de la meta estipulada (95%). Revise las mantenciones y reparaciones.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Table Card */}
          <div className="glass table-card" style={{ marginBottom: '24px' }}>
            <h2 className="chart-title">Desempeño Individual de Equipos</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Patente</th>
                    <th style={{ textAlign: 'center' }}>Horas Disponibles Entregadas</th>
                    <th style={{ textAlign: 'center' }}>Horas Fuera Serv.</th>
                    <th style={{ textAlign: 'center' }}>Disponibilidad Individual</th>
                    <th>Último Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {fleetSummaryTable.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: '600' }}>{row.name}</td>
                      <td>{row.type}</td>
                      <td><code>{row.patent || '-'}</code></td>
                      <td style={{ textAlign: 'center' }}>{row.availHours} hrs</td>
                      <td style={{ textAlign: 'center' }}>{row.downHours} hrs</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {row.availability === null ? (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>N/A</span>
                        ) : row.availability < 100 ? (
                          <span 
                            onClick={() => setModalEqId(row.id)}
                            style={{ 
                              cursor: 'pointer', 
                              textDecoration: 'underline', 
                              color: row.availability >= 95 ? 'var(--color-operativo)' : row.availability >= 80 ? 'var(--color-mantencionprogramada)' : 'var(--color-mantencioncorrectiva)' 
                            }}
                            title="Ver detalle de inactividad"
                          >
                            {row.availability.toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-operativo)' }}>
                            {row.availability.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${getStatusClass(row.lastStatus)}`}>
                          {row.lastStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details for failing equipments */}
          <div className="glass table-card">
            <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} className="text-secondary" style={{ color: 'var(--color-mantencionprogramada)' }} />
              Detalle de Equipos con Disponibilidad &lt; 100%
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '-6px' }}>
              Listado histórico de todas las mantenciones y fallas del período para equipos con disponibilidad menor al 100%.
            </p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Estado Operativo</th>
                    <th style={{ textAlign: 'center' }}>Rango Horas</th>
                    <th style={{ textAlign: 'center' }}>Horas Detenido</th>
                    <th style={{ textAlign: 'center' }}>Post-Tronadura</th>
                    <th>Comentario / Detalle de Falla</th>
                  </tr>
                </thead>
                <tbody>
                  {failingEquipmentsRecords.map(r => {
                    const eq = fleet.find(e => e.id === r.equipmentId);
                    if (!eq) return null;
                    const totalDown = r.endHour - r.startHour;
                    
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: '600' }}>{eq.name}</td>
                        <td>{eq.type}</td>
                        <td><code>{formatToDDMMYYYY(r.date)}</code></td>
                        <td>
                          <span className={`badge badge-${getStatusClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <code>{r.startHour < 10 ? `0${r.startHour}:00` : `${r.startHour}:00`} - {r.endHour < 10 ? `0${r.endHour}:00` : `${r.endHour}:00`}</code>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-mantencioncorrectiva)' }}>
                          {totalDown} hrs
                        </td>
                        <td style={{ textAlign: 'center', color: r.hoursPostBlasting > 0 ? 'var(--color-operativo)' : 'var(--text-muted)' }}>
                          {r.hoursPostBlasting > 0 ? `-${r.hoursPostBlasting} hrs` : '0 hrs'}
                        </td>
                        <td style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>{r.comment || 'Sin comentarios registrados.'}</td>
                      </tr>
                    );
                  })}

                  {failingEquipmentsRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        Todos los equipos seleccionados mantuvieron el 100% de disponibilidad en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: MATERIAS PRIMAS TAB CONTENT (NEW PHASE 18) */}
      {activeTab === 'raw_materials' && (
        <>
          <div className="kpi-grid">
            <div className="glass kpi-card" style={{ '--card-accent': '#f59e0b' } as any}>
              <span className="kpi-title">Stock Promedio Nitrato</span>
              <div className="kpi-value" style={{ color: '#f59e0b' }}>
                {avgNitrato.toLocaleString()} ton
              </div>
              <span className="kpi-subtext">Mínimo contractual: {minStock} ton diarios</span>
            </div>

            <div className="glass kpi-card" style={{ '--card-accent': '#0284c7' } as any}>
              <span className="kpi-title">Stock Promedio Matriz</span>
              <div className="kpi-value" style={{ color: '#0284c7' }}>
                {avgMatriz.toLocaleString()} ton
              </div>
              <span className="kpi-subtext">Mínimo contractual: {minStock} ton diarios</span>
            </div>

            <div className="glass kpi-card" style={{ '--card-accent': 'var(--primary)' } as any}>
              <span className="kpi-title">Cumplimiento Global de Stock</span>
              <div className="kpi-value" style={{ color: 'var(--primary-light)' }}>
                {metrics.rawMaterialsCompliance.toFixed(1)}%
              </div>
              <span className="kpi-subtext">Desempeño promedio del inventario diario</span>
            </div>
          </div>

          {/* Area Chart: Stocks Evolution */}
          <div className="glass chart-card" style={{ marginTop: '24px', marginBottom: '24px' }}>
            <h2 className="chart-title">Evolución Diaria de Stock de Materias Primas</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rawMaterialsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNitrato" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMatriz" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-main)', 
                      borderColor: 'var(--border-color)', 
                      color: 'var(--text-primary)', 
                      borderRadius: '8px' 
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <ReferenceLine 
                    y={minStock} 
                    stroke="rgba(239, 68, 68, 0.4)" 
                    strokeWidth={1.5} 
                    strokeDasharray="3 3" 
                    label={{ value: `Mínimo (${minStock} ton)`, fill: 'rgba(239, 68, 68, 0.7)', fontSize: 9, position: 'top', fontWeight: 'bold' }} 
                  />
                  <ReferenceLine 
                    y={targetStock} 
                    stroke="rgba(59, 130, 246, 0.4)" 
                    strokeWidth={1.5} 
                    strokeDasharray="3 3" 
                    label={{ value: `Esperado (${targetStock} ton)`, fill: 'rgba(59, 130, 246, 0.7)', fontSize: 9, position: 'top', fontWeight: 'bold' }} 
                  />
                  <ReferenceLine 
                    y={maxStock} 
                    stroke="rgba(16, 185, 129, 0.4)" 
                    strokeWidth={1.5} 
                    strokeDasharray="3 3" 
                    label={{ value: `Máximo (${maxStock} ton)`, fill: 'rgba(16, 185, 129, 0.7)', fontSize: 9, position: 'top', fontWeight: 'bold' }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Nitrato" 
                    stroke="#f59e0b" 
                    fillOpacity={1} 
                    fill="url(#colorNitrato)" 
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Matriz" 
                    stroke="#0284c7" 
                    fillOpacity={1} 
                    fill="url(#colorMatriz)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Raw Materials stock Table */}
          <div className="glass table-card">
            <h2 className="chart-title">Historial Diario de Stock (Materias Primas)</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'center' }}>Nitrato Stock</th>
                    <th style={{ textAlign: 'center' }}>Matriz Stock</th>
                    <th style={{ textAlign: 'center' }}>Cumplimiento Nitrato</th>
                    <th style={{ textAlign: 'center' }}>Cumplimiento Matriz</th>
                    <th>Estado de Materias Primas</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rawMaterials].sort((a, b) => b.date.localeCompare(a.date)).map(row => {
                    const nitratoPct = Math.min(100, (row.nitratoStock / targetStock) * 100);
                    const matrizPct = Math.min(100, (row.matrizStock / targetStock) * 100);
                    const isAllOk = row.nitratoStock >= targetStock && row.matrizStock >= targetStock;

                    return (
                      <tr key={row.date}>
                        <td><code>{formatToDDMMYYYY(row.date)}</code></td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.nitratoStock} ton</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.matrizStock} ton</td>
                        <td style={{ textAlign: 'center', color: nitratoPct >= 100 ? 'var(--color-operativo)' : 'var(--color-mantencioncorrectiva)' }}>
                          {nitratoPct.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center', color: matrizPct >= 100 ? 'var(--color-operativo)' : 'var(--color-mantencioncorrectiva)' }}>
                          {matrizPct.toFixed(1)}%
                        </td>
                        <td>
                          <span className={`badge badge-${isAllOk ? 'operativo' : 'mantencioncorrectiva'}`}>
                            {isAllOk ? '✓ Stock Completo' : '⚠ Bajo Mínimo'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {rawMaterials.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No hay registros de materias primas para este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: ATTENDANCE TAB CONTENT (NEW PHASE 18) */}
      {activeTab === 'attendance' && (
        <>
          <div className="kpi-grid">
            <div className="glass kpi-card" style={{ '--card-accent': 'var(--color-mantencionpreventiva)' } as any}>
              <span className="kpi-title">Asistencia Global del Personal</span>
              <div className="kpi-value" style={{ color: 'var(--color-mantencionpreventiva)' }}>
                {metrics.attendanceCompliance.toFixed(1)}%
              </div>
              <span className="kpi-subtext">Cumplimiento de dotación semanal</span>
            </div>

            <div className="glass kpi-card" style={{ '--card-accent': 'var(--secondary)' } as any}>
              <span className="kpi-title">Cargos Evaluados</span>
              <div className="kpi-value" style={{ color: 'var(--secondary)' }}>
                {roles.filter(r => r.affectsKPI !== false).length} Roles
              </div>
              <span className="kpi-subtext">Puestos estipulados en contrato</span>
            </div>
          </div>

          {/* Bar Chart: Attendance Compliance by Role */}
          <div className="glass chart-card" style={{ marginTop: '24px', marginBottom: '24px' }}>
            <h2 className="chart-title">Porcentaje de Asistencia Promedio por Cargo</h2>
            <div className="chart-container" style={{ height: '380px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceStats} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="roleName" 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    angle={-30} 
                    textAnchor="end" 
                    interval={0} 
                  />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, 'Cumplimiento']}
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-main)', 
                      borderColor: 'var(--border-color)', 
                      color: 'var(--text-primary)', 
                      borderRadius: '8px' 
                    }}
                  />
                  <Bar dataKey="compliance" fill="var(--color-mantencionpreventiva)" radius={[4, 4, 0, 0]}>
                    {attendanceStats.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.compliance >= 95 ? '#10b981' : entry.compliance >= 90 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Attendance Table */}
          <div className="glass table-card">
            <h2 className="chart-title">Desempeño y Asistencia por Cargo (Detalle de Turnos)</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Cargo / Puesto</th>
                    <th style={{ textAlign: 'center' }}>Jornada</th>
                    <th style={{ textAlign: 'center' }}>Dotación Contratada</th>
                    <th style={{ textAlign: 'center' }}>Requerido Diario (Contrato)</th>
                    <th style={{ textAlign: 'center' }}>Asistencia Promedio</th>
                    <th style={{ textAlign: 'center' }}>% Cumplimiento</th>
                    <th>Estado de Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceStats.map(row => {
                    const alertType = row.compliance >= 95 ? 'operativo' : row.compliance >= 90 ? 'mantencionprogramada' : 'mantencioncorrectiva';
                    const alertLabel = row.compliance >= 95 ? '✓ Dotación Completa' : row.compliance >= 90 ? '⚠ Faltas Menores' : '🛑 Déficit Crítico';

                    return (
                      <tr key={row.roleName}>
                        <td style={{ fontWeight: '600' }}>{row.roleName}</td>
                        <td style={{ textAlign: 'center' }}><code>{row.shift}</code></td>
                        <td style={{ textAlign: 'center' }}>{row.requiredDaily * (row.shift === '7x7' ? 2 : 1)} pers</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.requiredDaily} pers</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.avgAttended} pers</td>
                        <td 
                          style={{ 
                            textAlign: 'center', 
                            fontWeight: 'bold', 
                            color: row.compliance >= 95 ? 'var(--color-operativo)' : 'var(--color-mantencioncorrectiva)',
                            cursor: row.compliance < 100 ? 'pointer' : 'default',
                            textDecoration: row.compliance < 100 ? 'underline' : 'none'
                          }}
                          onClick={() => {
                            if (row.compliance < 100) {
                              setSelectedRoleForModal(row.roleName);
                            }
                          }}
                          title={row.compliance < 100 ? 'Ver desglose diario de inasistencias' : undefined}
                        >
                          {row.compliance}%
                        </td>
                        <td>
                          <span className={`badge badge-${alertType}`}>
                            {alertLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 4: KPI EVALUATION TAB CONTENT (Reordered Tables) */}
      {activeTab === 'kpi' && (
        <div>
          {/* Main Contract Score Header Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '24px' }}>
            <div className="glass table-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Nota Final de Contrato
              </span>
              <div style={{ fontSize: '3.2rem', fontWeight: '900', color: scoreBadge.color, margin: '14px 0 6px 0' }}>
                {metrics.weightedScore.toFixed(1)}%
              </div>
              <span 
                style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: '800', 
                  padding: '6px 16px', 
                  borderRadius: '30px', 
                  background: scoreBadge.bg, 
                  color: scoreBadge.color 
                }}
              >
                {scoreBadge.text}
              </span>
            </div>

            <div className="glass table-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Desempeño de Sub-Evaluaciones Contractuales</h3>
                
                {/* Save button for inline edits */}
                {currentUser.role === 'Administrador' && (
                  <button className="btn btn-primary btn-sm" onClick={handleSavePeriodKPIs} style={{ height: '36px' }}>
                    <Save size={14} />
                    <span>Guardar Calidad y Seguridad</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Flota y Materias Primas */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Disponibilidad de Flota y Materias Primas (Ponderación 31%)</span>
                    <strong>{metrics.overallContractual.toFixed(1)}%</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${metrics.overallContractual}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }}></div>
                  </div>
                </div>

                {/* Calidad de servicio */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Calidad de Servicio (Ponderación 49%)</span>
                    <strong>
                      {(
                        kpis.filter(k => k.category === 'calidad').reduce((acc, k) => acc + (metrics.qualityCompliancesMap[k.id] ?? 100), 0) / 
                        Math.max(1, kpis.filter(k => k.category === 'calidad').length)
                      ).toFixed(1)}%
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${kpis.filter(k => k.category === 'calidad').reduce((acc, k) => acc + (metrics.qualityCompliancesMap[k.id] ?? 100), 0) / Math.max(1, kpis.filter(k => k.category === 'calidad').length)}%`, 
                        height: '100%', 
                        background: 'var(--secondary)', 
                        borderRadius: '4px' 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Seguridad */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Seguridad (Ponderación 10%)</span>
                    <strong>
                      {(
                        kpis.filter(k => k.category === 'seguridad').reduce((acc, k) => acc + (metrics.safetyCompliancesMap[k.id] ?? 100), 0) / 
                        Math.max(1, kpis.filter(k => k.category === 'seguridad').length)
                      ).toFixed(1)}%
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${kpis.filter(k => k.category === 'seguridad').reduce((acc, k) => acc + (metrics.safetyCompliancesMap[k.id] ?? 100), 0) / Math.max(1, kpis.filter(k => k.category === 'seguridad').length)}%`, 
                        height: '100%', 
                        background: '#10b981', 
                        borderRadius: '4px' 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Asistencia */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Asistencia de Dotación Semanal (Ponderación 10%)</span>
                    <strong>{metrics.attendanceCompliance.toFixed(1)}%</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${metrics.attendanceCompliance}%`, height: '100%', background: 'var(--color-mantencionpreventiva)', borderRadius: '4px' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const edpResult = getEDPMultiplier(metrics.weightedScore);
            const finalPayment = (edpAmount * edpResult.multiplier) / 100;
            const discountValue = edpAmount - finalPayment;

            return (
              <div className="glass table-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Multiplicador de Estado de Pago (EDP) según MDC</span>
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  {/* Left Column: Result & Calculator */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--border-color)', paddingRight: '24px' }}>
                    <div style={{ background: 'var(--primary-glow)', padding: '16px', borderRadius: '12px', border: '1px solid var(--primary-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Rango MDC Activo</span>
                        <h4 style={{ margin: '4px 0 0 0', color: 'var(--primary-light)', fontSize: '1.2rem', fontWeight: '700' }}>{edpResult.range}</h4>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Multiplicador / Descuento</span>
                        <h4 style={{ margin: '4px 0 0 0', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: '700' }}>
                          {edpResult.multiplier}% / -{edpResult.discount}%
                        </h4>
                      </div>
                    </div>

                    {/* Simulation calculator */}
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: '700' }}>Simulador de Facturación</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Monto Estado de Pago Mensual (CLP)</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              type="number" 
                              value={edpAmount} 
                              onChange={(e) => setEdpAmount(parseFloat(e.target.value) || 0)}
                              style={{ 
                                flex: 1,
                                padding: '8px 12px', 
                                borderRadius: '8px', 
                                border: '1px solid var(--border-color)', 
                                background: 'var(--bg-input)', 
                                color: 'var(--text-input)',
                                fontSize: '0.9rem' 
                              }} 
                            />
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEdpAmount(20000000)}
                              style={{ padding: '0 12px' }}
                            >
                              Ejemplo 20M
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                          <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total a Pagar ({edpResult.multiplier}%)</span>
                            <strong style={{ fontSize: '1.05rem', color: 'var(--color-operativo)' }}>
                              ${Math.round(finalPayment).toLocaleString('es-CL')}
                            </strong>
                          </div>
                          <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Descuento ({edpResult.discount}%)</span>
                            <strong style={{ fontSize: '1.05rem', color: edpResult.discount > 0 ? 'var(--color-mantencioncorrectiva)' : 'var(--text-secondary)' }}>
                              ${Math.round(discountValue).toLocaleString('es-CL')}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Reference Table */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '700' }}>Tabla del Multiplicador Contractual</h4>
                    <div className="table-wrapper">
                      <table style={{ fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th>Rango MDC</th>
                            <th style={{ textAlign: 'center' }}>Multiplicador</th>
                            <th style={{ textAlign: 'center' }}>Descuento</th>
                            <th style={{ textAlign: 'center' }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { min: 100, max: null, mult: 100, disc: 0, range: 'MDC ≥ 100%' },
                            { min: 96, max: 100, mult: 98, disc: 2, range: '96% ≤ MDC < 100%' },
                            { min: 87, max: 96, mult: 96, disc: 4, range: '87% ≤ MDC < 96%' },
                            { min: 77, max: 87, mult: 94, disc: 6, range: '77% ≤ MDC < 87%' },
                            { min: 67, max: 77, mult: 92, disc: 8, range: '67% ≤ MDC < 77%' },
                            { min: 0, max: 67, mult: 90, disc: 10, range: '0% ≤ MDC < 67%' },
                          ].map((row, idx) => {
                            const score = metrics.weightedScore;
                            const isActiveRange = 
                              row.max === null 
                                ? score >= row.min 
                                : (score >= row.min && score < row.max);

                            return (
                              <tr 
                                key={idx} 
                                style={{ 
                                  background: isActiveRange ? 'var(--primary-glow)' : 'transparent',
                                  fontWeight: isActiveRange ? '700' : 'normal',
                                  borderLeft: isActiveRange ? '4px solid var(--primary)' : '4px solid transparent'
                                }}
                              >
                                <td>{row.range}</td>
                                <td style={{ textAlign: 'center', color: isActiveRange ? 'var(--primary-light)' : 'inherit' }}>{row.mult}%</td>
                                <td style={{ textAlign: 'center', color: row.disc > 0 ? 'var(--color-mantencioncorrectiva)' : 'var(--text-muted)' }}>
                                  {row.disc > 0 ? `-${row.disc}%` : '0%'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {isActiveRange ? (
                                    <span className="badge badge-operativo" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Activo</span>
                                  ) : (
                                    <span style={{ opacity: 0.3 }}>-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TABLE 1: DISPONIBILIDAD Y MATERIAS PRIMAS */}
          <div className="glass table-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '12px' }}>
              1. Evaluación de Disponibilidad de Flota y Materias Primas
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item Evaluado</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Ponderación</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Medición</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Mínimo</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Esperada</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Máxima</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Valor Real</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>Valor Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.filter(k => k.category === 'disponibilidad').map(k => {
                    let realVal = 100.0;
                    let isExcluded = false;

                    if (k.id === 'kpi-camiones') {
                      realVal = metrics.byType['Camión Fábrica']?.contractualAvailability ?? 100.0;
                      if (!selectedTypes.includes('Camión Fábrica')) isExcluded = true;
                    } else if (k.id === 'kpi-cargadores') {
                      realVal = metrics.byType['Cargador Frontal']?.contractualAvailability ?? 100.0;
                      if (!selectedTypes.includes('Cargador Frontal')) isExcluded = true;
                    } else if (k.id === 'kpi-polvorines') {
                      realVal = metrics.byType['Polvorín Móvil']?.contractualAvailability ?? 100.0;
                      if (!selectedTypes.includes('Polvorín Móvil')) isExcluded = true;
                    } else if (k.id === 'kpi-insumos') {
                      realVal = metrics.rawMaterialsCompliance;
                    }

                    const weightedVal = isExcluded ? 0 : (k.weight * realVal) / 100;

                    return (
                      <tr key={k.id} style={{ opacity: isExcluded ? 0.4 : 1 }}>
                        <td style={{ fontWeight: '600' }}>{k.name}</td>
                        <td style={{ textAlign: 'center' }}>{k.weight}%</td>
                        <td style={{ textAlign: 'center' }}>{k.unit}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.minVal}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.expectedVal}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.maxVal}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {isExcluded ? 'N/A' : `${realVal.toFixed(1)}%`}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                          {isExcluded ? 'Excluido' : `${weightedVal.toFixed(2)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2: CALIDAD DE SERVICIO (Valor Real editable inline!) */}
          <div className="glass table-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '12px' }}>
              2. Evaluación de Calidad de Servicio
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item Evaluado</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Ponderación</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Medición</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Mínimo</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Esperada</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Máxima</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>Valor Real</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>% Valor Real</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>Valor Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.filter(k => k.category === 'calidad').map(k => {
                    const stateVal = getQualityKPIState(k.id);
                    const realVal = stateVal.realValue;
                    const compPct = stateVal.compliancePct;
                    const weightedVal = (k.weight * compPct) / 100;
                    const isEventUnitBased = ['kpi-tiros-quedados', 'kpi-ptq', 'kpi-flyrock', 'kpi-vod', 'kpi-gases'].includes(k.id);

                    return (
                      <tr key={k.id}>
                        <td style={{ fontWeight: '600' }}>{k.name}</td>
                        <td style={{ textAlign: 'center' }}>{k.weight}%</td>
                        <td style={{ textAlign: 'center' }}>{k.unit}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.minVal}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.expectedVal}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.maxVal}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="0"
                              max={isEventUnitBased ? undefined : 100}
                              value={realVal}
                              disabled={currentUser.role === 'Usuario'}
                              onChange={(e) => {
                                const newVal = parseFloat(e.target.value) || 0;
                                const comp = isEventUnitBased ? calculateQualityKPICompliance(k.id, newVal) : newVal;
                                setPeriodCompliancesState(prev => ({
                                  ...prev,
                                  [k.id]: { realValue: newVal, compliancePct: comp }
                                }));
                              }}
                              style={{ width: '75px', padding: '4px', textAlign: 'center', fontWeight: 'bold', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                            />
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                              {k.unit === '%' ? '%' : ''}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {compPct.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                          {weightedVal.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 3: ROSTER / ASSIST (Moved to 3rd position - Dotación Semanal) */}
          <div className="glass table-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-mantencionpreventiva)', marginBottom: '12px' }}>
              3. Evaluación de Dotación Semanal
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item Evaluado</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Ponderación</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Medición</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Mínimo</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Esperada</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Máxima</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Valor Real</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>Valor Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.filter(k => k.category === 'dotacion').map(k => {
                    const realVal = metrics.attendanceCompliance;
                    const weightedVal = (k.weight * realVal) / 100;

                    return (
                      <tr key={k.id}>
                        <td style={{ fontWeight: '600' }}>{k.name}</td>
                        <td style={{ textAlign: 'center' }}>{k.weight}%</td>
                        <td style={{ textAlign: 'center' }}>{k.unit}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.minVal}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.expectedVal}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.maxVal}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{realVal.toFixed(1)}%</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                          {weightedVal.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 4: SEGURIDAD (Moved to 4th position - Seguridad) */}
          <div className="glass table-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#10b981', marginBottom: '12px' }}>
              4. Evaluación de Seguridad
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item Evaluado</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Ponderación</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Medición</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Meta</th>
                    <th style={{ width: '160px', textAlign: 'center' }}>Valor Real</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>% Cumplimiento</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>Valor Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.filter(k => k.category === 'seguridad').map((k, idx) => {
                    const realVal = periodCompliancesState[k.id]?.realValue ?? 0;
                    const compPct = metrics.safetyCompliancesMap[k.id] ?? 100.0;
                    const weightedVal = (k.weight * compPct) / 100;
                    const isLowerHalf = idx >= 3;

                    return (
                      <tr key={k.id}>
                        <td style={{ fontWeight: '600' }}>
                          <span 
                            style={{ position: 'relative', display: 'inline-block' }}
                            onMouseEnter={() => setHoveredKpiId(k.id)}
                            onMouseLeave={() => setHoveredKpiId(null)}
                          >
                            <span style={{ borderBottom: '1px dotted var(--primary)', cursor: 'help' }}>
                              {k.name}
                            </span>
                            {hoveredKpiId === k.id && SAFETY_KPI_DESCRIPTIONS[k.id] && (
                              <div className="glass" style={{
                                position: 'absolute',
                                left: '100%',
                                top: isLowerHalf ? 'auto' : '0',
                                bottom: isLowerHalf ? '0' : 'auto',
                                marginLeft: '8px',
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
                                  {SAFETY_KPI_DESCRIPTIONS[k.id].title}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                                  {SAFETY_KPI_DESCRIPTIONS[k.id].desc}
                                </p>
                              </div>
                            )}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{k.weight}%</td>
                        <td style={{ textAlign: 'center' }}>{k.unit}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                          {k.id === 'kpi-seg-auditorias' ? '>= 90%' : '0 incidentes'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {k.id === 'kpi-seg-auditorias' ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={realVal}
                                disabled={currentUser.role === 'Usuario'}
                                onChange={(e) => {
                                  const newVal = parseFloat(e.target.value) || 0;
                                  let comp = 100.0;
                                  if (newVal >= 90) comp = 100.0;
                                  else if (newVal >= 70) comp = 75.0;
                                  else if (newVal >= 26) comp = 50.0;
                                  else comp = 0.0;

                                  setPeriodCompliancesState(prev => ({
                                    ...prev,
                                    [k.id]: { realValue: newVal, compliancePct: comp }
                                  }));
                                }}
                                style={{ width: '80px', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}
                              />
                              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>%</span>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="number"
                                min="0"
                                value={realVal}
                                disabled={currentUser.role === 'Usuario'}
                                onChange={(e) => {
                                  const newVal = parseInt(e.target.value) || 0;
                                  let comp = 100.0;
                                  if (k.id === 'kpi-seg-trirf') {
                                    if (newVal === 1) comp = 50.0;
                                    else if (newVal >= 2) comp = 0.0;
                                  } else if (k.id === 'kpi-seg-notrirf' || k.id === 'kpi-seg-legal') {
                                    if (newVal === 1) comp = 75.0;
                                    else if (newVal === 2) comp = 50.0;
                                    else if (newVal >= 3) comp = 0.0;
                                  } else if (k.id === 'kpi-seg-incumplimiento') {
                                    if (newVal === 1 || newVal === 2) comp = 75.0;
                                    else if (newVal === 3 || newVal === 4) comp = 50.0;
                                    else if (newVal >= 5) comp = 0.0;
                                  }

                                  setPeriodCompliancesState(prev => ({
                                    ...prev,
                                    [k.id]: { realValue: newVal, compliancePct: comp }
                                  }));
                                }}
                                style={{ width: '70px', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.unit}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: compPct === 100 ? 'var(--color-operativo)' : compPct >= 50 ? 'var(--color-mantencionprogramada)' : 'var(--color-mantencioncorrectiva)' }}>
                          {compPct.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                          {weightedVal.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detailed Downtime View */}
      {modalEqId && modalEq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'slideIn 0.15s ease-out'
        }}>
          <div className="glass table-card" style={{ width: '90%', maxWidth: '800px', padding: '30px', position: 'relative' }}>
            <button 
              onClick={() => setModalEqId(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <h2 className="chart-title" style={{ margin: '0 0 8px 0' }}>
              Detalle de Inactividad: {modalEq.name}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px', marginTop: 0 }}>
              Tipo: <strong>{modalEq.type}</strong> | Patente: <code>{modalEq.patent || '-'}</code>
            </p>

            <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'center' }}>Rango Horas</th>
                    <th style={{ textAlign: 'center' }}>Horas Fuera Serv.</th>
                    <th style={{ textAlign: 'center' }}>Post-Tronadura</th>
                    <th>Detalle de Falla / Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {modalRecords.map(r => {
                    const totalDown = r.endHour - r.startHour;
                    return (
                      <tr key={r.id}>
                        <td><code>{formatToDDMMYYYY(r.date)}</code></td>
                        <td>
                          <span className={`badge badge-${getStatusClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <code>{r.startHour < 10 ? `0${r.startHour}:00` : `${r.startHour}:00`} - {r.endHour < 10 ? `0${r.endHour}:00` : `${r.endHour}:00`}</code>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-mantencioncorrectiva)' }}>
                          {totalDown} hrs
                        </td>
                        <td style={{ textAlign: 'center', color: r.hoursPostBlasting > 0 ? 'var(--color-operativo)' : 'var(--text-muted)' }}>
                          {r.hoursPostBlasting > 0 ? `-${r.hoursPostBlasting} hrs` : '0 hrs'}
                        </td>
                        <td style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>{r.comment || 'Sin comentarios.'}</td>
                      </tr>
                    );
                  })}

                  {modalRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        No hay fallas o mantenciones registradas en el período seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setModalEqId(null)}>
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRoleForModal && (
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
          zIndex: 1000
        }}>
          <div className="glass modal-content" style={{
            width: '90%',
            maxWidth: '650px',
            maxHeight: '85vh',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-xl)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Detalle de Asistencia: {selectedRoleForModal}
              </h3>
              <button 
                onClick={() => setSelectedRoleForModal(null)} 
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

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Desglose diario del período del <strong>{formatToDDMMYYYY(startDate)}</strong> al <strong>{formatToDDMMYYYY(endDate)}</strong>.
            </p>

            <div className="table-wrapper">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'center' }}>Requerido</th>
                    <th style={{ textAlign: 'center' }}>Asistencia Real</th>
                    <th style={{ textAlign: 'center' }}>% Cumplimiento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {modalData.map(d => {
                    const formattedDate = formatToDDMMYYYY(d.date);
                    const isUnder = !d.isRestDay && d.attended < d.required;
                    
                    return (
                      <tr key={d.date} style={{ background: d.isRestDay ? 'rgba(0,0,0,0.02)' : 'none' }}>
                        <td style={{ fontWeight: '600' }}>{formattedDate}</td>
                        <td style={{ textAlign: 'center' }}>
                          {d.isRestDay ? <span style={{ color: 'var(--text-muted)' }}>Descanso</span> : `${d.required} pers`}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: isUnder ? 'var(--color-mantencioncorrectiva)' : 'inherit' }}>
                          {d.isRestDay ? '-' : `${d.attended} pers`}
                        </td>
                        <td style={{ 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          color: d.isRestDay ? 'var(--text-muted)' : d.compliance >= 100 ? 'var(--color-operativo)' : 'var(--color-mantencioncorrectiva)'
                        }}>
                          {d.isRestDay ? '100%' : `${d.compliance}%`}
                        </td>
                        <td>
                          {d.isRestDay ? (
                            <span className="badge badge-operativo" style={{ opacity: 0.6 }}>Día Libre (4x3)</span>
                          ) : isUnder ? (
                            <span className="badge badge-mantencioncorrectiva">⚠ Faltas</span>
                          ) : (
                            <span className="badge badge-operativo">✓ Conforme</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getContractScoreBadge(score: number) {
  if (score >= 95) {
    return { text: 'EXCELENTE 🟢', bg: 'var(--color-operativo-bg)', color: 'var(--color-operativo)' };
  } else if (score >= 90) {
    return { text: 'ESPERADO 🟡', bg: 'var(--color-mantencionprogramada-bg)', color: 'var(--color-mantencionprogramada)' };
  } else {
    return { text: 'MÍNIMO 🔴', bg: 'var(--color-mantencioncorrectiva-bg)', color: 'var(--color-mantencioncorrectiva)' };
  }
}
