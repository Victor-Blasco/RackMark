import { AIError, getAI, getGenerativeModel, GoogleAIBackend, type AI } from 'firebase/ai';
import type { AiResult, AiTone, CardioRow, DailyWellbeing, Measure, Settings } from '../types';
import { currentPhase, effectiveMuscleCredits, musclesOf, type Analysis, type ExStats } from './analysis';
import { app } from './firebase';
import { todayIso } from './seed';

let aiInstance: AI | undefined;
function getAiBackend(): AI {
  return (aiInstance ??= getAI(app, { backend: new GoogleAIBackend() }));
}

const MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];
export const AI_MODEL_TIMEOUT_MS = 90_000;

function logAiEvent(event: string, details: Record<string, unknown>): void {
  if (import.meta.env.DEV) console.warn(`[ai] ${event}`, details);
}

function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  modelName: string,
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Tiempo agotado al generar el informe con ${modelName}.`));
    }, timeoutMs);
    factory(controller.signal).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const avgOf = (vals: (number | undefined)[], dec = 1) => {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return undefined;
  const k = 10 ** dec;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * k) / k;
};

const roundDec = (val: number, dec = 1) => {
  const k = 10 ** dec;
  return Math.round(val * k) / k;
};

const toDayNum = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 864e5);

function summarizeWellbeingWindow(rows: DailyWellbeing[]) {
  const sleepH = avgOf(rows.map((w) => (w.sleepMin != null ? w.sleepMin / 60 : undefined)), 2);
  const sleepScore = avgOf(rows.map((w) => w.sleepScore), 0);
  const sleepEff = avgOf(rows.map((w) => w.sleepEff), 0);
  const steps = avgOf(rows.map((w) => w.steps), 0);
  const activeMin = avgOf(rows.map((w) => w.activeMin), 0);
  const rhr = avgOf(rows.map((w) => w.rhr), 0);
  const hrv = avgOf(rows.map((w) => w.hrv), 0);
  const energy = avgOf(rows.map((w) => w.energyScore), 0);

  return {
    dias: rows.length,
    ...(sleepH != null ? { sueno_horas_media: sleepH } : {}),
    ...(sleepScore != null ? { sueno_puntuacion_media: sleepScore } : {}),
    ...(sleepEff != null ? { sueno_eficiencia_media: sleepEff } : {}),
    ...(steps != null ? { pasos_media: steps } : {}),
    ...(activeMin != null ? { min_activos_media: activeMin } : {}),
    ...(rhr != null ? { fc_reposo_media: rhr } : {}),
    ...(hrv != null ? { hrv_media_ms: hrv } : {}),
    ...(energy != null ? { vitalidad_media: energy } : {}),
  };
}

/** Resume tendencias reales de composición corporal (7d vs 28d) para evitar sesgo por pesadas diarias. */
function buildBodySummary(ms: Measure[], since7: string, since28: string) {
  const sorted = [...ms].sort((a, b) => a.date.localeCompare(b.date));
  const lastOf = (key: 'weight' | 'bf' | 'muscle' | 'waist') => {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const v = sorted[i][key];
      if (typeof v === 'number' && Number.isFinite(v)) return { valor: v, fecha: sorted[i].date };
    }
    return undefined;
  };

  const weights28 = sorted.filter((m) => m.date >= since28 && m.weight != null);
  const recent7 = weights28.filter((m) => m.date >= since7);
  const prev21 = weights28.filter((m) => m.date < since7);

  const avgWeight7d = avgOf(recent7.map((m) => m.weight), 2);
  const avgWeightPrev = avgOf(prev21.map((m) => m.weight), 2);

  let weeklyRateKg: number | undefined;
  let weeklyRatePct: number | undefined;
  if (avgWeight7d != null && avgWeightPrev != null) {
    const meanDayRecent = avgOf(recent7.map((m) => toDayNum(m.date)), 2);
    const meanDayPrev = avgOf(prev21.map((m) => toDayNum(m.date)), 2);
    const diffDays = meanDayRecent != null && meanDayPrev != null ? meanDayRecent - meanDayPrev : 0;
    if (diffDays >= 5) {
      weeklyRateKg = roundDec(((avgWeight7d - avgWeightPrev) / diffDays) * 7, 2);
      if (avgWeightPrev > 0) weeklyRatePct = roundDec((weeklyRateKg / avgWeightPrev) * 100, 2);
    }
  }

  const lastWeight = lastOf('weight');
  const lastBf = lastOf('bf');
  const lastMuscle = lastOf('muscle');
  const waists = sorted.filter((m) => m.waist != null);
  const lastWaist = lastOf('waist');
  const prevWaist = waists.length >= 2 ? waists[waists.length - 2] : undefined;
  const waistDelta =
    lastWaist && prevWaist?.waist != null ? roundDec(lastWaist.valor - prevWaist.waist, 1) : undefined;

  return {
    total_registros: sorted.length,
    ...(lastWeight ? { ultimo_peso_kg: lastWeight } : {}),
    ...(avgWeight7d != null ? { peso_media_7d_kg: avgWeight7d } : {}),
    ...(avgWeightPrev != null ? { peso_media_prev_28d_kg: avgWeightPrev } : {}),
    ...(weeklyRateKg != null ? { ritmo_semanal_kg: weeklyRateKg } : {}),
    ...(weeklyRatePct != null ? { ritmo_semanal_pct: weeklyRatePct } : {}),
    ...(lastWaist ? { ultima_cintura_cm: lastWaist } : {}),
    ...(waistDelta != null && prevWaist
      ? { cambio_cintura_cm: waistDelta, cintura_previa_fecha: prevWaist.date }
      : {}),
    ...(lastBf ? { ultimo_grasa_pct: lastBf } : {}),
    ...(lastMuscle ? { ultimo_musculo_kg: lastMuscle } : {}),
  };
}

/** Calcula el volumen semanal medio de series efectivas por grupo muscular (primario = 1, secundario = 0,5). */
function buildWeeklyVolume(a: Analysis, s: Settings, since28: string) {
  const recentSessions = a.sessions.filter((x) => x.date >= since28);
  if (!recentSessions.length) return undefined;

  const firstDate = a.sessions[0]?.date;
  const daysActive = firstDate ? Math.max(7, toDayNum(todayIso()) - toDayNum(firstDate) + 1) : 28;
  const weeks = Math.min(4, Math.max(1, roundDec(daysActive / 7, 2)));

  const totals: Record<string, number> = {};
  for (const e of a.exercises.values()) {
    const map = musclesOf(e.name, s);
    if (!map?.p) continue;
    const validSets = e.sessions
      .filter((x) => x.date >= since28)
      .reduce((sum, x) => sum + x.sets.filter((st) => st.r > 0).length, 0);
    if (!validSets) continue;

    for (const [muscle, factor] of effectiveMuscleCredits(map)) {
      totals[muscle] = (totals[muscle] ?? 0) + validSets * factor;
    }
  }

  const perWeek: Record<string, number> = {};
  for (const [muscle, sets] of Object.entries(totals).sort((x, y) => y[1] - x[1])) {
    perWeek[muscle] = roundDec(sets / weeks, 1);
  }
  return Object.keys(perWeek).length
    ? { semanas_ventana: roundDec(weeks, 1), series_efectivas_semana: perWeek }
    : undefined;
}

function formatExerciseEntry(e: ExStats, day: string, s: Settings, since56: string, includeTarget: boolean) {
  const map = musclesOf(e.name, s);
  return {
    dia: day,
    ...(includeTarget && e.target ? { objetivo: `${e.target.sets}x${e.target.reps}` } : {}),
    ...(map?.p ? { musculo: map.p } : {}),
    estado_reglas: e.status,
    ...(e.avgHr ? { fc_media_historica: e.avgHr } : {}),
    ...(e.maxHr ? { fc_max_historica: e.maxHr } : {}),
    ...(s.notes[e.name] ? { nota_fija: s.notes[e.name] } : {}),
    sesiones: e.sessions
      .filter((x) => x.date >= since56)
      .map((x) => ({
        fecha: x.date,
        series: x.sets.map(
          (y) =>
            `${y.w}kg x${y.r}` +
            `${y.rir != null ? ` · RIR ${y.rir}` : ''}` +
            `${y.restSec != null ? ` · ${y.restSec}s` : ''}`,
        ),
        e1rm: x.e1rm,
        ...(x.avgHr ? { fc_media: x.avgHr } : {}),
        ...(x.maxHr ? { fc_max: x.maxHr } : {}),
        ...(x.durMin ? { dur_min: x.durMin } : {}),
        ...(x.kcal ? { kcal: x.kcal } : {}),
        ...(x.note ? { nota: x.note } : {}),
      })),
  };
}

/** Resumen compacto: 8 semanas por ejercicio (con RIR, descanso y pulso), volumen semanal, tendencias y recuperación. */
export function buildPayload(
  a: Analysis,
  ms: Measure[],
  s: Settings,
  cardio: CardioRow[] = [],
  wellbeing: DailyWellbeing[] = [],
) {
  const daysAgo = (n: number) => todayIso(new Date(Date.now() - n * 864e5));
  const since56 = daysAgo(56);
  const since28 = daysAgo(28);
  const since7 = daysAgo(7);

  const exercises: Record<string, unknown> = {};
  for (const d of Object.keys(a.byDay)) {
    for (const e of a.byDay[d] ?? []) {
      exercises[e.name] = formatExerciseEntry(e, d, s, since56, true);
    }
  }
  for (const e of a.exercises.values()) {
    if (exercises[e.name] || e.name.startsWith('Samsung #')) continue;
    if (!e.sessions.some((x) => x.date >= since56)) continue;
    exercises[e.name] = formatExerciseEntry(e, e.day ?? 'Libre', s, since56, false);
  }

  const cardio56 = cardio.filter((c) => c.date >= since56);
  const cardioAvgHr = avgOf(cardio56.map((c) => c.avgHr || undefined), 0);
  const lastVo2 = [...cardio].reverse().find((c) => c.vo2 && c.vo2 > 0)?.vo2;
  const wellSorted = [...wellbeing].sort((x, y) => x.date.localeCompare(y.date));
  const weeklyVolume = buildWeeklyVolume(a, s, since28);

  return {
    fase: currentPhase(s)?.name ?? 'sin definir',
    perfil: s.profile,
    resumen_composicion: buildBodySummary(ms, since7, since28),
    medidas_recientes: ms.slice(-5),
    ...(weeklyVolume ? { volumen_semanal: weeklyVolume } : {}),
    ejercicios: exercises,
    sesiones_fuerza_recientes: a.sessions.slice(-15).map((x) => ({
      fecha: x.date,
      rutina: x.day ?? 'Otro',
      series: x.sets,
      ...(x.durMin ? { dur_min: x.durMin } : {}),
      ...(x.avgHr ? { fc_media: x.avgHr } : {}),
      ...(x.maxHr ? { fc_max: x.maxHr } : {}),
      ...(x.kcal ? { kcal: x.kcal } : {}),
    })),
    cardio_reciente: {
      resumen_8_sem: {
        sesiones: cardio56.length,
        km_totales: roundDec(cardio56.reduce((sum, c) => sum + c.distKm, 0), 1),
        min_totales: Math.round(cardio56.reduce((sum, c) => sum + c.durMin, 0)),
        ...(cardioAvgHr != null ? { fc_media: cardioAvgHr } : {}),
        ...(lastVo2 ? { vo2_max_reciente: lastVo2 } : {}),
      },
      ultimas_sesiones: cardio.slice(-12).map((c) => ({
        fecha: c.date,
        dur_min: c.durMin,
        dist_km: c.distKm,
        fc_media: c.avgHr,
        kcal: c.kcal,
        ...(c.vo2 ? { vo2: c.vo2 } : {}),
      })),
    },
    recuperacion_y_actividad: {
      ultimos_7_dias: summarizeWellbeingWindow(wellSorted.filter((w) => w.date >= since7)),
      ultimos_28_dias: summarizeWellbeingWindow(wellSorted.filter((w) => w.date >= since28)),
      detalle_ultimos_14_dias: wellSorted.slice(-14).map((w) => ({
        fecha: w.date,
        ...(w.sleepMin ? { sueno_h: roundDec(w.sleepMin / 60, 1) } : {}),
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
      'Eres un entrenador personal cercano y riguroso que traduce la ciencia del entrenamiento a lenguaje cotidiano, sin jerga ni siglas técnicas (evita HRV, NEAT, e1RM, RIR o SNC). ' +
      'Aplica criterios sólidos al analizar los datos: prioriza la tendencia semanal de peso y la cintura por encima de cambios diarios o fluctuaciones de báscula; valora mantener la fuerza durante una pérdida de peso como señal de que se conserva el músculo; y recuerda que para progresar basta con sumar repeticiones controladas antes de subir kilos. ' +
      'No menciones descansos entre series salvo que aparezcan registrados en segundos en los datos. Ten en cuenta que saltos bruscos de peso en máquinas pueden deberse a cambiar de máquina o sistema de poleas. Omite cualquier dato que venga vacío sin mencionarlo.',
    titles: [
      'Peso y forma física',
      'Progreso en fuerza',
      'Descanso, pasos y energía',
      'Plan para las próximas semanas',
    ],
    sectionHints: [
      'Resume en lenguaje llano si la tendencia de peso y la cintura avanzan a buen ritmo para el objetivo actual junto a la actividad diaria (pasos y cardio), ignorando oscilaciones puntuales de un solo día.',
      'Explica de forma directa en qué ejercicios estás ganando fuerza (kilos o repeticiones) y en cuáles toca consolidar, teniendo en cuenta si estás comiendo menos para perder grasa o en fase de ganancia.',
      'Comenta si las horas de sueño y el descanso general acompañan el ritmo de entrenamiento, sin repetir análisis de peso ni ejercicios concretos.',
      'Propón 2-3 ajustes concretos y fáciles de aplicar la semana que viene (pausas entre series, pasos diarios, sueño o ajuste suave de esfuerzo).',
    ],
    exerciseHint: {
      status: "Etiqueta clara de 2-3 palabras (ej: 'Subiendo bien', 'Récord personal', 'Consolidar peso', 'Falta descanso')",
      prescription:
        'Consejo práctico y concreto para el próximo entreno: peso en kg, repeticiones objetivo y descanso orientativo (más largo en ejercicios exigentes).',
      biomech: '1-2 frases sencillas sobre control técnico, recorrido o ritmo de las series para estimular mejor el músculo.',
    },
    closing:
      'Escribe en español cercano, directo y sin frases vacías ni halagos genéricos. Respalda cada idea con datos reales del JSON y nunca inventes cifras. Optimizado para móvil: máximo 2-3 frases por sección y 1 frase corta (<14 palabras) por highlight.',
  },
  technical: {
    intro:
      'Eres un preparador de fuerza e hipertrofia basado en evidencia científica actual. Analiza de forma integrada todos los datos del JSON aplicando estas reglas de criterio: ' +
      '1) Composición corporal: prioriza resumen_composicion (tendencia 7d vs 28d, ritmo semanal y cintura) sobre lecturas aisladas de bioimpedancia (% graso/músculo fluctúan por agua y glucógeno); evalúa el ritmo frente a rangos óptimos (~0,5-1% peso/sem en déficit; ~0,25-0,5%/sem en ganancia limpia) y la posible compensación de NEAT. ' +
      '2) Hipertrofia y carga: juzga el rendimiento según la fase energética (en déficit, sostener cargas/e1RM indica buena retención de masa magra, no meseta negativa); aplica doble progresión (completar rango de reps con RIR 0-3 antes de subir carga), evalúa volumen_semanal efectivo y usa descansos por demanda del ejercicio (2-4 min en compuestos, 1,5-2,5 min en analíticos), usando la FC de fuerza solo como dato contextual de fatiga/densidad y nunca como medida de estímulo muscular. ' +
      '3) Fatiga y descarga: sugiere deload solo ante caída o estancamiento simultáneo en varios ejercicios durante 2+ semanas junto a deterioro de sueño/HRV/FC reposo. ' +
      '4) Rigor de datos: comenta descansos entre series solo si existen tiempos en segundos ("...s") en el JSON; interpreta saltos atípicos en máquinas como cambio de poleas/placas y omite cualquier métrica ausente sin malgastar texto disculpándote.',
    titles: [
      'Composición Corporal y Balance Energético',
      'Rendimiento, Volumen y Sobrecarga Progresiva',
      'Recuperación, Sueño y Fatiga Sistémica',
      'Estrategia para el Próximo Mesociclo',
    ],
    sectionHints: [
      'Evalúa la tendencia de peso, cintura y composición frente a la fase activa y el ritmo semanal óptimo, cruzándolo con pasos/NEAT y cardio. No repitas métricas de sueño ni pulso.',
      'Identifica progresiones reales (carga o e1RM), mesetas verdaderas (descartando el contexto de déficit) y desequilibrios en volumen_semanal entre grupos musculares citando ejercicios y cifras exactas.',
      'Analiza sueño, HRV nocturna, FC en reposo y densidad/pulso en sesión para valorar la recuperación y la fatiga acumulada. No repitas peso corporal ni prescripciones individuales.',
      'Define 2-3 ajustes medibles para las próximas 2-4 semanas: ajuste calórico o de pasos, redistribución de series/descansos en grupos rezagados y decisión fundamentada de progresar o realizar descarga.',
    ],
    exerciseHint: {
      status: "Etiqueta de máx. 3-4 palabras para móvil (ej: 'Progresando (+2,5 kg)', 'Retención en déficit', 'Meseta en reps', 'Récord e1RM')",
      prescription:
        'Orden táctica exacta para la próxima sesión: carga en kg, series×reps aplicando doble progresión, RIR orientativo y descanso óptimo según tipo de ejercicio.',
      biomech:
        '1-2 frases técnicas sobre estímulo mecánico, factor limitante probable (estabilidad, RIR o fatiga acumulada) y ajuste práctico de ejecución.',
    },
    closing:
      'Escribe en español con rigor científico y tono directo de preparador: cero relleno ni halagos vacíos. Cada afirmación debe apoyarse en cifras reales del JSON y nunca inventes datos. Optimizado para móvil: máximo 2-3 frases densas por sección y 1 frase corta (<14 palabras) por highlight.',
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
    '  "summary": "Resumen ejecutivo directo de 2 frases integrando fuerza, composición corporal y recuperación.",\n' +
    '  "overview": {\n' +
    '    "overallStatus": "Frase corta de estado global (máx. 12 palabras)",\n' +
    '    "highlights": [\n' +
    '      "Dato concreto 1 sobre tu progresión o retención de fuerza",\n' +
    '      "Dato concreto 2 sobre tendencia corporal, cintura o actividad diaria",\n' +
    '      "Dato concreto 3 sobre descanso, sueño o ajuste prioritario"\n' +
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

function parseAndValidateAiResponse(raw: string, tone: AiTone): AiResult {
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(clean) as Record<string, unknown>;
  const overview = parsed?.overview as Record<string, unknown> | undefined;
  const rawSections = Array.isArray(overview?.sections) ? overview.sections : [];

  if (typeof parsed?.summary !== 'string' || !parsed.summary.trim() || !rawSections.length) {
    throw new Error('Respuesta JSON de IA incompleta o con estructura inválida.');
  }

  const sections = rawSections
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((s) => ({
      title: typeof s.title === 'string' ? s.title : 'Análisis',
      verdict: (s.verdict === 'good' || s.verdict === 'warning' ? s.verdict : 'neutral') as
        | 'good'
        | 'warning'
        | 'neutral',
      text: typeof s.text === 'string' ? s.text : '',
    }))
    .filter((s) => s.text.length > 0);

  if (!sections.length) {
    throw new Error('La respuesta de IA no contiene secciones con texto válido.');
  }

  const highlights = Array.isArray(overview?.highlights)
    ? overview.highlights.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    : [];

  const byExercise: AiResult['byExercise'] = {};
  if (parsed.byExercise && typeof parsed.byExercise === 'object' && !Array.isArray(parsed.byExercise)) {
    for (const [name, entry] of Object.entries(parsed.byExercise as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const rec = entry as Record<string, unknown>;
      const status = typeof rec.status === 'string' ? rec.status.trim() : '';
      const prescription = typeof rec.prescription === 'string' ? rec.prescription.trim() : '';
      if (!status || !prescription) continue;
      const biomech = typeof rec.biomech === 'string' ? rec.biomech.trim() : '';
      byExercise[name] = { status, prescription, ...(biomech ? { biomech } : {}) };
    }
  }

  return {
    date: todayIso(),
    tone,
    summary: parsed.summary.trim(),
    overview: {
      overallStatus: typeof overview?.overallStatus === 'string' ? overview.overallStatus.trim() : '',
      highlights,
      sections,
    },
    byExercise,
  };
}

export async function generateAnalysisFromPayload(payload: Record<string, unknown>, tone: AiTone): Promise<AiResult> {
  const prompt = buildPrompt(payload, tone);
  const ai = getAiBackend();
  const errors: string[] = [];

  for (const modelName of MODELS) {
    const startedAt = Date.now();
    try {
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });
      const res = await withTimeout(
        (signal) => model.generateContent(prompt, { signal, timeout: AI_MODEL_TIMEOUT_MS }),
        AI_MODEL_TIMEOUT_MS,
        modelName,
      );
      const result = parseAndValidateAiResponse(res.response.text(), tone);
      logAiEvent('completed', { model: modelName, durationMs: Date.now() - startedAt });
      return result;
    } catch (err) {
      logAiEvent('attempt-failed', {
        model: modelName,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
      });
      if (err instanceof AIError) {
        if (err.code === 'api-not-enabled') {
          throw new Error('El servicio de Coach IA no está disponible en este momento. Inténtalo más tarde.');
        }
        errors.push(`${modelName} (${err.code}): ${err.message.slice(0, 150)}`);
      } else {
        errors.push(`${modelName}: ${(err as Error).message}`);
      }
    }
  }

  logAiEvent('all-models-failed', { errors });
  throw new Error('No se pudo generar el análisis en este momento. Comprueba tu conexión e inténtalo de nuevo.');
}
