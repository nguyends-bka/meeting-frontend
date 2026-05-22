import React, { useMemo } from 'react';
import dayjs from 'dayjs';

interface CalendarStripProps {
  selectedDate: dayjs.Dayjs;
  onSelectDate: (date: dayjs.Dayjs) => void;
  isNarrow?: boolean;
}

export default function CalendarStrip({ selectedDate, onSelectDate, isNarrow }: CalendarStripProps) {
  const daysOfWeek = useMemo(() => {
    const startOfWeek = dayjs().startOf('isoWeek');
    return Array.from({ length: 7 }).map((_, index) => {
      return startOfWeek.add(index, 'day');
    });
  }, []);

  const getDayLabel = (date: dayjs.Dayjs) => {
    const d = date.day();
    if (d === 0) return 'CN';
    return `T${d + 1}`;
  };

  return (
    <div
      className="calendar-strip-container"
      style={{
        gap: isNarrow ? '4px' : undefined,
        marginBottom: isNarrow ? '0px' : undefined,
        padding: isNarrow ? '2px 0' : undefined,
      }}
    >
      {daysOfWeek.map((day) => {
        const isSelected = day.isSame(selectedDate, 'day');
        const isToday = day.isSame(dayjs(), 'day');
        
        return (
          <div
            key={day.toISOString()}
            className={`calendar-day-card ${isSelected ? 'active' : ''}`}
            onClick={() => onSelectDate(day)}
            style={{
              boxShadow: isToday && !isSelected ? '0 0 0 2px #3b82f640' : undefined,
              borderColor: isToday && !isSelected ? '#3b82f6' : undefined,
              padding: isNarrow ? '5px 2px' : undefined,
              borderRadius: isNarrow ? '6px' : undefined,
              minWidth: isNarrow ? '30px' : undefined,
            }}
          >
            <span
              className="day-label"
              style={{
                fontSize: isNarrow ? '9px' : undefined,
                marginBottom: isNarrow ? '0px' : undefined,
              }}
            >
              {getDayLabel(day)}
            </span>
            <span
              className="day-number"
              style={{
                fontSize: isNarrow ? '12px' : undefined,
                lineHeight: isNarrow ? 1.1 : undefined,
              }}
            >
              {day.date()}
            </span>
            {isToday && !isSelected && (
              <div
                style={{
                  width: isNarrow ? 3 : 4,
                  height: isNarrow ? 3 : 4,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  marginTop: isNarrow ? 1 : 2,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
