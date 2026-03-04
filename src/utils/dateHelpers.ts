import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, getISOWeek, isWeekend } from 'date-fns';
import { enUS } from 'date-fns/locale';

export const getCW = (date: Date) => `CW${getISOWeek(date)}`;

export const getDaysInMonth = (date: Date) => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return eachDayOfInterval({ start, end });
};

export const formatDate = (date: Date) => format(date, 'dd-MMM-yyyy');
export const formatDisplayDate = (date: Date) => format(date, 'dd/MM (EEEE)', { locale: enUS });
export const formatMonthYear = (date: Date) => format(date, 'MMMM yyyy', { locale: enUS });
export const formatTime = (date: Date) => format(date, 'HH:mm:ss dd/MM/yyyy');
export { isWeekend };
