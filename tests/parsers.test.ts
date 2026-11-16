import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseExerciseCsv, parseCustomExerciseCsv, parseSleepCsv, parseStepsCsv, parseVitalityCsv } from '../src/lib/samsung';
import { parseMeasuresCsv } from '../src/lib/measures';
import { analyze } from '../src/lib/analysis';
import { buildPayload } from '../src/lib/ai';
import { DEFAULT_SETTINGS } from '../src/lib/seed';
import type { CardioRow, DailyWellbeing, StrengthRow } from '../src/types';

const EX = 'C:/Users/Victor/Downloads/com.samsung.shealth.exercise.20261111152201.csv';
const CE = 'C:/Users/Victor/Desktop/samsunghealth_victorblascogar_20261111152201/com.samsung.shealth.exercise.custom_exercise.20261111152201.csv';
const ME = 'C:/Users/Victor/Downloads/Medidas 11-11-2026.csv';
const have = existsSync(EX) && existsSync(CE) && existsSync(ME);

describe('parseo de CSV de medidas y cruce de ejercicios Samsung', () => {
  it('parsea medidas', () => {
    const meCsv = have
      ? readFileSync(ME, 'utf8')
      : [
          'Fecha,Peso (kg),% Grasa (%),Cintura (cm),Columna 1,Sexo,Hombre',
          '10/11/2026,71.0,15.2,82.0,inicio,Edad,25',
          '11/11/2026,70.4,14.8,81.5,defi,Altura,167',
        ].join('\n');
    const r = parseMeasuresCsv(meCsv);
    expect(r.measures.length).toBe(have ? 14 : 2);
    const last = r.measures[r.measures.length - 1];
    expect(last.date).toBe('2026-11-11');
    expect(last.weight).toBe(70.4);
    expect(last.bf).toBe(14.8);
    expect(last.waist).toBe(81.5);
    expect(r.profile.height).toBe(167);
    expect(r.measures.some((m) => /defi/.test(m.note ?? ''))).toBe(true);
  });
  it('parsea ejercicios y cruza nombres', () => {
    const ceCsv = have
      ? readFileSync(CE, 'utf8')
      : [
          'com.samsung.shealth.exercise.custom_exercise,1,3',
          'custom_type,custom_id,custom_name',
          '0,m7i86bn9_2u6,Curl de bíceps Martillo',
        ].join('\n');
    const exCsv = have
      ? readFileSync(EX, 'utf8')
      : [
          'com.samsung.shealth.exercise,7013005,12',
          'com.samsung.health.exercise.datauuid,com.samsung.health.exercise.start_time,com.samsung.health.exercise.time_offset,com.samsung.health.exercise.exercise_type,com.samsung.health.exercise.duration,com.samsung.health.exercise.distance,com.samsung.health.exercise.mean_heart_rate,com.samsung.health.exercise.calorie,routine_datauuid,custom_id,subset_data',
          'ex-jal-1,2026-11-09 17:00:00.000,UTC+0100,10018,600000,0,120,80,r1,,"[{""reps"":8,""weight"":90},{""reps"":8,""weight"":90}]"',
          'ex-mart-1,2026-11-09 17:20:00.000,UTC+0100,0,480000,0,115,60,r1,m7i86bn9_2u6,"[{""reps"":11,""weight"":16},{""reps"":10,""weight"":16},{""reps"":9,""weight"":16}]"',
          'ex-card-1,2026-11-09 18:00:00.000,UTC+0100,1001,1200000,3200,145,210,,,""',
        ].join('\n');

    const names = parseCustomExerciseCsv(ceCsv);
    expect(names['m7i86bn9_2u6']).toBe('Curl de bíceps Martillo');
    const { strength, cardio } = parseExerciseCsv(exCsv);
    expect(strength.length).toBeGreaterThan(have ? 1500 : 1);
    expect(cardio.length).toBeGreaterThan(have ? 50 : 0);
    const s = { ...structuredClone(DEFAULT_SETTINGS), customNames: names };
    const a = analyze(strength, s);
    const jal = a.exercises.get('Jalones al pecho')!;
    expect(jal.last!.date).toBe('2026-11-09');
    expect(jal.last!.top).toBe(90);
    const mart = a.exercises.get('Curl de bíceps Martillo')!;
    expect(mart.last!.sets.map((x) => x.r)).toEqual([11, 10, 9]);
  });
});

describe('sesiones manuales', () => {
  it('integra filas manuales con historial, notas y ejercicios extra por día', () => {
    const s = structuredClone(DEFAULT_SETTINGS);
    const rows: StrengthRow[] = [
      {
        id: 'samsung-1',
        sessionId: 'sess-1',
        ts: Date.parse('2026-11-01T12:00:00Z'),
        date: '2026-11-01',
        ref: 'type:10018', // Jalones al pecho
        sets: [{ w: 85, r: 9 }, { w: 85, r: 8 }],
      },
      {
        id: 'manual-2026-11-13-jalones-al-pecho',
        sessionId: 'manual-2026-11-13',
        ts: Date.parse('2026-11-13T12:00:00Z'),
        date: '2026-11-13',
        ref: 'name:Jalones al pecho',
        sets: [{ w: 90, r: 10 }, { w: 90, r: 10 }],
        note: 'RIR 1, buena retracción escapular',
        day: 'Pull',
      },
      {
        id: 'manual-2026-11-13-face-pull',
        sessionId: 'manual-2026-11-13',
        ts: Date.parse('2026-11-13T12:00:00Z'),
        date: '2026-11-13',
        ref: 'name:Face Pull',
        sets: [{ w: 25, r: 15 }, { w: 25, r: 14 }],
        note: 'Pausa 1s atrás',
        day: 'Pull',
      },
    ];

    const a = analyze(rows, s);
    expect(a.unmapped).toEqual([]);

    const jal = a.exercises.get('Jalones al pecho')!;
    expect(jal.n).toBe(2);
    expect(jal.last!.date).toBe('2026-11-13');
    expect(jal.last!.note).toBe('RIR 1, buena retracción escapular');

    const fp = a.exercises.get('Face Pull')!;
    expect(fp.last!.note).toBe('Pausa 1s atrás');
    expect(a.byDay.Pull.some((e) => e.name === 'Face Pull')).toBe(true);

    const lastSess = a.sessions[a.sessions.length - 1];
    expect(lastSess.day).toBe('Pull');
    expect(lastSess.exercises).toContain('Face Pull');
  });
});

