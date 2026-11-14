import { AIError, getGenerativeModel } from 'firebase/ai';
import type { AiResult, AiTone, CardioRow, DailyWellbeing, Measure, Settings } from '../types';
import type { Analysis } from './analysis';
import { currentPhase } from './analysis';
import { getAiBackend } from './firebase';

const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];

const avgOf = (vals: (number | undefined)[], dec = 1) => {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return undefined;
  const k = 10 ** dec;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * k) / k;
};

function summarizeWellbeingWindow(rows: DailyWellbeing[]) {
  const sleepH = avgOf(rows.map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)), 2);
  return {
    dias: rows.length,
    ...(sleepH != null ? { sueno_horas_media: sleepH } : {}),
    ...(avgOf(rows.map((w) => w.sleepScore), 0) != null ? { sueno_puntuacion_media: avgOf(rows.map((w) => w.sleepScore), 0) } : {}),
    ...(avgOf(rows.map((w) => w.sleepEff), 0) != null ? { sueno_eficiencia_media: avgOf(rows.map((w) => w.sleepEff), 0) } : {}),
    ...(avgOf(rows.map((w) => w.steps), 0) != null ? { pasos_media: avgOf(rows.map((w) => w.steps), 0) } : {}),
    ...(avgOf(rows.map((w) => w.activeMin), 0) != null ? { min_activos_media: avgOf(rows.map((w) => w.activeMin), 0) } : {}),
    ...(avgOf(rows.map((w) => w.rhr), 0) != null ? { fc_reposo_media: avgOf(rows.map((w) => w.rhr), 0) } : {}),
    ...(avgOf(rows.map((w) => w.hrv), 0) != null ? { hrv_media_ms: avgOf(rows.map((w) => w.hrv), 0) } : {}),
    ...(avgOf(rows.map((w) => w.energyScore), 0) != null ? { vitalidad_media: avgOf(rows.map((w) => w.energyScore), 0) } : {}),
  };
}

/** Resumen compacto: 8 semanas por ejercicio (con pulso), sesiones, cardio, sueño/pasos/HRV y medidas. */
export function buildPayload(
  a: Analysis,
  ms: Measure[],
  s: Settings,
  cardio: CardioRow[] = [],
  wellbeing: DailyWellbeing[] = [],
) {
  const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const since56 = daysAgo(56);
  const since28 = daysAgo(28);
  const since7 = daysAgo(7);

  const exercises: Record<string, unknown> = {};
  for (const d of Object.keys(a.byDay)) {
    for (const e of a.byDay[d] ?? []) {
      exercises[e.name] = {
        dia: d, objetivo: e.target ? `${e.target.sets}x${e.target.reps}` : undefined,
        estado_reglas: e.status,
        ...(e.avgHr ? { fc_media_historica: e.avgHr } : {}),
        ...(e.maxHr ? { fc_max_historica: e.maxHr } : {}),
        ...(s.notes[e.name] ? { nota_fija: s.notes[e.name] } : {}),
        sesiones: e.sessions.filter((x) => x.date >= since56).map((x) => ({
          fecha: x.date, series: x.sets.map((y) => `${y.w}kg x${y.r}`), e1rm: x.e1rm,
          ...(x.avgHr ? { fc_media: x.avgHr } : {}),
          ...(x.maxHr ? { fc_max: x.maxHr } : {}),
          ...(x.durMin ? { dur_min: x.durMin } : {}),
          ...(x.kcal ? { kcal: x.kcal } : {}),
          ...(x.note ? { nota: x.note } : {}),
        })),
      };
    }
  }

  const cardio56 = cardio.filter((c) => c.date >= since56);
  const lastVo2 = [...cardio].reverse().find((c) => c.vo2 && c.vo2 > 0)?.vo2;
  const wellSorted = [...wellbeing].sort((a, b) => a.date.localeCompare(b.date));

  return {
    fase: currentPhase(s)?.name ?? 'sin definir',
    perfil: s.profile,
    medidas_recientes: ms.slice(-5),
    ejercicios: exercises,
    sesiones_fuerza_recientes: a.sessions.slice(-15).map((x) => ({
      fecha: x.date, rutina: x.day ?? 'Otro', series: x.sets,
      ...(x.durMin ? { dur_min: x.durMin } : {}),
      ...(x.avgHr ? { fc_media: x.avgHr } : {}),
      ...(x.maxHr ? { fc_max: x.maxHr } : {}),
      ...(x.kcal ? { kcal: x.kcal } : {}),
    })),
    cardio_reciente: {
      resumen_8_sem: {
        sesiones: cardio56.length,
        km_totales: Math.round(cardio56.reduce((sum, c) => sum + c.distKm, 0) * 10) / 10,
        min_totales: Math.round(cardio56.reduce((sum, c) => sum + c.durMin, 0)),
        ...(avgOf(cardio56.map((c) => c.avgHr || undefined), 0) != null ? { fc_media: avgOf(cardio56.map((c) => c.avgHr || undefined), 0) } : {}),
        ...(lastVo2 ? { vo2_max_reciente: lastVo2 } : {}),
      },
      ultimas_sesiones: cardio.slice(-12).map((c) => ({
        fecha: c.date, dur_min: c.durMin, dist_km: c.distKm, fc_media: c.avgHr, kcal: c.kcal, ...(c.vo2 ? { vo2: c.vo2 } : {}),
      })),
    },
    recuperacion_y_actividad: {
      ultimos_7_dias: summarizeWellbeingWindow(wellSorted.filter((w) => w.date >= since7)),
      ultimos_28_dias: summarizeWellbeingWindow(wellSorted.filter((w) => w.date >= since28)),
      detalle_ultimos_14_dias: wellSorted.slice(-14).map((w) => ({
        fecha: w.date,
        ...(w.sleepMin ? { sueno_h: Math.round((w.sleepMin / 60) * 10) / 10 } : {}),
        ...(w.sleepScore ? { sueno_score: w.sleepScore } : {}),
        ...(w.sleepEff ? { sueno_ef: w.sleepEff } : {}),
        ...(w.steps ? { pasos: w.steps } : {}),
        ...(w.rhr ? { fc_reposo: w.rhr } : {}),
        ...(w.hrv ? { hrv: w.hrv } : {}),
        ...(w.energyScore ? { vitalidad: w.energyScore } : {}),
      })),
    },
  };
}

