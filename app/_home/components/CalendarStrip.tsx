import React, { useMemo } from 'react';
import dayjs from 'dayjs';

interface CalendarStripProps {
  selectedDate: dayjs.Dayjs;
  onSelectDate: (date: dayjs.Dayjs) => void;
}

export default function CalendarStrip({ selectedDate, onSelectDate }: CalendarStripProps) {
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
    <div className="calendar-strip-container">
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
            }}
          >
            <span className="day-label">{getDayLabel(day)}</span>
            <span className="day-number">{day.date()}</span>
            {isToday && !isSelected && (
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  marginTop: 2,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
