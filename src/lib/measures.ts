import Papa from 'papaparse';
import type { Measure } from '../types';

const nk = (h: string) => h.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');

function fieldFor(h: string): keyof Measure | null {
  const k = nk(h);
  const table: [string, keyof Measure][] = [
    ['brazoizq', 'armL'], ['brazoder', 'armR'], ['torso', 'torso'], ['cintura', 'waist'],
    ['musloizq', 'thighL'], ['musloder', 'thighR'],
    ['sobrelarodillaizq', 'kneeL'], ['sobrelarodillader', 'kneeR'],
    ['gemeloizq', 'calfL'], ['gemeloder', 'calfR'], ['hombros', 'shoulders'],
    ['grasa', 'bf'], ['peso', 'weight'], ['masamuscular', 'muscle'],
  ];
  for (const [p, f] of table) if (k.startsWith(p)) return f;
  if (k.startsWith('gl')) return 'glute';
  return null;
}

const num = (v: string | undefined): number | undefined => {
  if (v == null) return undefined;
  const s = v.trim().replace('%', '').replace(',', '.');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** d/m/yyyy -> yyyy-mm-dd */
export function parseEsDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export interface MeasuresImport { measures: Measure[]; profile: Partial<{ sex: string; age: number; height: number }> }

export function parseMeasuresCsv(text: string): MeasuresImport {
  const { data } = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: true });
  const header = data[0] ?? [];
  const cols = header.map(fieldFor);
  const dateCol = header.findIndex((h) => nk(h) === 'fecha');
  const noteCol = header.findIndex((h) => nk(h).startsWith('columna'));
  const profile: MeasuresImport['profile'] = {};
  // El perfil vive en las dos últimas columnas: (etiqueta, valor).
  const labelCol = header.findIndex((h) => nk(h).startsWith('sexo'));
  const readProfile = (label: string, value: string) => {
    const l = nk(label);
    if (l.startsWith('sexo')) profile.sex = value;
    else if (l.startsWith('edad')) profile.age = Number(value);
    else if (l.startsWith('altura')) profile.height = Number(value);
  };
  if (labelCol >= 0) readProfile(header[labelCol], header[labelCol + 1] ?? '');

  const measures: Measure[] = [];
  for (const row of data.slice(1)) {
    if (labelCol >= 0 && row[labelCol] && !/^\d/.test(row[labelCol] ?? '') && row[labelCol + 1]) readProfile(row[labelCol], row[labelCol + 1]);
    const date = parseEsDate(row[dateCol] ?? '');
    if (!date) continue;
    const m: Measure = { date };
    cols.forEach((f, i) => {
      if (!f || f === 'note' || f === 'date') return;
      const v = num(row[i]);
      if (v != null) (m as unknown as Record<string, number>)[f] = v;
    });
    const note = noteCol >= 0 ? (row[noteCol] ?? '').trim() : '';
    if (note) m.note = note.replace(/^#\s*/, '');
    measures.push(m);
  }
  return { measures, profile };
}
