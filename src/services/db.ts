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

const STORAGE_KEYS = {
  EQUIPMENT: 'disponibilidad_equipos_fleet',
  SETTINGS: 'disponibilidad_equipos_settings',
  RECORDS: 'disponibilidad_equipos_records'
};

const DEFAULT_SETTINGS: ContractSettings = {
  requiredFactoryTrucks: 5,
  requiredFrontLoaders: 2,
  requiredPowderKegs: 2,
  requiredPickups: 8
};

// Generate a random UUID-like string
const generateId = () => Math.random().toString(36).substr(2, 9).toUpperCase();

// Helper to parse HH:MM blasting time to decimal hours
export const parseBlastingTimeToDecimal = (timeStr: string): number => {
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h + m / 60;
  }
  const decimalHour = parseFloat(timeStr);
  return isNaN(decimalHour) ? 19 : decimalHour; // fallback
};

export const dbService = {
  getEquipment(): Equipment[] {
    const data = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
    if (!data) {
      this.seedData();
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT) || '[]');
    }
    return JSON.parse(data);
  },

  addEquipment(name: string, type: Equipment['type'], patent: string, isContractual: boolean): Equipment {
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
    return newEq;
  },

  deleteEquipment(id: string): void {
    const fleet = this.getEquipment().filter(eq => eq.id !== id);
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(fleet));
    
    // Also remove associated records
    const records = this.getAllRecords().filter(r => r.equipmentId !== id);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  },

  updateEquipment(id: string, name: string, type: Equipment['type'], patent: string, isContractual: boolean): void {
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
    }
  },

  getContractSettings(): ContractSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(data);
  },

  saveContractSettings(settings: ContractSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
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
    if (!data) return '19:00'; // default 19:00
    const map = JSON.parse(data);
    const val = map[date];
    if (val === undefined) return '19:00';
    if (typeof val === 'number') {
      return val < 10 ? `0${val}:00` : `${val}:00`;
    }
    return String(val);
  },

  saveBlastingTimeForDate(date: string, time: string): void {
    const data = localStorage.getItem('disponibilidad_equipos_blasting_times');
    const map = data ? JSON.parse(data) : {};
    map[date] = time;
    localStorage.setItem('disponibilidad_equipos_blasting_times', JSON.stringify(map));
  },

  saveAvailabilityRecords(date: string, recordsInput: { equipmentId: string; status: AvailabilityRecord['status']; startHour: number; endHour: number; comment: string }[]): void {
    const allRecords = this.getAllRecords();
    const blastingTime = this.getBlastingTimeForDate(date);
    
    // Filter out existing records for this date to overwrite
    let updatedRecords = allRecords.filter(r => r.date !== date);
    
    // Add new/updated records
    recordsInput.forEach(input => {
      let startHour = 7;
      let endHour = 7;
      let hoursOutOfService = 0;
      let hoursPostBlasting = 0;

      if (input.status !== 'Operativo') {
        startHour = Math.min(19, Math.max(7, input.startHour));
        endHour = Math.min(19, Math.max(startHour, input.endHour));
        hoursOutOfService = endHour - startHour;
        
        // Portion after blasting time
        const blastingTimeDec = parseBlastingTimeToDecimal(blastingTime);
        hoursPostBlasting = Math.max(0, endHour - Math.max(startHour, blastingTimeDec));
      }
      
      const hoursAvailable = 12 - (hoursOutOfService - hoursPostBlasting);
      
      updatedRecords.push({
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
      });
    });

    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updatedRecords));
  },

  seedData() {
    console.log('Seeding initial equipment and history data...');
    
    // 1. Initial Fleet
    const initialFleet: Equipment[] = [];
    
    // 6 Factory Trucks (Camiones Fábrica)
    for (let i = 1; i <= 6; i++) {
      initialFleet.push({
        id: `eq-cf-0${i}`,
        name: `CF-0${i}`,
        type: 'Camión Fábrica',
        patent: `CF-100${i}`,
        isContractual: i <= 5, // 5 are contractual, 1 is backup
        createdAt: new Date().toISOString()
      });
    }

    // 3 Front Loaders / Tapapozos (Cargador Frontal)
    for (let i = 1; i <= 3; i++) {
      initialFleet.push({
        id: `eq-ll-0${i}`,
        name: `LL-0${i}`,
        type: 'Cargador Frontal',
        patent: `LL-200${i}`,
        isContractual: i <= 2, // 2 contractual, 1 backup
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
        isContractual: i <= 2, // 2 contractual, 1 backup
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
        isContractual: i <= 8, // 8 contractual, 2 backup
        createdAt: new Date().toISOString()
      });
    }

    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(initialFleet));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));

    // 2. Seed 14 days of history (including today)
    const historyRecords: AvailabilityRecord[] = [];
    const today = new Date();

    for (let d = 14; d >= 0; d--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - d);
      const dateStr = targetDate.toISOString().split('T')[0];

      initialFleet.forEach(eq => {
        // Base case: Equipment is Operativo (12 hours available)
        let status: AvailabilityRecord['status'] = 'Operativo';
        let hoursOutOfService = 0;
        let comment = '';

        // Introduce deterministic but realistic random failures to make metrics interesting
        const rand = Math.random();
        
        // Factory Trucks have a slightly higher chance of maintenance/repair
        if (eq.type === 'Camión Fábrica') {
          if (rand < 0.08) {
            status = 'Mantención Preventiva';
            hoursOutOfService = Math.floor(Math.random() * 6) + 4; // 4-10 hours
            comment = 'Mantención preventiva de 250 horas';
          } else if (rand < 0.12) {
            status = 'Mantención Programada';
            hoursOutOfService = Math.floor(Math.random() * 8) + 4; // 4-12 hours
            comment = 'Ajuste programado de tolva';
          } else if (rand < 0.14) {
            status = 'Mantención Correctiva';
            hoursOutOfService = 12; // All day
            comment = 'Fuga de aceite en motor de descarga';
          } else if (rand < 0.16) {
            status = 'Mantención Predictiva';
            hoursOutOfService = 3;
            comment = 'Reemplazo preventivo de sensor según análisis de vibración';
          }
        } 
        // Front Loaders
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
        // Powder kegs
        else if (eq.type === 'Polvorín Móvil') {
          if (rand < 0.05) {
            status = 'Mantención Correctiva';
            hoursOutOfService = 8;
            comment = 'Avería en sensor de velocidad / GPS';
          }
        } 
        // Pickups (rarely down, quick repairs)
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
