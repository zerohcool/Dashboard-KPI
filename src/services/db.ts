import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface Equipment {
  id: string;
  name: string;
  type: 'Camión Fábrica' | 'Cargador Frontal' | 'Polvorín Móvil' | 'Camioneta';
  patent: string;
  isContractual: boolean;
  createdAt: string;
}

export interface ContractSettings {
  requiredFactoryTrucks: number;
  requiredFrontLoaders: number;
  requiredPowderKegs: number;
  requiredPickups: number;
}

export interface AvailabilityRecord {
  id: string;
  equipmentId: string;
  date: string; // YYYY-MM-DD
  status: 'Operativo' | 'Mantención Programada' | 'Mantención Preventiva' | 'Mantención Predictiva' | 'Mantención Correctiva';
  startHour: number; // e.g. 7 to 19
  endHour: number;   // e.g. 7 to 19
  hoursOutOfService: number; // calculated: endHour - startHour
  hoursPostBlasting: number;  // calculated based on blastingTime of that date
  hoursAvailable: number;    // 12 - (hoursOutOfService - hoursPostBlasting)
  comment: string;
}

export interface DailyRawMaterials {
  date: string;
  nitratoStock: number;
  matrizStock: number;
}

export interface ContractKPI {
  id: string;
  category: 'disponibilidad' | 'calidad' | 'dotacion' | 'seguridad';
  name: string;
  weight: number;
  unit: string;
  periodicity: string;
  minVal: string;
  expectedVal: string;
  maxVal: string;
}

export interface DailyQualityCompliance {
  date: string;
  kpiId: string;
  compliancePct: number;
}

export interface ContractRole {
  roleName: string;
  requiredCount: number;
  affectsKPI: boolean;
}

export interface WeeklyAttendance {
  weekStartDate: string; // YYYY-MM-DD (Wednesday)
  attendanceData: Record<string, number[]>; // Maps roleName -> 7 numbers (Wednesday to Tuesday)
}

// NEW INTERFACE FOR PERIOD COMPLIANCE (PHASE 17)
export interface PeriodCompliance {
  startDate: string;
  endDate: string;
  kpiId: string;
  realValue: number;
  compliancePct: number;
}

const STORAGE_KEYS = {
  EQUIPMENT: 'disponibilidad_equipos_fleet',
  SETTINGS: 'disponibilidad_equipos_settings',
  RECORDS: 'disponibilidad_equipos_records',
  RAW_MATERIALS: 'disponibilidad_equipos_raw_materials',
  CONTRACT_KPIS: 'disponibilidad_equipos_contract_kpis',
  QUALITY_COMPLIANCE: 'disponibilidad_equipos_quality_compliance',
  CONTRACT_ROLES: 'disponibilidad_equipos_contract_roles',
  WEEKLY_ATTENDANCE: 'disponibilidad_equipos_weekly_attendance',
  PERIOD_COMPLIANCE: 'disponibilidad_equipos_period_compliance'
};

const DEFAULT_SETTINGS: ContractSettings = {
  requiredFactoryTrucks: 5,
  requiredFrontLoaders: 2,
  requiredPowderKegs: 2,
  requiredPickups: 8
};

