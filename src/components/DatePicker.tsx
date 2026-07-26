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

export const DatePicker: React.FC<DatePickerProps> = ({ 
  value, 
  onChange, 
  min, 
  max, 
  style,
  rangeStart,
  rangeEnd
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

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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
    setIsOpen(false);
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
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 1000,
            width: '310px',
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 8px 16px -6px rgba(0, 0, 0, 0.15)',
            animation: 'fadeInUp 0.15s ease-out',
            userSelect: 'none'
          }}
        >
          {/* Calendar Header with Arrows on the Right (exactly like the image) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingLeft: '4px',
              paddingRight: '4px'
            }}
          >
            <span
              style={{
                fontWeight: '700',
                fontSize: '1rem',
                color: 'var(--text-primary)',
                textTransform: 'capitalize'
              }}
            >
              {MONTH_NAMES_ES[monthIdx]} {year}
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
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
                  width: '30px',
                  height: '30px',
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

          {/* Weekday Names (Ultra-clean single letter format) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              marginBottom: '10px'
            }}
          >
            {WEEKDAYS_ES.map((day, idx) => (
              <span
                key={`${day}-${idx}`}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-muted)',
                  padding: '4px 0',
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
              rowGap: '6px',
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
                height: '34px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '100%'
              };

              // Apply range selection styles (matching the pill design in the image)
              if (isStart && isEnd) {
                cellStyle = {
                  ...cellStyle,
                  background: '#0066ff',
                  color: '#ffffff',
                  borderRadius: '10px'
                };
              } else if (isStart) {
                cellStyle = {
                  ...cellStyle,
                  background: '#0066ff',
                  color: '#ffffff',
                  borderRadius: '10px 0 0 10px'
                };
              } else if (isEnd) {
                cellStyle = {
                  ...cellStyle,
                  background: '#0066ff',
                  color: '#ffffff',
                  borderRadius: '0 10px 10px 0'
                };
              } else if (isInRange) {
                cellStyle = {
                  ...cellStyle,
                  background: 'rgba(0, 102, 255, 0.15)',
                  color: 'var(--text-primary)',
                  borderRadius: '0px'
                };
              } else if (active) {
                cellStyle = {
                  ...cellStyle,
                  background: '#0066ff',
                  color: '#ffffff',
                  borderRadius: '10px'
                };
              } else if (disabled) {
                cellStyle = {
                  ...cellStyle,
                  opacity: 0.2,
                  pointerEvents: 'none',
                  color: 'var(--text-muted)'
                };
              } else if (!isCurrentMonth) {
                cellStyle = {
                  ...cellStyle,
                  color: 'var(--text-muted)',
                  opacity: 0.4
                };
              } else {
                cellStyle = {
                  ...cellStyle,
                  color: 'var(--text-primary)'
                };
              }

              // Blue border loop if it's today and not highlighted inside a selection
              const showTodayRing = today && !active && !isStart && !isEnd && !isInRange;

              if (showTodayRing) {
                cellStyle = {
                  ...cellStyle,
                  border: '1.5px solid #0066ff',
                  borderRadius: '10px'
                };
              }

              return (
                <button
                  key={`${dateObj.getTime()}-${idx}`}
                  type="button"
                  disabled={disabled}
                  onClick={(e) => handleSelectDay(dateObj, e)}
                  style={cellStyle}
                  className="calendar-day-btn"
                  onMouseEnter={(e) => {
                    if (!active && !disabled && !isStart && !isEnd && !isInRange) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderRadius = '10px';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active && !disabled && !isStart && !isEnd && !isInRange) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