describe('frecuencia cardiaca, sueño, pasos, vitalidad e IA', () => {
  it('extrae pulso, duración y kcal de fuerza y parsea sueño, pasos y vitalidad con deduplicación', () => {
    const exCsv = [
      'com.samsung.shealth.exercise,7013005,18',
      'com.samsung.health.exercise.datauuid,com.samsung.health.exercise.start_time,com.samsung.health.exercise.time_offset,com.samsung.health.exercise.exercise_type,com.samsung.health.exercise.duration,com.samsung.health.exercise.mean_heart_rate,com.samsung.health.exercise.max_heart_rate,com.samsung.health.exercise.min_heart_rate,com.samsung.health.exercise.calorie,routine_datauuid,custom_id,subset_data',
      'ex-1,2026-11-10 17:00:00.000,UTC+0100,10001,600000,128.4,149.0,102.0,95.6,rout-1,,"[{""reps"":10,""weight"":80},{""reps"":9,""weight"":80}]"',
    ].join('\n');

    const { strength } = parseExerciseCsv(exCsv);
    expect(strength).toHaveLength(1);
    expect(strength[0]).toMatchObject({ durMin: 10, avgHr: 128, maxHr: 149, minHr: 102, kcal: 96 });

    const sleepCsv = [
      'com.samsung.shealth.sleep,7013005,12',
      'com.samsung.health.sleep.start_time,com.samsung.health.sleep.end_time,com.samsung.health.sleep.time_offset,sleep_duration,sleep_score,efficiency,total_rem_duration,factor_01,physical_recovery,mental_recovery',
      '2026-11-10 15:00:00.000,2026-11-10 15:30:00.000,UTC+0100,30,40,80,5,0,50,50',
      '2026-11-10 00:30:00.000,2026-11-10 08:30:00.000,UTC+0100,462,90,95,104,38,93,93',
    ].join('\n');
    const sleepMap = parseSleepCsv(sleepCsv);
    expect(sleepMap.get('2026-11-10')).toMatchObject({
      date: '2026-11-10', sleepMin: 462, sleepScore: 90, sleepEff: 95, remMin: 104, deepMin: 38, physRec: 93, mentalRec: 93,
    });

    const stepsCsv = [
      'com.samsung.shealth.tracker.pedometer_day_summary,7013005,8',
      'day_time,step_count,distance,active_time,calorie',
      '2026-11-10 00:00:00.000,4800,3723.0,2952000,211.1',
      '2026-11-10 00:00:00.000,9117,7338.0,5315914,388.6',
    ].join('\n');
    const stepsMap = parseStepsCsv(stepsCsv);
    expect(stepsMap.get('2026-11-10')).toMatchObject({ date: '2026-11-10', steps: 9117, stepKm: 7.3, activeMin: 89, stepKcal: 389 });

    const vitCsv = [
      'com.samsung.shealth.vitality_score,7013005,4',
      'day_time,total_score,shr_value,shrv_value',
      '2026-11-10 00:00:00.000,87.3,55.0,100.0',
    ].join('\n');
    const vitMap = parseVitalityCsv(vitCsv);
    expect(vitMap.get('2026-11-10')).toMatchObject({ date: '2026-11-10', energyScore: 87, rhr: 55, hrv: 100 });

    const s = structuredClone(DEFAULT_SETTINGS);
    const today = new Date().toISOString().slice(0, 10);
    const rows: StrengthRow[] = [{
      id: 'ex-1', sessionId: 'rout-1', ts: Date.now(), date: today,
      ref: 'name:Jalones al pecho', sets: [{ w: 80, r: 10 }], avgHr: 128, maxHr: 149, durMin: 10, kcal: 96, day: 'Pull',
    }];
    const cardio: CardioRow[] = [{ id: 'c-1', ts: Date.now(), date: today, type: 1001, durMin: 25, distKm: 4.2, avgHr: 145, kcal: 240, vo2: 48 }];
    const wellbeing: DailyWellbeing[] = [{ ...sleepMap.get('2026-11-10')!, ...stepsMap.get('2026-11-10')!, ...vitMap.get('2026-11-10')!, date: today }];
    const a = analyze(rows, s);
    const payload = buildPayload(a, [], s, cardio, wellbeing);

    expect((payload.ejercicios as Record<string, { fc_media_historica?: number }>)['Jalones al pecho'].fc_media_historica).toBe(128);
    expect(payload.sesiones_fuerza_recientes[0]).toMatchObject({ fc_media: 128, fc_max: 149, dur_min: 10, kcal: 96 });
    expect(payload.cardio_reciente.resumen_8_sem).toMatchObject({ sesiones: 1, km_totales: 4.2, vo2_max_reciente: 48 });
    expect(payload.recuperacion_y_actividad.ultimos_7_dias).toMatchObject({ pasos_media: 9117, fc_reposo_media: 55, hrv_media_ms: 100 });
  });
});