// Seed KPIs list with 5 new safety KPIs (sum of safety is 10%)
const DEFAULT_CONTRACT_KPIS: ContractKPI[] = [
  // Disponibilidad e Materias Primas (31%)
  { id: 'kpi-camiones', category: 'disponibilidad', name: 'Disponibilidad de Camiones Fabrica', weight: 10, unit: '%', periodicity: 'diario', minVal: '85%', expectedVal: '90%', maxVal: '95%' },
  { id: 'kpi-cargadores', category: 'disponibilidad', name: 'Disponibilidad de Cargador frontales (Tapapozos)', weight: 8, unit: '%', periodicity: 'diario', minVal: '85%', expectedVal: '90%', maxVal: '95%' },
  { id: 'kpi-polvorines', category: 'disponibilidad', name: 'Disponibilidad de Polvorines Móviles', weight: 8, unit: '%', periodicity: 'diario', minVal: '85%', expectedVal: '90%', maxVal: '95%' },
  { id: 'kpi-insumos', category: 'disponibilidad', name: 'Disponibilidad de Materias Primas', weight: 5, unit: 'ton', periodicity: 'diario', minVal: '170', expectedVal: '200', maxVal: '200' },
  // Calidad de Servicio (49%)
  { id: 'kpi-innovacion', category: 'calidad', name: 'Eficiencia: Índice de innovación y pruebas', weight: 5, unit: 'informe', periodicity: 'mensual', minVal: '85%', expectedVal: '90%', maxVal: '95%' },
  { id: 'kpi-costos', category: 'calidad', name: 'Eficiencia: Control de costos USD/ton-tron', weight: 10, unit: 'informe', periodicity: 'semanal', minVal: '85%', expectedVal: '90%', maxVal: '95%' },
  { id: 'kpi-horario-tronadura', category: 'calidad', name: 'cumplimiento del horario de tronadura', weight: 5, unit: 'minutos', periodicity: 'Diaria', minVal: '15 minutos de perdida', expectedVal: '0 minutos de perdida', maxVal: 'Estar preparado antes de la hora' },
  { id: 'kpi-programa-tronadura', category: 'calidad', name: 'cumplimiento de programa de tronadura', weight: 3, unit: '%', periodicity: 'semanal', minVal: '<90%', expectedVal: '90%', maxVal: '100%' },
  { id: 'kpi-p80', category: 'calidad', name: 'cumplir con los parámetros de P80 según tipo de material', weight: 3, unit: 'pulgadas', periodicity: 'mensual', minVal: '6', expectedVal: '5.5', maxVal: '5' },
  { id: 'kpi-criterios-danio', category: 'calidad', name: 'Cumplimiento de criterios de daño', weight: 8, unit: '%', periodicity: 'mensual', minVal: '<80%', expectedVal: '80%', maxVal: '90%' },
  { id: 'kpi-tiros-quedados', category: 'calidad', name: 'Tiros quedados (TQ)', weight: 3, unit: 'unidad', periodicity: 'mensual', minVal: '>0', expectedVal: '0', maxVal: '0' },
  { id: 'kpi-ptq', category: 'calidad', name: 'medir la cantidad de PTQ en base a benchmark de las minas de Chile', weight: 3, unit: 'unidad', periodicity: 'mensual', minVal: '>4', expectedVal: '4', maxVal: '3' },
  { id: 'kpi-flyrock', category: 'calidad', name: 'impactos en equipos por flyrock', weight: 3, unit: 'unidad', periodicity: 'mensual', minVal: '>0', expectedVal: '0', maxVal: '0' },
  { id: 'kpi-vod', category: 'calidad', name: 'Medición y cumplimiento de VOD en los productos', weight: 3, unit: 'unidad', periodicity: 'mensual', minVal: '4', expectedVal: '6', maxVal: '8' },
  { id: 'kpi-gases', category: 'calidad', name: 'Control de gases nitrosos', weight: 3, unit: 'evento', periodicity: 'mensual', minVal: '>1', expectedVal: '1', maxVal: '1' },
  // Dotación (10%)
  { id: 'kpi-dotacion-comprometida', category: 'dotacion', name: 'Asegurar la dotación comprometida para la operación normal de la flota', weight: 10, unit: '%', periodicity: 'Semanal', minVal: '90% de la dotación', expectedVal: '95% de la dotación', maxVal: '100% de la dotación' },
  // Seguridad (10%) - Nuevos KPIs
  { id: 'kpi-seg-trirf', category: 'seguridad', name: 'Incidentes que afectan al TRIRF', weight: 4, unit: 'incidentes', periodicity: 'mensual', minVal: '2', expectedVal: '0', maxVal: '0' },
  { id: 'kpi-seg-notrirf', category: 'seguridad', name: 'Incidentes que no afectan al TRIRF', weight: 3, unit: 'incidentes', periodicity: 'mensual', minVal: '3', expectedVal: '0', maxVal: '0' },
  { id: 'kpi-seg-legal', category: 'seguridad', name: 'Cumplimiento legal (fiscalizaciones estatales)', weight: 1, unit: 'incidentes', periodicity: 'mensual', minVal: '3', expectedVal: '0', maxVal: '0' },
  { id: 'kpi-seg-auditorias', category: 'seguridad', name: 'Auditorias Internas', weight: 1, unit: 'audit_score', periodicity: 'mensual', minVal: '25%', expectedVal: '90%', maxVal: '100%' },
  { id: 'kpi-seg-incumplimiento', category: 'seguridad', name: 'Incumplimiento de temas generales SSMA', weight: 1, unit: 'incidentes', periodicity: 'mensual', minVal: '4', expectedVal: '0', maxVal: '0' }
];

