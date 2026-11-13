import type { AiResult, CardioRow, DailyWellbeing, Measure, Settings } from '../types';
import type { Analysis } from './analysis';
import { currentPhase } from './analysis';

const MODELS = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

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
  for (const d of ['Push', 'Pull', 'Leg'] as const) {
    for (const e of a.byDay[d]) {
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

export async function generateAnalysis(
  a: Analysis,
  ms: Measure[],
  s: Settings,
  cardio: CardioRow[] = [],
  wellbeing: DailyWellbeing[] = [],
): Promise<AiResult> {
  if (!s.geminiKey) throw new Error('Falta la clave de Gemini (Ajustes).');
  const payload = buildPayload(a, ms, s, cardio, wellbeing);
  const prompt =
    'Eres un fisiólogo y entrenador de fuerza e hipertrofia de élite basado en la máxima evidencia científica. ' +
    'Analiza de forma integral TODOS los datos disponibles del usuario: antropometría, rendimiento y cargas en fuerza PPL, respuesta cardíaca por ejercicio/sesión (fc_media, fc_max, duración), sesiones de cardio, sueño, HRV nocturna, FC en reposo, puntuación de vitalidad y pasos diarios (NEAT). ' +
    'Cruza explícitamente estos factores: distingue si un estancamiento o bajada de rendimiento se debe a fatiga del SNC/poco sueño/caída de HRV, descansos cortos con pulso disparado o falta de progresión local; y relaciona cambios de peso/% graso con los pasos diarios (NEAT) y el gasto de cardio. ' +
    'Ten en cuenta que saltos bruscos de peso en máquinas pueden deberse a cambios de poleas, placas o máquinas; interprétalo con criterio técnico.\n\n' +
    'Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:\n' +
    '{\n' +
    '  "summary": "Resumen ejecutivo directo de 2-3 frases integrando fuerza, composición corporal, recuperación y NEAT.",\n' +
    '  "overview": {\n' +
    '    "overallStatus": "Frase corta de estado global (ej: \'Fase de definición sólida con buena recuperación\')",\n' +
    '    "highlights": [\n' +
    '      "Punto fuerte 1 sobre tu progresión en cargas o récord",\n' +
    '      "Punto clave sobre composición corporal, NEAT o cardio",\n' +
    '      "Aspecto clave de recuperación (sueño, HRV, FC reposo o pulso intra-entreno)"\n' +
    '    ],\n' +
    '    "sections": [\n' +
    '      {\n' +
    '        "title": "Composición Corporal y Antropometría",\n' +
    '        "verdict": "good" | "warning" | "neutral",\n' +
    '        "text": "Análisis de peso, % graso, masa muscular, perímetros clave y balance energético junto con pasos/NEAT y cardio."\n' +
    '      },\n' +
    '      {\n' +
    '        "title": "Rendimiento y Sobrecarga Progresiva PPL",\n' +
    '        "verdict": "good" | "warning" | "neutral",\n' +
    '        "text": "Análisis de ganancias de fuerza, patrones donde destacas y ejercicios con meseta o demanda cardiovascular alta."\n' +
    '      },\n' +
    '      {\n' +
    '        "title": "Recuperación, Sueño, NEAT y Respuesta Cardíaca",\n' +
    '        "verdict": "good" | "warning" | "neutral",\n' +
    '        "text": "Evaluación de horas y eficiencia de sueño, tendencia de HRV/FC reposo, densidad/pulso en las sesiones de fuerza y pasos diarios."\n' +
    '      },\n' +
    '      {\n' +
    '        "title": "Estrategia para el Próximo Mesociclo",\n' +
    '        "verdict": "good" | "warning" | "neutral",\n' +
    '        "text": "Recomendaciones concretas de nutrición/NEAT, ajustes de volumen, descansos entre series y posible descarga si hace falta."\n' +
    '      }\n' +
    '    ]\n' +
    '  },\n' +
    '  "byExercise": {\n' +
    '    "<nombre exacto del ejercicio>": {\n' +
    '      "status": "Estado corto (ej: \'Progresando (+2.5kg)\', \'Récord Personal\', \'Descanso Insuficiente\')",\n' +
    '      "prescription": "Acción táctica exacta para la próxima sesión (reps, peso, pausa teniendo en cuenta su FC si existe)",\n' +
    '      "biomech": "1-2 frases de análisis biomecánico, estímulo muscular y respuesta cardiovascular si aplica"\n' +
    '    }\n' +
    '  }\n' +
    '}\n\n' +
    'Escribe en español con tono profesional, motivador y fundamentado en ciencia deportiva. Sé conciso y directo para lectura rápida en móvil: máximo 2-3 frases por sección y 1 frase corta por highlight.\n\nDATOS DEL USUARIO:\n' + JSON.stringify(payload);

  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        errors.push(`${model} (HTTP ${res.status}): ${errorBody.slice(0, 150)}`);
        continue;
      }

      const j = await res.json();
      const text: string = j.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = JSON.parse(text);
      return {
        date: new Date().toISOString().slice(0, 10),
        summary: parsed.summary,
        overview: parsed.overview,
        byExercise: parsed.byExercise ?? {},
      };
    } catch (err) {
      errors.push(`${model}: ${(err as Error).message}`);
    }
  }

  throw new Error(`Fallaron los modelos probados: ${errors.join(' | ')}`);
}
