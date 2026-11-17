export interface SelectionOption {
  id: string;
  label: string;
  subtitle?: string;
  group?: string;
  aliases?: string[];
  lastUsedAt?: number;
  disabled?: boolean;
}

export function normalizeSelectionText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function optionSearchText(option: SelectionOption): string {
  return normalizeSelectionText([option.label, option.subtitle, ...(option.aliases ?? [])].filter(Boolean).join(' '));
}

export function filterSelectionOptions(options: SelectionOption[], query: string): SelectionOption[] {
  const normalizedQuery = normalizeSelectionText(query);
  if (!normalizedQuery) return [...options];
  return options.filter((option) => optionSearchText(option).includes(normalizedQuery));
}

export function sortRecentSelectionOptions(options: SelectionOption[], limit?: number): SelectionOption[] {
  const sorted = [...options].sort((a, b) => {
    const recentDiff = (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
    return recentDiff || a.label.localeCompare(b.label, 'es');
  });
  return limit == null ? sorted : sorted.slice(0, Math.max(0, limit));
}

export function groupSelectionOptions(options: SelectionOption[]): Map<string, SelectionOption[]> {
  const groups = new Map<string, SelectionOption[]>();
  for (const option of options) {
    const key = option.group?.trim() || '';
    const list = groups.get(key) ?? [];
    list.push(option);
    groups.set(key, list);
  }
  return groups;
}