const DEFAULT_CONTRACT_ROLES: ContractRole[] = [
  { roleName: 'Administrador (4x3)', requiredCount: 1, affectsKPI: true },
  { roleName: 'HSEC (4x3)', requiredCount: 1, affectsKPI: true },
  { roleName: 'Asistencia Tecnica (4x3)', requiredCount: 1, affectsKPI: true },
  { roleName: 'Ingeniero de tronadura (4x3)', requiredCount: 1, affectsKPI: true },
  { roleName: 'Jefe de Operaciones (7x7)', requiredCount: 2, affectsKPI: true },
  { roleName: 'Supervisor de tronadura (7x7)', requiredCount: 2, affectsKPI: true },
  { roleName: 'Capataz de tronadura (7x7)', requiredCount: 2, affectsKPI: true },
  { roleName: 'HSEC (7x7)', requiredCount: 2, affectsKPI: true },
  { roleName: 'Chofer Operador Camion fabrica (7x7)', requiredCount: 12, affectsKPI: true },
  { roleName: 'Chofer Operador Equipo Auxiliar (7x7)', requiredCount: 6, affectsKPI: true },
  { roleName: 'Cargador de Tiros (7x7)', requiredCount: 8, affectsKPI: true },
  { roleName: 'Encargado de Patio (7x7)', requiredCount: 2, affectsKPI: true },
  { roleName: 'Tecnico en Mantenimiento (7x7)', requiredCount: 4, affectsKPI: true },
  { roleName: 'Administrativo (7x7)', requiredCount: 2, affectsKPI: true },
  { roleName: 'Ingeniero de tronadura (7x7)', requiredCount: 2, affectsKPI: true },
  { roleName: 'Asistencia Tecnica (7x7)', requiredCount: 2, affectsKPI: true }
];

const generateId = () => Math.random().toString(36).substr(2, 9).toUpperCase();

// Helper to find the Wednesday preceding or equal to a given date
export const getWednesdayStartDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = day >= 3 ? day - 3 : day + 4;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
};

export const parseBlastingTimeToDecimal = (timeStr: string): number => {
  const parts = String(timeStr).split(':');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h + m / 60;
  }
  const decimalHour = parseFloat(timeStr);
  return isNaN(decimalHour) ? 19 : decimalHour;
};

// Helper to check if a cargo name corresponds to 7x7 shift
export const getRoleShiftType = (roleName: string): '4x3' | '7x7' => {
  return roleName.includes('7x7') ? '7x7' : '4x3';
};

