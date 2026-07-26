import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  style?: React.CSSProperties;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

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

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, min, max, style }) => {
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
    // Compare times at midnight to avoid hours mismatch
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
      {/* Trigger Button */}
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
          borderRadius: '8px',
          border: '1px solid var(--border-input)',
          background: 'var(--bg-input)',
          color: 'var(--text-input)',
          fontWeight: '600',
          fontSize: '0.9rem',
          textAlign: 'left',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary-light)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-input)';
        }}
      >
        <CalendarIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
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
            width: '300px',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            animation: 'fadeInUp 0.15s ease-out',
            userSelect: 'none'
          }}
        >
          {/* Calendar Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}
          >
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: 'none',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.03)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)'}
            >
              <ChevronLeft size={16} />
            </button>

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

            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: 'none',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.03)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)'}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday Names */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              marginBottom: '6px'
            }}
          >
            {WEEKDAYS_ES.map((day) => (
              <span
                key={day}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-muted)',
                  padding: '4px 0'
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
              gap: '4px',
              textAlign: 'center'
            }}
          >
            {gridCells.map(({ day, dateObj, isCurrentMonth }, idx) => {
              const disabled = isDisabled(dateObj);
              const active = isSelected(dateObj);
              const today = isToday(dateObj);

              let cellStyle: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '32px',
                fontSize: '0.85rem',
                fontWeight: '600',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative'
              };

              if (active) {
                cellStyle = {
                  ...cellStyle,
                  background: 'var(--primary)',
                  color: '#ffffff'
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
                  opacity: 0.5
                };
              } else {
                cellStyle = {
                  ...cellStyle,
                  color: 'var(--text-primary)'
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
                    if (!active && !disabled) {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active && !disabled) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {day}
                  {today && !active && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: 'var(--primary)'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
