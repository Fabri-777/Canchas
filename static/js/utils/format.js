const LIMA = 'America/Lima';
const limaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: LIMA, year: 'numeric', month: '2-digit', day: '2-digit',
});

export const money = value => `S/ ${Number(value).toLocaleString('es-PE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;

export const dateFormat = (date, options) =>
  new Intl.DateTimeFormat('es-PE', { timeZone: LIMA, ...options }).format(new Date(date));

export const dayLabel = date =>
  dateFormat(`${date}T12:00:00-05:00`, { weekday: 'long', day: 'numeric', month: 'long' });

export const timeLabel = date => dateFormat(date, { hour: '2-digit', minute: '2-digit', hour12: false });
export const shortDate = date => dateFormat(date, { day: 'numeric', month: 'short' });
export const hourLabel = hour => `${String(hour).padStart(2, '0')}:00`;

export function shiftDate(date, offset) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function todayInLima(now = Date.now()) {
  const parts = limaDate.formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
