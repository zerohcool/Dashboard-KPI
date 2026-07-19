import type { 
  Equipment, AvailabilityRecord, ContractSettings, 
  DailyRawMaterials, ContractKPI, DailyQualityCompliance, 
  ContractRole, WeeklyAttendance, PeriodCompliance 
} from '../services/db';
import { getWednesdayStartDate, getRoleShiftType } from '../services/db';

export const calculateQualityKPICompliance = (kpiId: string, realValue: number): number => {
  if (kpiId === 'kpi-tiros-quedados') {
    return realValue === 0 ? 100.0 : 0.0;
  }
  if (kpiId === 'kpi-ptq') {
    if (realValue <= 3) return 100.0;
    if (realValue === 4) return 75.0;
    return 0.0;
  }
  if (kpiId === 'kpi-flyrock') {
    return realValue === 0 ? 100.0 : 0.0;
  }
  if (kpiId === 'kpi-vod') {
    if (realValue >= 8) return 100.0;
    if (realValue >= 6) return 75.0;
    if (realValue >= 4) return 50.0;
    return 0.0;
  }
  if (kpiId === 'kpi-gases') {
    return realValue <= 1 ? 100.0 : 0.0;
  }
  return Math.min(100, Math.max(0, realValue));
};

export const getPluralType = (type: string): string => {
  switch (type) {
    case 'Camión Fábrica': return 'Camiones Fábrica';
    case 'Cargador Frontal': return 'Cargadores Frontales';
    case 'Polvorín Móvil': return 'Polvorines Móviles';
    case 'Camioneta': return 'Camionetas';
    default: return type;
  }
};

export interface DailyAvailability {
  date: string;
  physicalAvail: number;
  contractAvail: number;
}

export interface TypeMetrics {
  type: Equipment['type'];
  totalEquipment: number;
  contractRequired: number;
  hoursAvailable: number;
  hoursTarget: number;
  physicalAvailability: number;
  contractualAvailability: number;
}

export interface DetailedRecordRow {
  date: string;
  equipmentName: string;
  equipmentType: string;
  patent: string;
  isContractual: string;
  status: string;
  hoursAvailable: number;
  hoursOutOfService: number;
  comment: string;
}

interface Interval {
  start: number;
  end: number;
}

export const calculateTypeDailyHours = (
  requiredCount: number,
  records: AvailabilityRecord[]
): {
  contractDelivered: number;
  contractTarget: number;
  backupCovered: number;
  uncoveredDown: number;
} => {
  const contractTarget = requiredCount * 12;
  const N = records.length;
  
  if (N === 0) {
    return {
      contractDelivered: 0,
      contractTarget,
      backupCovered: 0,
      uncoveredDown: contractTarget
    };
  }

  const B = Math.max(0, N - requiredCount);

  const downIntervals: Interval[] = [];
  records.forEach(r => {
    if (r.status !== 'Operativo') {
      const start = r.startHour;
      const end = r.endHour - (r.hoursPostBlasting || 0);
      if (start < end) {
        downIntervals.push({ start, end });
      }
    }
  });

  const deficitUnits = Math.max(0, requiredCount - N);
  const deficitHours = deficitUnits * 12;

  if (downIntervals.length === 0) {
    return {
      contractDelivered: Math.max(0, contractTarget - deficitHours),
      contractTarget,
      backupCovered: 0,
      uncoveredDown: deficitHours
    };
  }

  const timePointsSet = new Set<number>();
  timePointsSet.add(7.0);
  timePointsSet.add(19.0);
  downIntervals.forEach(inv => {
    timePointsSet.add(inv.start);
    timePointsSet.add(inv.end);
  });

  const T = Array.from(timePointsSet).sort((a, b) => a - b);
  
  let totalUncoveredHours = 0;
  let totalBackupCoveredHours = 0;

  for (let i = 0; i < T.length - 1; i++) {
    const tStart = T[i];
    const tEnd = T[i + 1];
    if (tStart >= 19.0 || tEnd <= 7.0) continue;

    const width = tEnd - tStart;
    const mid = (tStart + tEnd) / 2;

    let activeDownCount = 0;
    downIntervals.forEach(inv => {
      if (mid >= inv.start && mid <= inv.end) {
        activeDownCount++;
      }
    });

    const uncoveredRate = Math.max(0, activeDownCount - B);
    const coveredRate = Math.min(activeDownCount, B);

    totalUncoveredHours += uncoveredRate * width;
    totalBackupCoveredHours += coveredRate * width;
  }

  const contractDelivered = Math.max(0, contractTarget - deficitHours - totalUncoveredHours);

  return {
    contractDelivered,
    contractTarget,
    backupCovered: totalBackupCoveredHours,
    uncoveredDown: totalUncoveredHours + deficitHours
  };
};

