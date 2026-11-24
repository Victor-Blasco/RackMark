/**
 * Utilidad de reordenamiento por arrastre (Pointer Events + animación FLIP)
 * compatible con pantallas táctiles (móvil) y ratón (escritorio).
 */

/** Mueve un elemento dentro de un array si ambos índices son válidos y distintos. */
export function moveItem<T>(arr: T[], from: number, to: number): boolean {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return false;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  return true;
}

const FLIP_TRANSITION = 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)';
const DRAG_ACTIVE_CLASSES = ['relative', 'z-30', 'shadow-2xl', 'ring-2', 'ring-electricBlue/80', 'is-dragging'];
const FLIP_HIGHLIGHT_CLASSES = ['relative', 'z-20', 'ring-1', 'ring-electricBlue/60', 'rounded-xl'];

function getSortItems(list: HTMLElement): HTMLElement[] {
  return Array.from(list.children).filter(
    (el): el is HTMLElement => typeof (el as HTMLElement).hasAttribute === 'function' && (el as HTMLElement).hasAttribute('data-sort-item'),
  );
}

const isReducedMotion = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Aplica desplazamiento invertido FLIP a los pares `[elemento, rectOriginal]` que han cambiado de posición. */
function invertFlipMoves(entries: ReadonlyArray<readonly [HTMLElement, DOMRect]>): HTMLElement[] {
  const animated: HTMLElement[] = [];
  for (const [el, first] of entries) {
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    el.style.transition = 'none';
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    animated.push(el);
  }
  return animated;
}

/** Captura las posiciones actuales de los hijos `[data-sort-item]` con `data-sort-key` antes de reordenarlos. */
export function captureFlipRects(list: HTMLElement | null): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  if (!list) return rects;
  for (const el of getSortItems(list)) {
    const key = el.dataset?.sortKey;
    if (!key) continue;
    el.style.transition = 'none';
    el.style.transform = '';
    rects.set(key, el.getBoundingClientRect());
  }
  return rects;
}

/** Anima el desplazamiento FLIP de elementos reordenados y asegura la visibilidad del elemento movido. */
export function playFlipRects(list: HTMLElement | null, prevRects: Map<string, DOMRect>, movedKey?: string): void {
  if (!list || !prevRects.size) return;
  const reducedMotion = isReducedMotion();
  let movedEl: HTMLElement | null = null;
  let movedLast: DOMRect | null = null;
  const candidates: Array<readonly [HTMLElement, DOMRect]> = [];

  for (const el of getSortItems(list)) {
    const key = el.dataset?.sortKey;
    if (!key) continue;
    const first = prevRects.get(key);
    if (!first) continue;
    if (key === movedKey) {
      movedEl = el;
      movedLast = el.getBoundingClientRect();
    }
    if (!reducedMotion) candidates.push([el, first]);
  }

  const animated = invertFlipMoves(candidates);
  if (animated.length) {
    void list.offsetHeight;
    for (const el of animated) {
      if (el === movedEl) el.classList?.add(...FLIP_HIGHLIGHT_CLASSES);
      el.style.transition = FLIP_TRANSITION;
      el.style.transform = '';
      const clear = () => {
        el.style.transition = '';
        el.classList?.remove(...FLIP_HIGHLIGHT_CLASSES);
      };
      el.addEventListener?.('transitionend', clear, { once: true });
      setTimeout(clear, 260);
    }
  }

  if (movedEl && movedLast && typeof window !== 'undefined' && (movedLast.top < 72 || movedLast.bottom > window.innerHeight - 84)) {
    movedEl.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  }
}

/**
 * Activa delegación de arrastre con animación FLIP sobre `root` para cualquier
 * contenedor `[data-sort-list]` con hijos `[data-sort-item]` y asas `[data-sort-handle]`.
 */
