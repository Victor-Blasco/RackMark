import { DEFAULT_SETTINGS, todayIso } from './seed';
import type { CardioRow, DailyWellbeing, Measure, Settings, StrengthRow } from '../types';

export interface DemoDataset {
  settings: Settings;
  strength: StrengthRow[];
  cardio: CardioRow[];
  measures: Measure[];
  wellbeing: DailyWellbeing[];
}

function isoDaysAgo(baseIso: string, daysAgo: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - daysAgo));
  return dt.toISOString().slice(0, 10);
}

/**
 * Genera un conjunto de datos sintéticos coherentes (~10 semanas) para explorar RackMark sin cuenta.
 *
 * @returns Configuración, fuerza, cardio, medidas corporales y bienestar listos para análisis en memoria.
 */
export function buildDemoDataset(): DemoDataset {
  const today = todayIso();
  const phase1Start = isoDaysAgo(today, 68);
  const phase2Start = isoDaysAgo(today, 28);

  const settings: Settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    onboardingCompleted: true,
    profile: {
      sex: 'hombre',
      age: 26,
      height: 176,
      goal: 'cut',
      experience: 'intermediate',
      daysPerWeek: 4,
    },
    phases: [
      { name: 'Volumen limpio', start: phase1Start },
      { name: 'Definición', start: phase2Start },
    ],
    notes: {
      'Press de banca': 'Pausa breve en el pecho y retracción escapular constante.',
      'Sentadilla trasera': 'Bajar controlado 2s y mantener rodillas alineadas.',
    },
    aiTone: 'technical',
    ai: {
      date: isoDaysAgo(today, 1),
      tone: 'technical',
      summary:
        'Bloque de definición estable: mantienes el e1RM en banca (105 kg) y sentadilla (132 kg) mientras bajas 1,9 kg de peso corporal en 4 semanas. Adherencia sólida (4,0 sesiones/sem) y recuperación media correcta (HRV 56 ms).',
      overview: {
        overallStatus: 'Definición efectiva sin pérdida de fuerza',
        highlights: [
          'Peso corporal −1,9 kg en 4 semanas preservando masa magra estimada.',
          'Empuje y tracción mantienen cargas objetivo sin caída de repeticiones.',
          'Media de 7h 18m de sueño y HRV medio de 56 ms.',
        ],
        sections: [
          {
            title: 'Cuerpo',
            verdict: 'good',
            text: 'Peso medio 74,2 kg (−0,45 kg/sem dentro del rango óptimo). La cintura baja de 81,5 cm a 79,4 cm preservando masa magra estimada.',
          },
          {
            title: 'Fuerza',
            verdict: 'good',
            text: 'Empuje y tracción mantienen cargas objetivo sin caída de repeticiones. Prioriza consolidar 3×8 con 82,5 kg en press banca antes de subir a 85 kg.',
          },
          {
            title: 'Sueño y FC',
            verdict: 'neutral',
            text: 'Media de 7h 18m de sueño y 9.400 pasos/día. Los días con menos de 6h 30m coinciden con ligero repunte de pulso en reposo.',
          },
          {
            title: 'Plan',
            verdict: 'good',
            text: 'Mantén el déficit actual 2 semanas más, conserva 14–16 series semanales en torso y evita añadir series extra si el HRV cae por debajo de 48 ms.',
          },
        ],
      },
      byExercise: {
        'Press de banca': {
          status: 'Consolidando',
          prescription: 'Mantén 82,5 kg buscando 3×8 limpio (RIR 1–2) antes de subir a 85 kg.',
          biomech: 'Pausa corta abajo y trayectoria diagonal hacia los hombros.',
        },
        'Dominadas lastradas': {
          status: 'Progresando',
          prescription: 'Sube a +15 kg para 3×6 manteniendo rango completo.',
          biomech: 'Inicia el tirón deprimiendo escápulas sin balanceo.',
        },
        'Sentadilla trasera': {
          status: 'Subir carga',
          prescription: 'Sube a 107,5 kg buscando 3×6 con 2:30 de descanso.',
          biomech: 'Bracing abdominal firme antes de iniciar la bajada.',
        },
      },
    },
  };

  const strength: StrengthRow[] = [];
  const cardio: CardioRow[] = [];
  const measures: Measure[] = [];
  const wellbeing: DailyWellbeing[] = [];

  const rot: Array<'Push' | 'Pull' | 'Leg'> = ['Push', 'Pull', 'Leg'];
  for (let i = 0; i < 27; i++) {
    const daysAgo = 66 - Math.round((i * 65) / 26);
    const date = isoDaysAgo(today, daysAgo);
    const day = rot[i % 3];
    const sid = `demo-${date}-${day.toLowerCase()}`;
    const cycle = Math.floor(i / 3);
    const baseTs = Date.parse(`${date}T18:30:00Z`);

    if (day === 'Push') {
      const benchW = cycle < 4 ? 77.5 : cycle < 7 ? 80 : 82.5;
      const benchReps = cycle >= 7 ? [8, 8, 7] : [8, 7, 7];
      strength.push(
        {
          id: `${sid}-bench`,
          sessionId: sid,
          ts: baseTs,
          date,
          day,
          ref: 'name:Press de banca',
          durMin: 58,
          avgHr: 124,
          maxHr: 148,
          kcal: 410,
          sets: benchReps.map((r) => ({ w: benchW, r, rir: 1, restSec: 150 })),
        },
        {
          id: `${sid}-ohp`,
          sessionId: sid,
          ts: baseTs + 15 * 60000,
          date,
          day,
          ref: 'name:Press militar con barra',
          sets: [
            { w: 45 + (cycle >= 5 ? 2.5 : 0), r: 8, restSec: 120 },
            { w: 45 + (cycle >= 5 ? 2.5 : 0), r: 8, restSec: 120 },
            { w: 45 + (cycle >= 5 ? 2.5 : 0), r: 7, restSec: 120 },
          ],
        },
        {
          id: `${sid}-lat`,
          sessionId: sid,
          ts: baseTs + 30 * 60000,
          date,
          day,
          ref: 'name:Elevaciones laterales con mancuernas',
          sets: [
            { w: 12.5, r: 14, restSec: 60 },
            { w: 12.5, r: 13, restSec: 60 },
            { w: 12.5, r: 12, restSec: 60 },
          ],
        },
      );
    } else if (day === 'Pull') {
      const pullW = 10 + Math.min(5, Math.floor(cycle / 2) * 2.5);
      strength.push(
        {
          id: `${sid}-pullup`,
          sessionId: sid,
          ts: baseTs,
          date,
          day,
          ref: 'name:Dominadas lastradas',
          durMin: 54,
          avgHr: 128,
          maxHr: 152,
          kcal: 395,
          sets: [
            { w: pullW, r: 7, rir: 1, restSec: 150 },
            { w: pullW, r: 6, rir: 1, restSec: 150 },
            { w: pullW, r: 6, rir: 0, restSec: 150 },
          ],
        },
        {
          id: `${sid}-row`,
          sessionId: sid,
          ts: baseTs + 18 * 60000,
          date,
          day,
          ref: 'name:Remo en polea baja',
          sets: [
            { w: 60 + (cycle >= 4 ? 5 : 0), r: 10, restSec: 90 },
            { w: 60 + (cycle >= 4 ? 5 : 0), r: 10, restSec: 90 },
            { w: 60 + (cycle >= 4 ? 5 : 0), r: 9, restSec: 90 },
          ],
        },
        {
          id: `${sid}-curl`,
          sessionId: sid,
          ts: baseTs + 34 * 60000,
          date,
          day,
          ref: 'name:Curl con barra Z',
          sets: [
            { w: 30, r: 11, restSec: 75 },
            { w: 30, r: 10, restSec: 75 },
            { w: 30, r: 9, restSec: 75 },
          ],
        },
      );
    } else {
      const squatW = 95 + Math.min(10, Math.floor(cycle / 2) * 2.5);
      strength.push(
        {
          id: `${sid}-squat`,
          sessionId: sid,
          ts: baseTs,
          date,
          day,
          ref: 'name:Sentadilla trasera',
          durMin: 64,
          avgHr: 136,
          maxHr: 162,
          kcal: 490,
          sets: [
            { w: squatW, r: 6, rir: 2, restSec: 150 },
            { w: squatW, r: 6, rir: 1, restSec: 150 },
            { w: squatW, r: 6, rir: 1, restSec: 150 },
          ],
        },
        {
          id: `${sid}-rdl`,
          sessionId: sid,
          ts: baseTs + 22 * 60000,
          date,
          day,
          ref: 'name:Peso muerto rumano',
          sets: [
            { w: 90 + (cycle >= 5 ? 5 : 0), r: 8, restSec: 120 },
            { w: 90 + (cycle >= 5 ? 5 : 0), r: 8, restSec: 120 },
            { w: 90 + (cycle >= 5 ? 5 : 0), r: 8, restSec: 120 },
          ],
        },
      );
    }
  }

  for (let c = 0; c < 10; c++) {
    const date = isoDaysAgo(today, 62 - c * 6);
    cardio.push({
      id: `demo-cardio-${date}`,
      ts: Date.parse(`${date}T08:00:00Z`),
      date,
      type: 1,
      durMin: 26 + (c % 3) * 4,
      distKm: 4.1 + (c % 3) * 0.6,
      avgHr: 141 - (c % 4),
      kcal: 295 + (c % 3) * 35,
      vo2: 47.4 + c * 0.15,
    });
  }

  for (let m = 0; m < 12; m++) {
    const daysAgo = 66 - m * 6;
    const date = isoDaysAgo(today, daysAgo);
    const inCut = daysAgo <= 28;
    const w = inCut ? 76.1 - ((28 - daysAgo) / 28) * 1.9 : 75.2 + ((66 - daysAgo) / 38) * 0.9;
    measures.push({
      date,
      weight: Number(w.toFixed(1)),
      bf: Number((inCut ? 15.8 - ((28 - daysAgo) / 28) * 1.2 : 15.6).toFixed(1)),
      muscle: Number((inCut ? 36.2 : 35.8 + (m * 0.05)).toFixed(1)),
      waist: Number((inCut ? 81.5 - ((28 - daysAgo) / 28) * 2.1 : 81.4).toFixed(1)),
    });
  }

  for (let d = 40; d >= 1; d--) {
    const date = isoDaysAgo(today, d);
    wellbeing.push({
      date,
      steps: 8200 + ((d * 733) % 3900),
      sleepMin: 410 + ((d * 29) % 75),
      sleepScore: 76 + ((d * 7) % 18),
      hrv: 50 + ((d * 11) % 16),
      rhr: 53 + (d % 5),
    });
  }

  return { settings, strength, cardio, measures, wellbeing };
}