export const calculateMetrics = (
  fleet: Equipment[],
  records: AvailabilityRecord[],
  settings: ContractSettings,
  daysCount: number,
  selectedTypes: Equipment['type'][] = ['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil', 'Camioneta'],
  startDate?: string,
  endDate?: string,
  rawMaterials: DailyRawMaterials[] = [],
  qualityCompliances: DailyQualityCompliance[] = [],
  weeklyAttendances: WeeklyAttendance[] = [],
  kpis: ContractKPI[] = [],
  roles: ContractRole[] = [],
  periodCompliances: PeriodCompliance[] = [] // NEW ARGUMENT (PHASE 17)
): {
  overallPhysical: number;
  overallContractual: number;
  byType: Partial<Record<Equipment['type'], TypeMetrics>>;
  dailyHistory: DailyAvailability[];
  faultBreakdown: { name: string; value: number }[];
  totalBackupCoveredHours: number;
  rawMaterialsCompliance: number;
  qualityCompliancesMap: Record<string, number>;
  safetyCompliancesMap: Record<string, number>; // NEW OUTPUT (PHASE 17)
  attendanceCompliance: number;
  weightedScore: number;
} => {
  const types = selectedTypes;
  void qualityCompliances;
  
  const getRequiredCount = (type: Equipment['type']): number => {
    switch (type) {
      case 'Camión Fábrica': return settings.requiredFactoryTrucks;
      case 'Cargador Frontal': return settings.requiredFrontLoaders;
      case 'Polvorín Móvil': return settings.requiredPowderKegs;
      case 'Camioneta': return settings.requiredPickups;
    }
  };

  const recordsByDate: Record<string, AvailabilityRecord[]> = {};
  records.forEach(r => {
    if (!recordsByDate[r.date]) {
      recordsByDate[r.date] = [];
    }
    recordsByDate[r.date].push(r);
  });

  const dates = Object.keys(recordsByDate).sort();

  const byType = {} as Record<Equipment['type'], TypeMetrics>;
  types.forEach(t => {
    const eqList = fleet.filter(eq => eq.type === t);
    byType[t] = {
      type: t,
      totalEquipment: eqList.length,
      contractRequired: getRequiredCount(t),
      hoursAvailable: 0,
      hoursTarget: getRequiredCount(t) * 12 * Math.max(1, daysCount),
      physicalAvailability: 0,
      contractualAvailability: 0
    };
  });

  const dailyHistory: DailyAvailability[] = [];
  let totalContractTargetHours = 0;
  let totalContractDeliveredHours = 0;
  let totalPhysicalTargetHours = 0;
  let totalPhysicalDeliveredHours = 0;
  let totalBackupCoveredHours = 0;

  dates.forEach(date => {
    const dayRecords = recordsByDate[date] || [];
    let dayPhysicalDelivered = 0;
    let dayPhysicalTarget = 0;
    
    let dayContractDelivered = 0;
    let dayContractTarget = 0;

    types.forEach(t => {
      const typeEquipment = fleet.filter(eq => eq.type === t);
      const typeEqIds = new Set(typeEquipment.map(eq => eq.id));
      const typeRecords = dayRecords.filter(r => typeEqIds.has(r.equipmentId));
      const required = getRequiredCount(t);

      const fleetSize = typeEquipment.length;
      dayPhysicalTarget += fleetSize * 12;
      
      let typeDayAvailableHours = 0;
      typeRecords.forEach(r => {
        typeDayAvailableHours += r.hoursAvailable;
      });

      dayPhysicalDelivered += typeDayAvailableHours;

      const dayHours = calculateTypeDailyHours(required, typeRecords);
      
      dayContractTarget += dayHours.contractTarget;
      dayContractDelivered += dayHours.contractDelivered;
      totalBackupCoveredHours += dayHours.backupCovered;

      byType[t].hoursAvailable += typeDayAvailableHours;
    });

    totalPhysicalTargetHours += dayPhysicalTarget;
    totalPhysicalDeliveredHours += dayPhysicalDelivered;
    totalContractTargetHours += dayContractTarget;
    totalContractDeliveredHours += dayContractDelivered;

    dailyHistory.push({
      date,
      physicalAvail: dayPhysicalTarget > 0 ? (dayPhysicalDelivered / dayPhysicalTarget) * 100 : 100,
      contractAvail: dayContractTarget > 0 ? (dayContractDelivered / dayContractTarget) * 100 : 100
    });
  });

  types.forEach(t => {
    const typeEqList = fleet.filter(eq => eq.type === t);
    const required = getRequiredCount(t);
    
    const totalPhysicalTarget = typeEqList.length * 12 * Math.max(1, dates.length);
    byType[t].physicalAvailability = totalPhysicalTarget > 0 
      ? (byType[t].hoursAvailable / totalPhysicalTarget) * 100 
      : 100;

    let totalCappedContractHours = 0;
    dates.forEach(date => {
      const dayRecords = recordsByDate[date] || [];
      const typeRecords = dayRecords.filter(r => {
        const eq = fleet.find(f => f.id === r.equipmentId);
        return eq?.type === t;
      });
      
      const dayHours = calculateTypeDailyHours(required, typeRecords);
      totalCappedContractHours += dayHours.contractDelivered;
    });

    const totalContractTarget = required * 12 * Math.max(1, dates.length);
    byType[t].contractualAvailability = totalContractTarget > 0 
      ? (totalCappedContractHours / totalContractTarget) * 100 
      : 100;
  });

  const faultCounts: Record<string, number> = {
    'Mantención Programada': 0,
    'Mantención Preventiva': 0,
    'Mantención Predictiva': 0,
    'Mantención Correctiva': 0
  };

  records.forEach(r => {
    const eq = fleet.find(f => f.id === r.equipmentId);
    if (eq && selectedTypes.includes(eq.type) && r.status !== 'Operativo') {
      const effectiveDown = r.hoursOutOfService - (r.hoursPostBlasting || 0);
      if (effectiveDown > 0) {
        faultCounts[r.status] += effectiveDown;
      }
    }
  });

  const faultBreakdown = Object.keys(faultCounts).map(name => ({
    name,
    value: faultCounts[name]
  })).filter(item => item.value > 0);

  if (faultBreakdown.length === 0) {
    faultBreakdown.push({ name: 'Sin fallas', value: 0 });
  }

  // 1. Raw Materials compliance
  let rawMaterialsCompliance = 100.0;
  if (startDate && endDate && dates.length > 0) {
    let dayCompSum = 0;
    const insumosKpi = kpis.find(k => k.id === 'kpi-insumos');
    const targetStock = insumosKpi ? parseFloat(insumosKpi.expectedVal) || 200 : 200;

    dates.forEach(dateStr => {
      const row = rawMaterials.find(rm => rm.date === dateStr);
      const nitrato = row ? row.nitratoStock : targetStock;
      const matriz = row ? row.matrizStock : targetStock;
      const nitratoComp = Math.min(100, (nitrato / targetStock) * 100);
      const matrizComp = Math.min(100, (matriz / targetStock) * 100);
      dayCompSum += (nitratoComp + matrizComp) / 2;
    });
    rawMaterialsCompliance = dayCompSum / dates.length;
  }

  // 2. Service Quality compliance map (read from periodCompliances first)
  const qualityCompliancesMap: Record<string, number> = {};
  const qualityKpis = kpis.filter(k => k.category === 'calidad');
  
  qualityKpis.forEach(k => {
    const pRecord = periodCompliances.find(p => p.kpiId === k.id);
    if (pRecord) {
      if (['kpi-tiros-quedados', 'kpi-ptq', 'kpi-flyrock', 'kpi-vod', 'kpi-gases'].includes(k.id)) {
        qualityCompliancesMap[k.id] = calculateQualityKPICompliance(k.id, pRecord.realValue);
      } else {
        qualityCompliancesMap[k.id] = pRecord.compliancePct;
      }
    } else {
      if (k.id === 'kpi-tiros-quedados') qualityCompliancesMap[k.id] = 100.0;
      else if (k.id === 'kpi-ptq') qualityCompliancesMap[k.id] = 100.0;
      else if (k.id === 'kpi-flyrock') qualityCompliancesMap[k.id] = 100.0;
      else if (k.id === 'kpi-vod') qualityCompliancesMap[k.id] = 100.0;
      else if (k.id === 'kpi-gases') qualityCompliancesMap[k.id] = 100.0;
      else qualityCompliancesMap[k.id] = 100.0; // default 100% compliance
    }
  });

  // 3. Safety compliance calculations (NEW PHASE 17)
  const safetyCompliancesMap: Record<string, number> = {};
  const safetyKpis = kpis.filter(k => k.category === 'seguridad');

  safetyKpis.forEach(k => {
    const pRecord = periodCompliances.find(p => p.kpiId === k.id);
    const realValue = pRecord ? pRecord.realValue : 0; // default 0 incidents/infractions

    let comp = 100.0;
    if (k.id === 'kpi-seg-trirf') {
      if (realValue === 1) comp = 50.0;
      else if (realValue >= 2) comp = 0.0;
    } 
    else if (k.id === 'kpi-seg-notrirf' || k.id === 'kpi-seg-legal') {
      if (realValue === 1) comp = 75.0;
      else if (realValue === 2) comp = 50.0;
      else if (realValue >= 3) comp = 0.0;
    } 
    else if (k.id === 'kpi-seg-auditorias') {
      // realValue represents the audit score percentage (default 100)
      const score = pRecord ? pRecord.realValue : 100.0;
      if (score >= 90.0) comp = 100.0;
      else if (score >= 70.0) comp = 75.0;
      else if (score >= 26.0) comp = 50.0;
      else comp = 0.0;
    } 
    else if (k.id === 'kpi-seg-incumplimiento') {
      if (realValue === 1 || realValue === 2) comp = 75.0;
      else if (realValue === 3 || realValue === 4) comp = 50.0;
      else if (realValue >= 5) comp = 0.0;
    }

    safetyCompliancesMap[k.id] = comp;
  });

  // 4. Attendance compliance with shift-split turn division (7x7 divided by 2)
  let attendanceCompliance = 100.0;
  if (startDate && endDate && dates.length > 0 && roles.length > 0) {
    let totalAttendedSum = 0;
    let totalRequiredSum = 0;
    
    dates.forEach(dateStr => {
      const wedDate = getWednesdayStartDate(dateStr);
      const att = weeklyAttendances.find(w => w.weekStartDate === wedDate);
      
      const d = new Date(dateStr + 'T12:00:00');
      const dayIdx = (d.getDay() + 4) % 7; // Wednesday is 0

      roles.forEach(r => {
        // Skip roles that do not affect the KPI (Enaex custom roles)
        if (r.affectsKPI === false) return;

        const shift = getRoleShiftType(r.roleName);
        // Skip Friday (2), Saturday (3), and Sunday (4) for 4x3 shift roles
        if (shift === '4x3' && (dayIdx === 2 || dayIdx === 3 || dayIdx === 4)) {
          return;
        }

        // Divide by 2 for 7x7 cargos
        const requiredDaily = shift === '7x7' ? r.requiredCount / 2 : r.requiredCount;
        
        const attended = (att && att.attendanceData[r.roleName])
          ? att.attendanceData[r.roleName][dayIdx]
          : requiredDaily; // default compliant if no logs exist
        
        totalAttendedSum += attended;
        totalRequiredSum += requiredDaily;
      });
    });

    attendanceCompliance = totalRequiredSum > 0 
      ? Math.min(100, (totalAttendedSum / totalRequiredSum) * 100) 
      : 100.0;
  }

  // 5. Final Weighted Score calculation
  let totalWeight = 0;
  let weightedSum = 0;

  kpis.forEach(k => {
    let isActive = true;
    if (k.id === 'kpi-camiones' && !selectedTypes.includes('Camión Fábrica')) isActive = false;
    if (k.id === 'kpi-cargadores' && !selectedTypes.includes('Cargador Frontal')) isActive = false;
    if (k.id === 'kpi-polvorines' && !selectedTypes.includes('Polvorín Móvil')) isActive = false;

    if (isActive) {
      let compliance = 100.0;
      if (k.id === 'kpi-camiones') {
        compliance = byType['Camión Fábrica']?.contractualAvailability ?? 100.0;
      } else if (k.id === 'kpi-cargadores') {
        compliance = byType['Cargador Frontal']?.contractualAvailability ?? 100.0;
      } else if (k.id === 'kpi-polvorines') {
        compliance = byType['Polvorín Móvil']?.contractualAvailability ?? 100.0;
      } else if (k.id === 'kpi-insumos') {
        compliance = rawMaterialsCompliance;
      } else if (k.category === 'calidad') {
        compliance = qualityCompliancesMap[k.id] ?? 100.0;
      } else if (k.id === 'kpi-dotacion-comprometida') {
        compliance = attendanceCompliance;
      } else if (k.category === 'seguridad') {
        compliance = safetyCompliancesMap[k.id] ?? 100.0;
      }

      totalWeight += k.weight;
      weightedSum += k.weight * compliance;
    }
  });

  const weightedScore = totalWeight > 0 ? (weightedSum / totalWeight) : 100.0;

  return {
    overallPhysical: totalPhysicalTargetHours > 0 ? (totalPhysicalDeliveredHours / totalPhysicalTargetHours) * 100 : 100,
    overallContractual: totalContractTargetHours > 0 ? (totalContractDeliveredHours / totalContractTargetHours) * 100 : 100,
    byType,
    dailyHistory,
    faultBreakdown,
    totalBackupCoveredHours,
    rawMaterialsCompliance,
    qualityCompliancesMap,
    safetyCompliancesMap,
    attendanceCompliance,
    weightedScore
  };
};

export const exportToCSV = (
  fleet: Equipment[],
  records: AvailabilityRecord[],
  fileName = 'reporte_disponibilidad.csv'
) => {
  const headers = [
    'Fecha',
    'Equipo',
    'Tipo de Equipo',
    'Patente',
    'Rol Contractual',
    'Estado',
    'Horas Disponibles',
    'Horas Fuera de Servicio',
    'Comentario / Causa'
  ];

  const rows = records.map(r => {
    const eq = fleet.find(e => e.id === r.equipmentId);
    return [
      r.date,
      eq ? eq.name : 'Desconocido',
      eq ? eq.type : 'Desconocido',
      eq ? eq.patent : '-',
      eq ? (eq.isContractual ? 'Obligado por Contrato' : 'Equipo de Respaldo') : '-',
      r.status,
      r.hoursAvailable.toString(),
      r.hoursOutOfService.toString(),
      `"${(r.comment || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(e => e.join(';'))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