const TONE_SPEC: Record<
  AiTone,
  {
    intro: string;
    titles: [string, string, string, string];
    sectionHints: [string, string, string, string];
    exerciseHint: { status: string; prescription: string; biomech: string };
    closing: string;
  }
> = {
  simple: {
    intro:
      'Eres un entrenador personal cercano y claro que explica los progresos de forma sencilla y sin tecnicismos. ' +
      'Analiza todos los datos disponibles (peso corporal, medidas, entrenamientos de fuerza, cardio, sueño, pulso y pasos diarios) y traduce los patrones en conclusiones fáciles de entender y aplicar hoy mismo. ' +
      'Evita jerga técnica o abreviaturas especializadas; habla en términos cotidianos como recuperación general, fuerza estimada, pasos diarios o descanso entre series. ' +
      'Ten en cuenta que saltos grandes de peso en máquinas pueden deberse simplemente a usar otra máquina o sistema de poleas.',
    titles: [
      'Peso y forma física',
      'Progreso en fuerza',
      'Descanso, pasos y energía',
      'Qué hacer en las próximas semanas',
    ],
    sectionHints: [
      'Resume en lenguaje llano si el peso, la cintura o la masa muscular avanzan en la dirección de la fase actual junto con los pasos diarios y el cardio.',
      'Explica de forma directa en qué ejercicios estás subiendo kilos o repeticiones y dónde conviene mantener o ajustar.',
      'Comenta si estás durmiendo suficiente, cómo responde tu pulso al esfuerzo y si los pasos diarios acompañan.',
      'Propón 2-3 ajustes prácticos y fáciles de seguir para la semana que viene (descansos, esfuerzo, sueño o actividad diaria).',
    ],
    exerciseHint: {
      status: "Estado claro de 1-3 palabras (ej: 'Subiendo bien', 'Récord personal', 'Cuidar descanso')",
      prescription: 'Consejo práctico y directo para el próximo entreno (peso, repeticiones o si conviene descansar un poco más entre series)',
      biomech: '1-2 frases sencillas sobre técnica, sensación muscular o ritmo de las series',
    },
    closing:
      'Escribe en español cotidiano, ameno y motivador para alguien que quiere entender su progreso de un vistazo. Máximo 2-3 frases por sección y 1 frase corta por highlight.',
  },
  technical: {
    intro:
      'Eres un fisiólogo y entrenador de fuerza e hipertrofia de élite basado en la máxima evidencia científica. ' +
      'Analiza de forma integral TODOS los datos disponibles del usuario: antropometría, rendimiento y cargas en fuerza PPL, respuesta cardíaca por ejercicio/sesión (fc_media, fc_max, duración), sesiones de cardio, sueño, HRV nocturna, FC en reposo, puntuación de vitalidad y pasos diarios (NEAT). ' +
      'Cruza explícitamente estos factores: distingue si un estancamiento o bajada de rendimiento se debe a fatiga del SNC/poco sueño/caída de HRV, descansos cortos con pulso disparado o falta de progresión local; y relaciona cambios de peso/% graso con los pasos diarios (NEAT) y el gasto de cardio. ' +
      'Ten en cuenta que saltos bruscos de peso en máquinas pueden deberse a cambios de poleas, placas o máquinas; interprétalo con criterio técnico.',
    titles: [
      'Composición Corporal y Antropometría',
      'Rendimiento y Sobrecarga Progresiva PPL',
      'Recuperación, Sueño, NEAT y Respuesta Cardíaca',
      'Estrategia para el Próximo Mesociclo',
    ],
    sectionHints: [
      'Análisis de peso, % graso, masa muscular, perímetros clave y balance energético junto con pasos/NEAT y cardio.',
      'Análisis de ganancias de fuerza, patrones donde destacas y ejercicios con meseta o demanda cardiovascular alta.',
      'Evaluación de horas y eficiencia de sueño, tendencia de HRV/FC reposo, densidad/pulso en las sesiones de fuerza y pasos diarios.',
      'Recomendaciones concretas de nutrición/NEAT, ajustes de volumen, descansos entre series y posible descarga si hace falta.',
    ],
    exerciseHint: {
      status: "Estado corto (ej: 'Progresando (+2.5kg)', 'Récord Personal', 'Descanso Insuficiente')",
      prescription: 'Acción táctica exacta para la próxima sesión (reps, peso, pausa teniendo en cuenta su FC si existe)',
      biomech: '1-2 frases de análisis biomecánico, estímulo muscular y respuesta cardiovascular si aplica',
    },
    closing:
      'Escribe en español con tono profesional, motivador y fundamentado en ciencia deportiva. Sé conciso y directo para lectura rápida en móvil: máximo 2-3 frases por sección y 1 frase corta por highlight.',
  },
};