export function initSortableLists(
  root: HTMLElement,
  onReorder: (scope: string, from: number, to: number) => void | Promise<void>,
) {
  let active: {
    list: HTMLElement;
    scope: string;
    item: HTMLElement;
    handle: HTMLElement;
    pointerId: number;
    fromIdx: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    started: boolean;
    rafScroll: number;
    lockUntil: number;
  } | null = null;

  const cleanup = () => {
    if (!active) return;
    const { item, handle, pointerId, rafScroll } = active;
    if (rafScroll) cancelAnimationFrame(rafScroll);
    if (handle.hasPointerCapture(pointerId)) {
      try { handle.releasePointerCapture(pointerId); } catch { /* noop */ }
    }
    item.style.transform = '';
    item.style.transition = '';
    item.style.willChange = '';
    item.classList.remove(...DRAG_ACTIVE_CLASSES);
    active = null;
  };

  const getItems = getSortItems;

  const maybeSwap = () => {
    if (!active || !active.started || performance.now() < active.lockUntil) return;
    const { list, item } = active;
    const items = getItems(list);
    if (items.length < 2) return;

    const dragRect = item.getBoundingClientRect();
    const dragCx = dragRect.left + dragRect.width / 2;
    const dragCy = dragRect.top + dragRect.height / 2;
    const myIdx = items.indexOf(item);

    let target: HTMLElement | null = null;
    let bestDist = Infinity;
    for (const el of items) {
      if (el === item) continue;
      const r = el.getBoundingClientRect();
      const inside = dragCx >= r.left && dragCx <= r.right && dragCy >= r.top && dragCy <= r.bottom;
      if (!inside) continue;
      const dist = Math.hypot(dragCx - (r.left + r.width / 2), dragCy - (r.top + r.height / 2));
      if (dist < bestDist) {
        bestDist = dist;
        target = el;
      }
    }
    if (!target) return;

    const targetIdx = items.indexOf(target);
    if (targetIdx === -1 || targetIdx === myIdx) return;

    // 1. First: guardar posiciones actuales de los hermanos y la base sin transform del propio ítem
    const prevRects = new Map<HTMLElement, DOMRect>();
    for (const el of items) {
      el.style.transition = 'none';
      el.style.transform = '';
      prevRects.set(el, el.getBoundingClientRect());
    }
    const prevDragBase = prevRects.get(item)!;

    // 2. Reordenar en el DOM
    if (targetIdx < myIdx) list.insertBefore(item, target);
    else list.insertBefore(item, target.nextSibling);

    // Compensar el desplazamiento de layout en startX/startY para que el ítem siga pegado al puntero
    const newDragBase = item.getBoundingClientRect();
    active.startX += newDragBase.left - prevDragBase.left;
    active.startY += newDragBase.top - prevDragBase.top;
    item.style.transform = `translate3d(${active.lastX - active.startX}px, ${active.lastY - active.startY}px, 0) scale(1.015)`;

    // 3. Last + Invert + Play para los hermanos desplazados
    if (!isReducedMotion()) {
      const siblingEntries = items
        .filter((el) => el !== item)
        .map((el) => [el, prevRects.get(el)!] as const);
      const moved = invertFlipMoves(siblingEntries);
      if (moved.length) {
        active.lockUntil = performance.now() + 190;
        void list.offsetHeight;
        for (const el of moved) {
          el.style.transition = FLIP_TRANSITION;
          el.style.transform = '';
        }
      }
    }
  };

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const handle = (e.target as Element | null)?.closest('[data-sort-handle]') as HTMLElement | null;
    if (!handle) return;
    const item = handle.closest('[data-sort-item]') as HTMLElement | null;
    const list = item?.closest('[data-sort-list]') as HTMLElement | null;
    if (!item || !list) return;
    const scope = list.dataset.sortList;
    if (!scope) return;

    const fromIdx = getItems(list).indexOf(item);
    if (fromIdx === -1) return;

    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch { /* noop */ }
    active = {
      list,
      scope,
      item,
      handle,
      pointerId: e.pointerId,
      fromIdx,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      started: false,
      rafScroll: 0,
      lockUntil: 0,
    };
  });

  root.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== active.pointerId) return;
    active.lastX = e.clientX;
    active.lastY = e.clientY;
    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    if (!active.started) {
      if (Math.hypot(dx, dy) < 5) return;
      active.started = true;
      active.item.style.willChange = 'transform';
      active.item.style.transition = 'none';
      active.item.classList.add(...DRAG_ACTIVE_CLASSES);
    }

    active.item.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.015)`;
    maybeSwap();

    // Auto-scroll suave cerca de los bordes superior e inferior
    const margin = 64;
    let speed = 0;
    if (e.clientY < margin) speed = -Math.ceil(((margin - e.clientY) / margin) * 10);
    else if (e.clientY > window.innerHeight - margin) speed = Math.ceil(((e.clientY - (window.innerHeight - margin)) / margin) * 10);

    if (speed !== 0 && !active.rafScroll) {
      const step = () => {
        if (!active || !active.started) return;
        const prevY = window.scrollY;
        window.scrollBy(0, speed);
        const scrolled = window.scrollY - prevY;
        if (scrolled !== 0) {
          active.startY -= scrolled;
          active.item.style.transform = `translate3d(${active.lastX - active.startX}px, ${active.lastY - active.startY}px, 0) scale(1.015)`;
          maybeSwap();
        }
        active.rafScroll = requestAnimationFrame(step);
      };
      active.rafScroll = requestAnimationFrame(step);
    } else if (speed === 0 && active.rafScroll) {
      cancelAnimationFrame(active.rafScroll);
      active.rafScroll = 0;
    }
  });

  const finish = (e: PointerEvent) => {
    if (!active || e.pointerId !== active.pointerId) return;
    const { list, item, scope, fromIdx, started } = active;
    const toIdx = getItems(list).indexOf(item);
    cleanup();
    if (started && toIdx !== -1 && fromIdx !== toIdx) {
      void onReorder(scope, fromIdx, toIdx);
    }
  };

  root.addEventListener('pointerup', finish);
  root.addEventListener('pointercancel', finish);
}