export const dbService = {
  isSupabaseEnabled(): boolean {
    return isSupabaseConfigured;
  },

  async syncFromSupabase(): Promise<void> {
    if (!supabase) return;
    
    // 1. Fetch equipment
    const { data: eqData, error: eqErr } = await supabase.from('equipment').select('*');
    if (eqErr) throw eqErr;
    if (eqData) {
      const mappedFleet: Equipment[] = eqData.map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type as Equipment['type'],
        patent: row.patent || '',
        isContractual: row.is_contractual,
        createdAt: row.created_at
      }));
      localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(mappedFleet));
    }
    
    // 2. Fetch blasting times
    const { data: btData, error: btErr } = await supabase.from('blasting_times').select('*');
    if (btErr) throw btErr;
    if (btData) {
      const btMap: Record<string, string> = {};
      btData.forEach((row: any) => {
        btMap[row.date] = row.time;
      });
      localStorage.setItem('disponibilidad_equipos_blasting_times', JSON.stringify(btMap));
    }
    
    // 3. Fetch availability records
    const { data: recData, error: recErr } = await supabase.from('availability_records').select('*');
    if (recErr) throw recErr;
    if (recData) {
      const mappedRecords: AvailabilityRecord[] = recData.map((row: any) => ({
        id: row.id,
        equipmentId: row.equipment_id,
        date: row.date,
        status: row.status as AvailabilityRecord['status'],
        startHour: row.start_hour,
        endHour: row.end_hour,
        hoursOutOfService: parseFloat(row.hours_out_of_service),
        hoursPostBlasting: parseFloat(row.hours_post_blasting),
        hoursAvailable: parseFloat(row.hours_available),
        comment: row.comment || ''
      }));
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(mappedRecords));
    }
    
    // 4. Fetch contract settings
    const { data: setLocal, error: setErr } = await supabase.from('contract_settings').select('*').eq('id', 1).maybeSingle();
    if (setErr) throw setErr;
    if (setLocal) {
      const settingsMapped: ContractSettings = {
        requiredFactoryTrucks: setLocal.required_factory_trucks,
        requiredFrontLoaders: setLocal.required_front_loaders,
        requiredPowderKegs: setLocal.required_powder_kegs,
        requiredPickups: setLocal.required_pickups
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settingsMapped));
    }

    // 5. Fetch daily raw materials
    const { data: rawData, error: rawErr } = await supabase.from('daily_raw_materials').select('*');
    if (!rawErr && rawData) {
      const mapped: DailyRawMaterials[] = rawData.map((row: any) => ({
        date: row.date,
        nitratoStock: parseFloat(row.nitrato_stock),
        matrizStock: parseFloat(row.matriz_stock)
      }));
      localStorage.setItem(STORAGE_KEYS.RAW_MATERIALS, JSON.stringify(mapped));
    }

    // 6. Fetch contract KPIs weights
    const { data: kpiData, error: kpiErr } = await supabase.from('contract_kpis').select('*');
    if (!kpiErr && kpiData) {
      const mapped: ContractKPI[] = kpiData.map((row: any) => ({
        id: row.id,
        category: row.category as ContractKPI['category'],
        name: row.name,
        weight: parseFloat(row.weight),
        unit: row.unit,
        periodicity: row.periodicity,
        minVal: row.min_val,
        expectedVal: row.expected_val,
        maxVal: row.max_val
      }));
      localStorage.setItem(STORAGE_KEYS.CONTRACT_KPIS, JSON.stringify(mapped));
    }

    // 7. Fetch daily quality compliance
    const { data: qualData, error: qualErr } = await supabase.from('daily_quality_compliance').select('*');
    if (!qualErr && qualData) {
      const mapped: DailyQualityCompliance[] = qualData.map((row: any) => ({
        date: row.date,
        kpiId: row.kpi_id,
        compliancePct: parseFloat(row.compliance_pct)
      }));
      localStorage.setItem(STORAGE_KEYS.QUALITY_COMPLIANCE, JSON.stringify(mapped));
    }

    // 8. Fetch contract roles dotation
    const { data: roleData, error: roleErr } = await supabase.from('contract_roles').select('*');
    if (!roleErr && roleData) {
      const mapped: ContractRole[] = roleData.map((row: any) => ({
        roleName: row.role_name,
        requiredCount: row.required_count,
        affectsKPI: row.affects_kpi !== undefined ? row.affects_kpi : true
      }));
      localStorage.setItem(STORAGE_KEYS.CONTRACT_ROLES, JSON.stringify(mapped));
    }

    // 9. Fetch weekly attendance roster
    const { data: attData, error: attErr } = await supabase.from('weekly_attendance').select('*');
    if (!attErr && attData) {
      const mapped: WeeklyAttendance[] = attData.map((row: any) => ({
        weekStartDate: row.week_start_date,
        attendanceData: row.attendance_data
      }));
      localStorage.setItem(STORAGE_KEYS.WEEKLY_ATTENDANCE, JSON.stringify(mapped));
    }

    // 10. Fetch period compliance (NEW PHASE 17)
    const { data: periodData, error: periodErr } = await supabase.from('period_compliance').select('*');
    if (!periodErr && periodData) {
      const mapped: PeriodCompliance[] = periodData.map((row: any) => ({
        startDate: row.start_date,
        endDate: row.end_date,
        kpiId: row.kpi_id,
        realValue: parseFloat(row.real_value),
        compliancePct: parseFloat(row.compliance_pct)
      }));
      localStorage.setItem(STORAGE_KEYS.PERIOD_COMPLIANCE, JSON.stringify(mapped));
    }
  },

  getEquipment(): Equipment[] {
    const data = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
    if (!data) {
      this.seedData();
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT) || '[]');
    }
    return JSON.parse(data);
  },

  async addEquipment(name: string, type: Equipment['type'], patent: string, isContractual: boolean): Promise<Equipment> {
    const fleet = this.getEquipment();
    const newEq: Equipment = {
      id: generateId(),
      name,
      type,
      patent,
      isContractual,
      createdAt: new Date().toISOString()
    };
    fleet.push(newEq);
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(fleet));

    if (supabase) {
      const { error } = await supabase.from('equipment').insert([{
        id: newEq.id,
        name: newEq.name,
        type: newEq.type,
        patent: newEq.patent,
        is_contractual: newEq.isContractual,
        created_at: newEq.createdAt
      }]);
      if (error) throw error;
    }
    return newEq;
  },

  async deleteEquipment(id: string): Promise<void> {
    const fleet = this.getEquipment().filter(eq => eq.id !== id);
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(fleet));
    
    const records = this.getAllRecords().filter(r => r.equipmentId !== id);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));

    if (supabase) {
      const { error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
    }
  },

  async updateEquipment(id: string, name: string, type: Equipment['type'], patent: string, isContractual: boolean): Promise<void> {
    const fleet = this.getEquipment();
    const idx = fleet.findIndex(eq => eq.id === id);
    if (idx !== -1) {
      fleet[idx] = {
        ...fleet[idx],
        name,
        type,
        patent,
        isContractual
      };
      localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(fleet));

      if (supabase) {
        const { error } = await supabase.from('equipment').update({
          name,
          type,
          patent,
          is_contractual: isContractual
        }).eq('id', id);
        if (error) throw error;
      }
    }
  },

  getContractSettings(): ContractSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    return JSON.parse(data);
  },

  async saveContractSettings(settings: ContractSettings): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

    if (supabase) {
      const { error } = await supabase.from('contract_settings').upsert({
        id: 1,
        required_factory_trucks: settings.requiredFactoryTrucks,
        required_front_loaders: settings.requiredFrontLoaders,
        required_powder_kegs: settings.requiredPowderKegs,
        required_pickups: settings.requiredPickups,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
    }
  },

  getAllRecords(): AvailabilityRecord[] {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!data) return [];
    try {
      let parsed: any[] = JSON.parse(data);
      let modified = false;
      parsed = parsed.map(r => {
        if (r.status === 'Mantención') {
          r.status = 'Mantención Preventiva';
          modified = true;
        } else if (r.status === 'Falla Técnica') {
          r.status = 'Mantención Correctiva';
          modified = true;
        } else if (r.status === 'Reparación') {
          r.status = 'Mantención Correctiva';
          modified = true;
        }
        if (r.hoursPostBlasting === undefined) {
          r.hoursPostBlasting = 0;
          modified = true;
        }
        if (r.startHour === undefined) {
          r.startHour = 7;
          r.endHour = 7 + (r.hoursOutOfService || 0);
          modified = true;
        }
        return r;
      });
      if (modified) {
        localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {
      console.error('Error parsing records', e);
      return [];
    }
  },

  getAvailabilityRecords(startDate: string, endDate: string): AvailabilityRecord[] {
    const records = this.getAllRecords();
    return records.filter(r => r.date >= startDate && r.date <= endDate);
  },

  getAvailabilityForDate(date: string): AvailabilityRecord[] {
    const records = this.getAllRecords();
    return records.filter(r => r.date === date);
  },

  getBlastingTimeForDate(date: string): string {
    const data = localStorage.getItem('disponibilidad_equipos_blasting_times');
    if (!data) return '19:00';
    const map = JSON.parse(data);
    const val = map[date];
    if (val === undefined) return '19:00';
    if (typeof val === 'number') {
      return val < 10 ? `0${val}:00` : `${val}:00`;
    }
    return String(val);
  },

  async saveBlastingTimeForDate(date: string, time: string): Promise<void> {
    const data = localStorage.getItem('disponibilidad_equipos_blasting_times');
    const map = data ? JSON.parse(data) : {};
    map[date] = time;
    localStorage.setItem('disponibilidad_equipos_blasting_times', JSON.stringify(map));

    if (supabase) {
      const { error } = await supabase.from('blasting_times').upsert({
        date,
        time
      });
      if (error) throw error;
    }
  },

  async saveAvailabilityRecords(
    date: string, 
    recordsInput: { equipmentId: string; status: AvailabilityRecord['status']; startHour: number; endHour: number; comment: string }[]
  ): Promise<void> {
    const allRecords = this.getAllRecords();
    const blastingTime = this.getBlastingTimeForDate(date);
    
    let updatedRecords = allRecords.filter(r => r.date !== date);
    const recordsToInsert: AvailabilityRecord[] = [];
    
    recordsInput.forEach(input => {
      let startHour = 7;
      let endHour = 7;
      let hoursOutOfService = 0;
      let hoursPostBlasting = 0;

      if (input.status !== 'Operativo') {
        startHour = Math.min(19, Math.max(7, input.startHour));
        endHour = Math.min(19, Math.max(startHour, input.endHour));
        hoursOutOfService = endHour - startHour;
        
        const blastingTimeDec = parseBlastingTimeToDecimal(blastingTime);
        hoursPostBlasting = Math.max(0, endHour - Math.max(startHour, blastingTimeDec));
      }
      
      const hoursAvailable = 12 - (hoursOutOfService - hoursPostBlasting);
      
      const newRec: AvailabilityRecord = {
        id: generateId(),
        equipmentId: input.equipmentId,
        date,
        status: input.status,
        startHour,
        endHour,
        hoursOutOfService,
        hoursPostBlasting,
        hoursAvailable,
        comment: input.comment || ''
      };
      
      recordsToInsert.push(newRec);
      updatedRecords.push(newRec);
    });

    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updatedRecords));

    if (supabase) {
      const { error: delError } = await supabase.from('availability_records').delete().eq('date', date);
      if (delError) throw delError;

      if (recordsToInsert.length > 0) {
        const { error: insError } = await supabase.from('availability_records').insert(
          recordsToInsert.map(r => ({
            id: r.id,
            equipment_id: r.equipmentId,
            date: r.date,
            status: r.status,
            start_hour: r.startHour,
            end_hour: r.endHour,
            hours_out_of_service: r.hoursOutOfService,
            hours_post_blasting: r.hoursPostBlasting,
            hours_available: r.hoursAvailable,
            comment: r.comment
          }))
        );
        if (insError) throw insError;
      }
    }
  },

  getContractKPIs(): ContractKPI[] {
    const data = localStorage.getItem(STORAGE_KEYS.CONTRACT_KPIS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CONTRACT_KPIS, JSON.stringify(DEFAULT_CONTRACT_KPIS));
      return DEFAULT_CONTRACT_KPIS;
    }
    return JSON.parse(data);
  },

  async saveContractKPIs(kpis: ContractKPI[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.CONTRACT_KPIS, JSON.stringify(kpis));
    if (supabase) {
      const { error } = await supabase.from('contract_kpis').upsert(
        kpis.map(k => ({
          id: k.id,
          category: k.category,
          name: k.name,
          weight: k.weight,
          unit: k.unit,
          periodicity: k.periodicity,
          min_val: k.minVal,
          expected_val: k.expectedVal,
          max_val: k.maxVal
        }))
      );
      if (error) throw error;
    }
  },

  getRawMaterials(): DailyRawMaterials[] {
    const data = localStorage.getItem(STORAGE_KEYS.RAW_MATERIALS);
    if (!data) return [];
    return JSON.parse(data);
  },

  getRawMaterialsForDate(date: string): DailyRawMaterials {
    const all = this.getRawMaterials();
    const found = all.find(r => r.date === date);
    return found || { date, nitratoStock: 200, matrizStock: 200 };
  },

  getRawMaterialsForRange(startDate: string, endDate: string): DailyRawMaterials[] {
    const all = this.getRawMaterials();
    return all.filter(r => r.date >= startDate && r.date <= endDate);
  },

  async saveRawMaterialsForDate(date: string, nitrato: number, matriz: number): Promise<void> {
    const all = this.getRawMaterials().filter(r => r.date !== date);
    const newRow: DailyRawMaterials = { date, nitratoStock: nitrato, matrizStock: matriz };
    all.push(newRow);
    localStorage.setItem(STORAGE_KEYS.RAW_MATERIALS, JSON.stringify(all));

    if (supabase) {
      const { error } = await supabase.from('daily_raw_materials').upsert({
        date,
        nitrato_stock: nitrato,
        matriz_stock: matriz
      });
      if (error) throw error;
    }
  },

  getQualityCompliances(): DailyQualityCompliance[] {
    const data = localStorage.getItem(STORAGE_KEYS.QUALITY_COMPLIANCE);
    if (!data) return [];
    return JSON.parse(data);
  },

  getQualityComplianceForDate(date: string): DailyQualityCompliance[] {
    const all = this.getQualityCompliances();
    return all.filter(q => q.date === date);
  },

  getQualityComplianceForRange(startDate: string, endDate: string): DailyQualityCompliance[] {
    const all = this.getQualityCompliances();
    return all.filter(q => q.date >= startDate && q.date <= endDate);
  },

  async saveQualityComplianceForDate(date: string, kpiId: string, compliancePct: number): Promise<void> {
    const all = this.getQualityCompliances().filter(q => !(q.date === date && q.kpiId === kpiId));
    all.push({ date, kpiId, compliancePct });
    localStorage.setItem(STORAGE_KEYS.QUALITY_COMPLIANCE, JSON.stringify(all));

    if (supabase) {
      const { error } = await supabase.from('daily_quality_compliance').upsert({
        date,
        kpi_id: kpiId,
        compliance_pct: compliancePct
      });
      if (error) throw error;
    }
  },

  getContractRoles(): ContractRole[] {
    const data = localStorage.getItem(STORAGE_KEYS.CONTRACT_ROLES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.CONTRACT_ROLES, JSON.stringify(DEFAULT_CONTRACT_ROLES));
      return DEFAULT_CONTRACT_ROLES;
    }
    return JSON.parse(data);
  },

  async saveContractRoles(roles: ContractRole[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.CONTRACT_ROLES, JSON.stringify(roles));
    if (supabase) {
      // Clean table first to support role deletion
      const { error: delErr } = await supabase.from('contract_roles').delete().neq('role_name', 'dummy_val_deleted_filter');
      if (delErr) throw delErr;

      const { error } = await supabase.from('contract_roles').insert(
        roles.map(r => ({
          role_name: r.roleName,
          required_count: r.requiredCount,
          affects_kpi: r.affectsKPI ?? true
        }))
      );
      if (error) throw error;
    }
  },

  getWeeklyAttendance(weekStartDate: string): WeeklyAttendance {
    const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_ATTENDANCE);
    const list: WeeklyAttendance[] = data ? JSON.parse(data) : [];
    const found = list.find(w => w.weekStartDate === weekStartDate);
    
    if (!found) {
      const roles = this.getContractRoles();
      const defaultData: Record<string, number[]> = {};
      roles.forEach(r => {
        const requiredDaily = getRoleShiftType(r.roleName) === '7x7' ? r.requiredCount / 2 : r.requiredCount;
        defaultData[r.roleName] = Array(7).fill(requiredDaily);
      });
      return { weekStartDate, attendanceData: defaultData };
    }
    return found;
  },

  getWeeklyAttendanceList(): WeeklyAttendance[] {
    const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_ATTENDANCE);
    if (!data) return [];
    return JSON.parse(data);
  },

  async saveWeeklyAttendance(weekStartDate: string, attendanceData: Record<string, number[]>): Promise<void> {
    const list = this.getWeeklyAttendanceList().filter(w => w.weekStartDate !== weekStartDate);
    list.push({ weekStartDate, attendanceData });
    localStorage.setItem(STORAGE_KEYS.WEEKLY_ATTENDANCE, JSON.stringify(list));

    if (supabase) {
      const { error } = await supabase.from('weekly_attendance').upsert({
        week_start_date: weekStartDate,
        attendance_data: attendanceData
      });
      if (error) throw error;
    }
  },

  // NEW CRUD METHODS FOR PERIOD COMPLIANCE (PHASE 17)
  getPeriodCompliances(): PeriodCompliance[] {
    const data = localStorage.getItem(STORAGE_KEYS.PERIOD_COMPLIANCE);
    if (!data) return [];
    return JSON.parse(data);
  },

  getPeriodCompliancesForRange(startDate: string, endDate: string): PeriodCompliance[] {
    const all = this.getPeriodCompliances();
    return all.filter(p => p.startDate === startDate && p.endDate === endDate);
  },

  async savePeriodCompliance(startDate: string, endDate: string, kpiId: string, realValue: number, compliancePct: number): Promise<void> {
    const all = this.getPeriodCompliances().filter(p => !(p.startDate === startDate && p.endDate === endDate && p.kpiId === kpiId));
    all.push({ startDate, endDate, kpiId, realValue, compliancePct });
    localStorage.setItem(STORAGE_KEYS.PERIOD_COMPLIANCE, JSON.stringify(all));

    if (supabase) {
      const { error } = await supabase.from('period_compliance').upsert({
        start_date: startDate,
        end_date: endDate,
        kpi_id: kpiId,
        real_value: realValue,
        compliance_pct: compliancePct
      });
      if (error) throw error;
    }
  },

  seedData(): void {
    const initialFleet: Equipment[] = [];

    // 6 Factory Trucks
    for (let i = 1; i <= 6; i++) {
      initialFleet.push({
        id: `eq-cf-0${i}`,
        name: `CF-0${i}`,
        type: 'Camión Fábrica',
        patent: `CF-100${i}`,
        isContractual: true,
        createdAt: new Date().toISOString()
      });
    }

    // 3 Front Loaders (Cargador Frontal)
    for (let i = 1; i <= 3; i++) {
      initialFleet.push({
        id: `eq-cf-tp0${i}`,
        name: `CF-TP0${i}`,
        type: 'Cargador Frontal',
        patent: `TP-200${i}`,
        isContractual: true,
        createdAt: new Date().toISOString()
      });
    }

    // 3 Mobile Powder Kegs (Polvorín Móvil)
    for (let i = 1; i <= 3; i++) {
      initialFleet.push({
        id: `eq-pm-0${i}`,
        name: `PM-0${i}`,
        type: 'Polvorín Móvil',
        patent: `PM-300${i}`,
        isContractual: true,
        createdAt: new Date().toISOString()
      });
    }

    // 10 Pickups (Camionetas)
    for (let i = 1; i <= 10; i++) {
      const idx = i < 10 ? `0${i}` : `${i}`;
      initialFleet.push({
        id: `eq-c-${idx}`,
        name: `C-${idx}`,
        type: 'Camioneta',
        patent: `CC-40${idx}`,
        isContractual: true,
        createdAt: new Date().toISOString()
      });
    }

    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(initialFleet));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.CONTRACT_KPIS, JSON.stringify(DEFAULT_CONTRACT_KPIS));
    localStorage.setItem(STORAGE_KEYS.CONTRACT_ROLES, JSON.stringify(DEFAULT_CONTRACT_ROLES));

    // Seed 14 days of history (including today)
    const historyRecords: AvailabilityRecord[] = [];
    const today = new Date();

    for (let d = 14; d >= 0; d--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - d);
      const dateStr = targetDate.toISOString().split('T')[0];

      initialFleet.forEach(eq => {
        let status: AvailabilityRecord['status'] = 'Operativo';
        let hoursOutOfService = 0;
        let comment = '';

        const rand = Math.random();
        
        if (eq.type === 'Camión Fábrica') {
          if (rand < 0.08) {
            status = 'Mantención Preventiva';
            hoursOutOfService = Math.floor(Math.random() * 6) + 4;
            comment = 'Mantención preventiva de 250 horas';
          } else if (rand < 0.12) {
            status = 'Mantención Programada';
            hoursOutOfService = Math.floor(Math.random() * 8) + 4;
            comment = 'Ajuste programado de tolva';
          } else if (rand < 0.14) {
            status = 'Mantención Correctiva';
            hoursOutOfService = 12;
            comment = 'Fuga de aceite en motor de descarga';
          } else if (rand < 0.16) {
            status = 'Mantención Predictiva';
            hoursOutOfService = 3;
            comment = 'Reemplazo preventivo de sensor según análisis de vibración';
          }
        } 
        else if (eq.type === 'Cargador Frontal') {
          if (rand < 0.06) {
            status = 'Mantención Preventiva';
            hoursOutOfService = 6;
            comment = 'Lubricación y engrase general';
          } else if (rand < 0.10) {
            status = 'Mantención Correctiva';
            hoursOutOfService = 12;
            comment = 'Reparación de sistema eléctrico de arranque';
          }
        } 
        else if (eq.type === 'Polvorín Móvil') {
          if (rand < 0.05) {
            status = 'Mantención Correctiva';
            hoursOutOfService = 8;
            comment = 'Avería en sensor de velocidad / GPS';
          }
        } 
        else if (eq.type === 'Camioneta') {
          if (rand < 0.04) {
            status = 'Mantención Preventiva';
            hoursOutOfService = 4;
            comment = 'Cambio de neumáticos o alineación';
          } else if (rand < 0.06) {
            status = 'Mantención Correctiva';
            hoursOutOfService = 6;
            comment = 'Falla en luces / fusible soplado';
          }
        }

        const hoursAvailable = 12 - hoursOutOfService;
        const startHour = 7;
        const endHour = 7 + hoursOutOfService;

        historyRecords.push({
          id: generateId(),
          equipmentId: eq.id,
          date: dateStr,
          status,
          startHour,
          endHour,
          hoursOutOfService,
          hoursPostBlasting: 0,
          hoursAvailable,
          comment
        });
      });
    }

    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(historyRecords));
  }
};