/** Construye el prompt JSON estructurado adaptado al nivel técnico solicitado. */
export function buildPrompt(payload: unknown, tone: AiTone = 'technical'): string {
  const spec = TONE_SPEC[tone];
  const sectionsJson = spec.titles
    .map(
      (title, i) =>
        `      {\n        "title": "${title}",\n        "verdict": "good" | "warning" | "neutral",\n        "text": "${spec.sectionHints[i]}"\n      }`,
    )
    .join(',\n');

  return (
    `${spec.intro}\n\n` +
    'Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:\n' +
    '{\n' +
    '  "summary": "Resumen ejecutivo directo de 2-3 frases integrando fuerza, composición corporal, recuperación y actividad.",\n' +
    '  "overview": {\n' +
    '    "overallStatus": "Frase corta de estado global",\n' +
    '    "highlights": [\n' +
    '      "Punto fuerte 1 sobre tu progresión en fuerza o récords",\n' +
    '      "Punto clave sobre composición corporal, pasos diarios o cardio",\n' +
    '      "Aspecto clave de descanso, sueño o respuesta cardíaca"\n' +
    '    ],\n' +
    '    "sections": [\n' +
    `${sectionsJson}\n` +
    '    ]\n' +
    '  },\n' +
    '  "byExercise": {\n' +
    '    "<nombre exacto del ejercicio>": {\n' +
    `      "status": "${spec.exerciseHint.status}",\n` +
    `      "prescription": "${spec.exerciseHint.prescription}",\n` +
    `      "biomech": "${spec.exerciseHint.biomech}"\n` +
    '    }\n' +
    '  }\n' +
    '}\n\n' +
    `${spec.closing}\n\nDATOS DEL USUARIO:\n` +
    JSON.stringify(payload)
  );
}

export async function generateAnalysis(
  a: Analysis,
  ms: Measure[],
  s: Settings,
  cardio: CardioRow[] = [],
  wellbeing: DailyWellbeing[] = [],
): Promise<AiResult> {
  const tone: AiTone = s.aiTone === 'simple' ? 'simple' : 'technical';
  const payload = buildPayload(a, ms, s, cardio, wellbeing);
  const prompt = buildPrompt(payload, tone);

  const ai = getAiBackend();
  const errors: string[] = [];
  for (const modelName of MODELS) {
    try {
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const res = await model.generateContent(prompt);
      const raw = res.response.text();
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(clean);
      return {
        date: new Date().toISOString().slice(0, 10),
        tone,
        summary: parsed.summary,
        overview: parsed.overview,
        byExercise: parsed.byExercise ?? {},
      };
    } catch (err) {
      if (err instanceof AIError) {
        if (err.code === 'api-not-enabled') {
          throw new Error('Firebase AI Logic no está activado aún en Firebase Console para este proyecto.');
        }
        errors.push(`${modelName} (${err.code}): ${err.message.slice(0, 150)}`);
      } else {
        errors.push(`${modelName}: ${(err as Error).message}`);
      }
    }
  }

  throw new Error(`Fallaron los modelos probados: ${errors.join(' | ')}`);
}
