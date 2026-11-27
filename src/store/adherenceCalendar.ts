import { inRange, routineColor, routineNames, todayIso, type DateBounds, type State } from '../ui/shared';

export const CARDIO_CALENDAR_COLOR = '#06B6D4';
export const OTHER_CALENDAR_COLOR = '#6B7280';
export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface CalendarStrengthItem {
  day: string;
  color: string;
  sets: number;
  durMin?: number;
  kcal?: number;
  avgHr?: number;
}

export interface CalendarCardioItem {
  durMin: number;
  distKm: number;
  kcal?: number;
  avgHr?: number;
}

export interface CalendarDayActivity {
  iso: string;
  inBounds: boolean;
  strength: CalendarStrengthItem[];
  cardio: CalendarCardioItem[];
  primaryColor?: string;
  primaryLabel?: string;
  multi: boolean;
}

export interface CalendarGridDay {
  iso: string;
  dayNum: number;
  inMonth: boolean;
  inBounds: boolean;
  isToday: boolean;
  activity?: CalendarDayActivity;
}

export interface AdherenceCalendarData {
  months: string[];
  defaultMonth: string;
  today: string;
  byDate: Record<string, CalendarDayActivity>;
  hasCardio: boolean;
}

/** Formatea `YYYY-MM` como `"Noviembre 2026"`. */
export const formatMonthTitle = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[(m || 1) - 1] ?? ''} ${y || ''}`.trim();
};

/** Formatea `YYYY-MM-DD` como `"sáb, 14 nov"`. */
export const formatDayHeading = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
};

export const monthList = (minYm: string, maxYm: string): string[] => {
  const [sy, sm] = minYm.split('-').map(Number);
  const [ey, em] = maxYm.split('-').map(Number);
  const startIdx = Math.max(0, sy * 12 + (sm - 1));
  const endIdx = Math.max(startIdx, ey * 12 + (em - 1));
  const clampedStart = Math.max(startIdx, endIdx - 119);
  const out: string[] = [];
  for (let idx = clampedStart; idx <= endIdx; idx++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
};

/** Agrupa entrenamientos de fuerza y cardio por fecha y calcula los meses navegables del rango. */
export function buildAdherenceCalendarData(state: State, bounds: DateBounds, allDates: string[]): AdherenceCalendarData {
  const today = todayIso();
  const routines = routineNames(state.settings);
  const validDates = allDates.filter(Boolean).sort();
  const maxYm = (bounds.to ?? today).slice(0, 7);
  const rawMinYm = bounds.from ? bounds.from.slice(0, 7) : (validDates[0]?.slice(0, 7) ?? maxYm);
  const months = monthList(rawMinYm <= maxYm ? rawMinYm : maxYm, maxYm);
  const todayYm = today.slice(0, 7);
  const defaultMonth = months.includes(todayYm) ? todayYm : (months[months.length - 1] ?? todayYm);

  const byDate: Record<string, CalendarDayActivity> = {};
  const ensure = (iso: string): CalendarDayActivity => {
    if (!byDate[iso]) byDate[iso] = { iso, inBounds: inRange(iso, bounds), strength: [], cardio: [], multi: false };
    return byDate[iso];
  };

  for (const s of state.analysis.sessions) {
    const idx = s.day ? routines.indexOf(s.day) : -1;
    const color = s.day ? routineColor(s.day, state.settings, Math.max(0, idx)) : OTHER_CALENDAR_COLOR;
    ensure(s.date).strength.push({ day: s.day ?? 'Otro entrenamiento', color, sets: s.sets, durMin: s.durMin, kcal: s.kcal, avgHr: s.avgHr });
  }
  for (const c of state.cardio) {
    ensure(c.date).cardio.push({ durMin: c.durMin, distKm: c.distKm, kcal: c.kcal, avgHr: c.avgHr });
  }
  for (const act of Object.values(byDate)) {
    const firstStr = act.strength.find((x) => x.day !== 'Otro entrenamiento') ?? act.strength[0];
    act.primaryColor = firstStr ? firstStr.color : act.cardio.length ? CARDIO_CALENDAR_COLOR : undefined;
    act.primaryLabel = firstStr ? firstStr.day : act.cardio.length ? 'Cardio' : undefined;
    act.multi = act.strength.length + act.cardio.length > 1;
  }

  return { months, defaultMonth, today, byDate, hasCardio: state.cardio.length > 0 };
}

/** Construye la cuadrícula semanal (lunes a domingo) de un mes `YYYY-MM`. */
export function buildMonthGrid(
  ym: string,
  today: string,
  bounds: DateBounds,
  byDate: Record<string, CalendarDayActivity>,
): CalendarGridDay[] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - offset);
  const nextMonth = new Date(Date.UTC(y, m, 1));
  const totalCells = Math.ceil((offset + Math.round((nextMonth.getTime() - first.getTime()) / 864e5)) / 7) * 7;

  return Array.from({ length: totalCells }, () => {
    const iso = cursor.toISOString().slice(0, 10);
    const cell: CalendarGridDay = {
      iso,
      dayNum: cursor.getUTCDate(),
      inMonth: iso.startsWith(ym),
      inBounds: inRange(iso, bounds),
      isToday: iso === today,
      activity: byDate[iso],
    };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return cell;
  });
}
