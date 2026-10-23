import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  style?: React.CSSProperties;
  rangeStart?: string; // Optional: start date of selected range
  rangeEnd?: string;   // Optional: end date of selected range
  inline?: boolean;    // Optional: render calendar inline (always visible)
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Single letter weekdays for ultra-clean UI matching the design image
const WEEKDAYS_ES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const parseLocalDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
};

const toYYYYMMDD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return 'Seleccionar fecha';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

/**
 * Calcula a qué turno (A o B) corresponde una fecha dada.
 * Turno A: inició el miércoles 31 de diciembre de 2025 (duración 7 días: miércoles a martes).
 * Turno B: inició el miércoles 07 de enero de 2026 (duración 7 días: miércoles a martes).
 * Y así se alternan sucesivamente cada 7 días.
 */
export const getShiftForDate = (date: Date | string): 'A' | 'B' => {
  let target: Date;
  if (typeof date === 'string') {
    const parts = date.split('-').map(Number);
    if (parts.length !== 3) return 'A';
    target = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  } else {
    target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }
  const base = new Date(2025, 11, 31, 12, 0, 0); // 31 Dic 2025 (Miércoles)
  const diffDays = Math.floor((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
  const weekIdx = Math.floor(diffDays / 7);
  return ((weekIdx % 2) + 2) % 2 === 0 ? 'A' : 'B';
};

export const DatePicker: React.FC<DatePickerProps> = ({ 
  value, 
  onChange, 
  min, 
  max, 
  style,
  rangeStart,
  rangeEnd,
  inline = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Controls the currently viewed month in the calendar popover
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const initial = parseLocalDate(value);
    return initial ? new Date(initial.getFullYear(), initial.getMonth(), 1) : new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync viewed month when value changes from outside
  useEffect(() => {
    const valDate = parseLocalDate(value);
    if (valDate) {
      setCurrentMonth(new Date(valDate.getFullYear(), valDate.getMonth(), 1));
    }
  }, [value]);

  // Click outside listener (only for popover mode)
  useEffect(() => {
    if (inline) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, inline]);

  const year = currentMonth.getFullYear();
  const monthIdx = currentMonth.getMonth();

  // Generate 42 days grid for full calendar view
  const gridCells = useMemo(() => {
    const firstDay = new Date(year, monthIdx, 1);
    const startDayIdx = (firstDay.getDay() + 6) % 7; // Monday is 0
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, monthIdx, 0).getDate();

    const cells = [];

    // Prev month trailing days
    for (let i = startDayIdx - 1; i >= 0; i--) {
      const day = prevMonthTotalDays - i;
      const dateObj = new Date(year, monthIdx - 1, day);
      cells.push({ day, dateObj, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, monthIdx, d);
      cells.push({ day: d, dateObj, isCurrentMonth: true });
    }

    // Next month starting days to fill 42 cells (6 weeks)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const dateObj = new Date(year, monthIdx + 1, d);
      cells.push({ day: d, dateObj, isCurrentMonth: false });
    }

    return cells;
  }, [year, monthIdx]);

  const minDate = useMemo(() => (min ? parseLocalDate(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseLocalDate(max) : null), [max]);

  const rangeStartTime = useMemo(() => (rangeStart ? parseLocalDate(rangeStart)?.getTime() ?? null : null), [rangeStart]);
  const rangeEndTime = useMemo(() => (rangeEnd ? parseLocalDate(rangeEnd)?.getTime() ?? null : null), [rangeEnd]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, monthIdx - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, monthIdx + 1, 1));
  };

  const handleSelectDay = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const ymd = toYYYYMMDD(date);
    onChange(ymd);
    if (!inline) {
      setIsOpen(false);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    const current = parseLocalDate(value);
    if (!current) return false;
    return (
      date.getDate() === current.getDate() &&
      date.getMonth() === current.getMonth() &&
      date.getFullYear() === current.getFullYear()
    );
  };

  const isDisabled = (date: Date) => {
    const midnightDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    if (minDate) {
      const midnightMin = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime();
      if (midnightDate < midnightMin) return true;
    }
    if (maxDate) {
      const midnightMax = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()).getTime();
      if (midnightDate > midnightMax) return true;
    }
    return false;
  };

  const renderCalendarBody = () => (
    <>
      {/* Calendar Header with Arrows on the Right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingLeft: '4px',
          paddingRight: '4px'
        }}
      >
        <span
          style={{
            fontWeight: '700',
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            textTransform: 'capitalize'
          }}
        >
          {MONTH_NAMES_ES[monthIdx]} {year}
        </span>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: 'none',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: 'none',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday Names */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textAlign: 'center',
          marginBottom: '8px'
        }}
      >
        {WEEKDAYS_ES.map((day, idx) => (
          <span
            key={`${day}-${idx}`}
            style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--text-muted)',
              padding: '2px 0',
              opacity: 0.6
            }}
          >
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          rowGap: '4px',
          textAlign: 'center'
        }}
      >
        {gridCells.map(({ day, dateObj, isCurrentMonth }, idx) => {
          const disabled = isDisabled(dateObj);
          const active = isSelected(dateObj);
          const today = isToday(dateObj);
          
          const time = dateObj.getTime();
          const isStart = rangeStartTime !== null && time === rangeStartTime;
          const isEnd = rangeEndTime !== null && time === rangeEndTime;
          const isInRange = rangeStartTime !== null && rangeEndTime !== null && time > rangeStartTime && time < rangeEndTime;

          let cellStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '32px',
            fontSize: '0.84rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%'
          };

          if (isStart && isEnd) {
            cellStyle = {
              ...cellStyle,
              background: '#0066ff',
              color: '#ffffff',
              borderRadius: '8px'
            };
          } else if (isStart) {
            cellStyle = {
              ...cellStyle,
              background: '#0066ff',
              color: '#ffffff',
              borderRadius: '8px 0 0 8px'
            };
          } else if (isEnd) {
            cellStyle = {
              ...cellStyle,
              background: '#0066ff',
              color: '#ffffff',
              borderRadius: '0 8px 8px 0'
            };
          } else if (isInRange) {
            cellStyle = {
              ...cellStyle,
              background: 'rgba(0, 102, 255, 0.16)',
              color: 'var(--text-primary)',
              borderRadius: '0px'
            };
          } else if (active) {
            cellStyle = {
              ...cellStyle,
              background: '#0066ff',
              color: '#ffffff',
              borderRadius: '8px'
            };
          } else if (disabled) {
            cellStyle = {
              ...cellStyle,
              opacity: 0.25,
              pointerEvents: 'none',
              color: 'var(--text-muted)'
            };
          } else if (!isCurrentMonth) {
            cellStyle = {
              ...cellStyle,
              color: 'var(--text-muted)',
              opacity: 0.35
            };
          } else {
            cellStyle = {
              ...cellStyle,
              color: 'var(--text-primary)'
            };
          }

          const showTodayRing = today && !active && !isStart && !isEnd && !isInRange;

          if (showTodayRing) {
            cellStyle = {
              ...cellStyle,
              border: '1.5px solid #0066ff',
              borderRadius: '8px'
            };
          }

          const shift = getShiftForDate(dateObj);
          const isHighlighted = active || isStart || isEnd;

          return (
            <button
              key={`${dateObj.getTime()}-${idx}`}
              type="button"
              disabled={disabled}
              onClick={(e) => handleSelectDay(dateObj, e)}
              style={{
                ...cellStyle,
                position: 'relative'
              }}
              className="calendar-day-btn"
              onMouseEnter={(e) => {
                if (!active && !disabled && !isStart && !isEnd && !isInRange) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderRadius = '8px';
                }
              }}
              onMouseLeave={(e) => {
                if (!active && !disabled && !isStart && !isEnd && !isInRange) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>{day}</span>
              <span 
                style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '2px',
                  fontSize: '0.54rem',
                  fontWeight: '800',
                  lineHeight: 1,
                  padding: '1px 2px',
                  borderRadius: '2px',
                  color: isHighlighted 
                    ? '#ffffff' 
                    : (shift === 'A' ? '#2563eb' : '#d97706'),
                  background: isHighlighted 
                    ? 'rgba(255,255,255,0.25)' 
                    : (shift === 'A' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(217, 119, 6, 0.12)'),
                  opacity: disabled || !isCurrentMonth ? 0.35 : 1
                }}
                title={`Turno ${shift}`}
              >
                {shift}
              </span>
            </button>
          );
        })}
      </div>

      {/* Leyenda de Turnos */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ 
            width: '14px', 
            height: '14px', 
            borderRadius: '3px', 
            background: 'rgba(37, 99, 235, 0.15)', 
            color: '#2563eb', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: '800', 
            fontSize: '0.62rem',
            border: '1px solid rgba(37, 99, 235, 0.3)'
          }}>A</span>
          <span style={{ fontWeight: '600' }}>Turno A</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ 
            width: '14px', 
            height: '14px', 
            borderRadius: '3px', 
            background: 'rgba(217, 119, 6, 0.15)', 
            color: '#d97706', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: '800', 
            fontSize: '0.62rem',
            border: '1px solid rgba(217, 119, 6, 0.3)'
          }}>B</span>
          <span style={{ fontWeight: '600' }}>Turno B</span>
        </div>
      </div>
    </>
  );

  if (inline) {
    return (
      <div 
        ref={containerRef} 
        style={{ 
          display: 'block',
          width: '290px',
          padding: '14px',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          userSelect: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          ...style 
        }}
      >
        {renderCalendarBody()}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'relative', 
        display: 'inline-block',
        ...style 
      }}
    >
      {/* Trigger Button with Glow effect if open */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          minWidth: '150px',
          padding: '10px 14px',
          borderRadius: '10px',
          border: isOpen ? '2px solid #0066ff' : '1px solid var(--border-input)',
          background: 'var(--bg-input)',
          color: 'var(--text-input)',
          fontWeight: '600',
          fontSize: '0.9rem',
          textAlign: 'left',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(0, 102, 255, 0.25)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
          transition: 'all 0.15s ease'
        }}
      >
        <CalendarIcon size={16} style={{ color: isOpen ? '#0066ff' : 'var(--primary)', flexShrink: 0 }} />
        <span style={{ flexGrow: 1 }}>{formatDisplayDate(value)}</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▼</span>
      </button>

      {/* Calendar Popover */}
      {isOpen && (
        <div
          className="datepicker-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 1000,
            width: '310px',
            padding: '16px',
            borderRadius: '14px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 8px 16px -6px rgba(0, 0, 0, 0.15)',
            animation: 'fadeInUp 0.15s ease-out',
            userSelect: 'none'
          }}
        >
          {renderCalendarBody()}
        </div>
      )}
    </div>
  );
};
