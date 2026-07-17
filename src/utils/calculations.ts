import type { Equipment, AvailabilityRecord, ContractSettings } from '../services/db';

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

export const calculateMetrics = (
  fleet: Equipment[],
  records: AvailabilityRecord[],
  settings: ContractSettings,
  daysCount: number,
  selectedTypes: Equipment['type'][] = ['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil', 'Camioneta']
): {
  overallPhysical: number;
  overallContractual: number;
  byType: Partial<Record<Equipment['type'], TypeMetrics>>;
  dailyHistory: DailyAvailability[];
  faultBreakdown: { name: string; value: number }[];
} => {
  const types = selectedTypes;
  
  const getRequiredCount = (type: Equipment['type']): number => {
    switch (type) {
      case 'Camión Fábrica': return settings.requiredFactoryTrucks;
      case 'Cargador Frontal': return settings.requiredFrontLoaders;
      case 'Polvorín Móvil': return settings.requiredPowderKegs;
      case 'Camioneta': return settings.requiredPickups;
    }
  };

  // Group records by date
  const recordsByDate: Record<string, AvailabilityRecord[]> = {};
  records.forEach(r => {
    if (!recordsByDate[r.date]) {
      recordsByDate[r.date] = [];
    }
    recordsByDate[r.date].push(r);
  });

  const dates = Object.keys(recordsByDate).sort();

  // Initialize metrics by type
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

  // Calculate daily history
  const dailyHistory: DailyAvailability[] = [];
  let totalContractTargetHours = 0;
  let totalContractDeliveredHours = 0;
  let totalPhysicalTargetHours = 0;
  let totalPhysicalDeliveredHours = 0;

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

      // Total physical target hours for this type on this day
      // (If there are no records yet, we assume they are 100% available or count 0?
      // Since seed has all records, we sum existing records or calculate based on fleet size)
      const fleetSize = typeEquipment.length;
      dayPhysicalTarget += fleetSize * 12;
      
      let typeDayAvailableHours = 0;
      typeRecords.forEach(r => {
        typeDayAvailableHours += r.hoursAvailable;
      });

      dayPhysicalDelivered += typeDayAvailableHours;

      // Contract calculations:
      const typeContractTarget = required * 12;
      const typeContractDelivered = Math.min(typeDayAvailableHours, typeContractTarget);

      dayContractTarget += typeContractTarget;
      dayContractDelivered += typeContractDelivered;

      // Accumulate into totals by type
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

  // Calculate final percentages by type
  types.forEach(t => {
    const typeEqList = fleet.filter(eq => eq.type === t);
    const required = getRequiredCount(t);
    
    // Physical availability over the period
    const totalPhysicalTarget = typeEqList.length * 12 * Math.max(1, dates.length);
    byType[t].physicalAvailability = totalPhysicalTarget > 0 
      ? (byType[t].hoursAvailable / totalPhysicalTarget) * 100 
      : 100;

    // Contractual availability over the period (summing the capped daily hours)
    let totalCappedContractHours = 0;
    dates.forEach(date => {
      const dayRecords = recordsByDate[date] || [];
      const typeRecords = dayRecords.filter(r => {
        const eq = fleet.find(f => f.id === r.equipmentId);
        return eq?.type === t;
      });
      
      let daySum = 0;
      typeRecords.forEach(r => { daySum += r.hoursAvailable; });
      
      totalCappedContractHours += Math.min(daySum, required * 12);
    });

    const totalContractTarget = required * 12 * Math.max(1, dates.length);
    byType[t].contractualAvailability = totalContractTarget > 0 
      ? (totalCappedContractHours / totalContractTarget) * 100 
      : 100;
  });

  // Fault breakdown (status other than 'Operativo')
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
    // Empty chart fallback
    faultBreakdown.push({ name: 'Sin fallas', value: 0 });
  }

  return {
    overallPhysical: totalPhysicalTargetHours > 0 ? (totalPhysicalDeliveredHours / totalPhysicalTargetHours) * 100 : 100,
    overallContractual: totalContractTargetHours > 0 ? (totalContractDeliveredHours / totalContractTargetHours) * 100 : 100,
    byType,
    dailyHistory,
    faultBreakdown
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

  // Map data to rows
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
      `"${(r.comment || '').replace(/"/g, '""')}"` // Escape quotes
    ];
  });

  // Join headers and rows
  const csvContent = [
    headers.join(';'),
    ...rows.map(e => e.join(';'))
  ].join('\n');

  // Create a Blob with UTF-8 BOM to ensure Excel opens special characters correctly
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
