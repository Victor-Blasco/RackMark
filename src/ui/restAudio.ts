/** Formatea segundos enteros a `M:SS` para el cronómetro de descanso. */
export function fmtMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Emite un aviso acústico breve al finalizar un temporizador de descanso. */
export function playRestBeep(): void {
  try {
    const webkitCtx = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const Ctx = window.AudioContext ?? webkitCtx;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.15);
    });
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 600);
  } catch {
    /* AudioContext opcional según navegador */
  }
}
