function resolveNavIndex(key: string, idx: number, length: number, vertical: boolean): number | null {
  const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
  const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
  if (key === nextKey) return (idx + 1) % length;
  if (key === prevKey) return (idx - 1 + length) % length;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return null;
}

function handleTabNav(root: HTMLElement, e: KeyboardEvent, target: HTMLElement | null): boolean {
  const tab = target?.closest<HTMLElement>('[role="tab"]');
  const tablist = tab?.closest<HTMLElement>('[role="tablist"]');
  if (!tab || !tablist) return false;
  const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')];
  const idx = tabs.indexOf(tab);
  if (idx === -1 || tabs.length === 0) return false;
  const nextIdx = resolveNavIndex(e.key, idx, tabs.length, false);
  if (nextIdx === null) return false;
  const nextTab = tabs[nextIdx];
  if (!nextTab) return false;
  e.preventDefault();
  nextTab.click();
  const lbl = tablist.getAttribute('aria-label');
  const listSel = lbl ? `[role="tablist"][aria-label="${CSS.escape(lbl)}"]` : '[role="tablist"]';
  const freshList = root.querySelector<HTMLElement>(listSel);
  const byId = nextTab.id ? freshList?.querySelector<HTMLElement>(`#${CSS.escape(nextTab.id)}`) : undefined;
  const freshTab = (nextTab.isConnected ? nextTab : undefined)
    ?? byId
    ?? freshList?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIdx];
  freshTab?.focus({ preventScroll: true });
  return true;
}

function handleListboxNav(root: HTMLElement, e: KeyboardEvent, target: HTMLElement | null): boolean {
  const listbox = target?.closest<HTMLElement>('[role="listbox"]');
  if (!listbox) return false;
  const options = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')];
  if (!options.length) return false;
  const opt = target?.closest<HTMLElement>('[role="listbox"] [role="option"]')
    ?? listbox.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
    ?? options[0];
  const idx = options.indexOf(opt);
  if (idx === -1) return false;
  const nextIdx = resolveNavIndex(e.key, idx, options.length, true);
  if (nextIdx === null) return false;
  const nextOpt = options[nextIdx];
  if (!nextOpt) return false;
  e.preventDefault();
  nextOpt.focus({ preventScroll: true });
  nextOpt.click();
  const lbl = listbox.getAttribute('aria-label');
  const listSel = lbl ? `[role="listbox"][aria-label="${CSS.escape(lbl)}"]` : '[role="listbox"]';
  const freshListbox = root.querySelector<HTMLElement>(listSel);
  const byId = nextOpt.id ? freshListbox?.querySelector<HTMLElement>(`#${CSS.escape(nextOpt.id)}`) : undefined;
  const freshOpt = (nextOpt.isConnected ? nextOpt : undefined)
    ?? byId
    ?? freshListbox?.querySelectorAll<HTMLElement>('[role="option"]')[nextIdx];
  freshOpt?.focus({ preventScroll: true });
  freshOpt?.scrollIntoView({ block: 'nearest' });
  return true;
}

function handleRadioGroupNav(e: KeyboardEvent, target: HTMLElement | null): boolean {
  const radio = target?.closest<HTMLElement>('[role="radio"]');
  const group = radio?.closest<HTMLElement>('[role="radiogroup"]');
  if (!radio || !group) return false;
  const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
  const idx = radios.indexOf(radio);
  if (idx === -1 || !radios.length) return false;
  const key = e.key === 'ArrowDown' ? 'ArrowRight' : e.key === 'ArrowUp' ? 'ArrowLeft' : e.key;
  const nextIdx = resolveNavIndex(key, idx, radios.length, false);
  if (nextIdx === null) return false;
  const nextRadio = radios[nextIdx];
  if (!nextRadio) return false;
  e.preventDefault();
  nextRadio.click();
  nextRadio.focus({ preventScroll: true });
  return true;
}

/**
 * Registra navegación accesible por teclado (`Arrow*`, `Home`, `End`) para pestañas y listboxes ARIA.
 *
 * @param root - Elemento raíz donde se monta la aplicación.
 */
export function initKeyboardNav(root: HTMLElement): void {
  root.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    if (handleTabNav(root, e, target)) return;
    if (handleRadioGroupNav(e, target)) return;
    handleListboxNav(root, e, target);
  });
}
