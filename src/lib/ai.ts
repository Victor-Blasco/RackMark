import type { AiResult, Measure, Settings } from '../types';
import type { Analysis } from './analysis';
import { currentPhase } from './analysis';

const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

/** Resumen compacto: últimas 8 semanas por ejercicio, últimas 3 medidas y fase actual. */
export function buildPayload(a: Analysis, ms: Measure[], s: Settings) {
  const since = new Date(Date.now() - 56 * 864e5).toISOString().slice(0, 10);
  const exercises: Record<string, unknown> = {};
  for (const d of ['Push', 'Pull', 'Leg'] as const) {
    for (const e of a.byDay[d]) {
      exercises[e.name] = {
        dia: d, objetivo: e.target ? `${e.target.sets}x${e.target.reps}` : undefined,
        estado_reglas: e.status,
        ...(s.notes[e.name] ? { nota_fija: s.notes[e.name] } : {}),
        sesiones: e.sessions.filter((x) => x.date >= since).map((x) => ({
          fecha: x.date, series: x.sets.map((y) => `${y.w}kg x${y.r}`), e1rm: x.e1rm,
          ...(x.note ? { nota: x.note } : {}),
        })),
      };
    }
  }
  return {
    fase: currentPhase(s)?.name ?? 'sin definir',
    perfil: s.profile,
    medidas_recientes: ms.slice(-3),
    ejercicios: exercises,
  };
}

export async function generateAnalysis(a: Analysis, ms: Measure[], s: Settings): Promise<AiResult> {
  if (!s.geminiKey) throw new Error('Falta la clave de Gemini (Ajustes).');
  const payload = buildPayload(a, ms, s);
  const prompt =
    'Eres un fisiólogo y entrenador de fuerza e hipertrofia de élite basado en la máxima evidencia científica. ' +
    'Analiza la evolución completa del usuario (antropometría, rendimiento en las sesiones de fuerza PPL y consistencia). ' +
    'Ten en cuenta que si hay saltos anómalos de peso en algún ejercicio puede deberse a cambios de máquina, poleas o placas vs kg; interprétalo con criterio técnico.\n\n' +
    'Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:\n' +
    '{\n' +
    '  "summary": "Resumen ejecutivo directo de 2-3 frases destacando lo más importante.",\n' +
    '  "overview": {\n' +
    '    "overallStatus": "Frase corta de estado global (ej: \'Fase de definición exitosa con retención magra óptima\')",\n' +
    '    "highlights": [\n' +
    '      "Punto fuerte 1 sobre tu progresión en cargas o récord",\n' +
    '      "Punto clave sobre tu composición corporal (peso, grasa, perímetros)",\n' +
    '      "Aspecto técnico o fatiga a vigilar"\n' +
    '    ],\n' +
    '    "sections": [\n' +
    '      {\n' +
    '        "title": "Composición Corporal y Antropometría",\n' +
    '        "verdict": "good" | "warning" | "neutral",\n' +
    '        "text": "Análisis de peso, % graso, masa muscular y evolución de perímetros clave (cintura vs extremidades)."\n' +
    '      },\n' +
    '      {\n' +
    '        "title": "Rendimiento y Sobrecarga Progresiva PPL",\n' +
    '        "verdict": "good" | "warning" | "neutral",\n' +
    '        "text": "Análisis de ganancias de fuerza, patrones donde destacas y ejercicios donde hay meseta o fatiga acumulada."\n' +
    '      },\n' +
    '      {\n' +
    '        "title": "Estrategia para el Próximo Mesociclo",\n' +
    '        "verdict": "good" | "warning" | "neutral",\n' +
    '        "text": "Recomendaciones claras de nutrición, ajustes de volumen y gestión de descansos entre series."\n' +
    '      }\n' +
    '    ]\n' +
    '  },\n' +
    '  "byExercise": {\n' +
    '    "<nombre exacto del ejercicio>": {\n' +
    '      "status": "Estado corto (ej: \'Progresando (+2.5kg)\', \'Récord Personal\', \'Descanso Insuficiente\')",\n' +
    '      "prescription": "Acción táctica exacta para la próxima sesión (reps, peso, pausa)",\n' +
    '      "biomech": "1-2 frases de análisis biomecánico y estímulo muscular"\n' +
    '    }\n' +
    '  }\n' +
    '}\n\n' +
    'Escribe en español con tono profesional, motivador y fundamentado en ciencia deportiva.\n\nDATOS DEL USUARIO:\n' + JSON.stringify(payload);

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
