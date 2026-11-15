# Reglas del Proyecto — GymApp

Antes de diseñar vistas nuevas, tocar estilos o modificar persistencia/sincronización, lee la especificación completa en [docs/GUIA_ESTILO_Y_ARQUITECTURA.md](docs/GUIA_ESTILO_Y_ARQUITECTURA.md).

## 1. Contexto de Uso y Ergonomía (Mobile-First en Gimnasio)
- **Dos contextos:** `Entrenar` (`En vivo` en `src/ui/workoutView.ts` y `Registrar hecho` en `src/ui/logView.ts`) prioriza velocidad con una mano en móvil; el resto (`Resumen`, `Rutinas`, `Planificación`, `Análisis`, `Datos`, `Ajustes`) optimiza densidad y analítica en escritorio.
- **Un ejercicio activo en vivo:** En `En vivo` muestra un solo ejercicio a la vez, con etiquetas explícitas (`Peso (kg)`, `Reps`) y menú tipo hamburguesa animado (`#live-ex-menu-wrap`), nunca sliders ni cards apiladas.
- **`Registrar hecho` sin timer invasivo:** El registro histórico de un entrenamiento ya terminado no inicia temporizadores en segundo plano; el descanso es opcional.
- **Táctil y accesibilidad:** Controles interactivos móviles `>= 44px` (`min-h-[44px]` / `h-11`), `touch-action: manipulation`, `<input>` con `text-base sm:text-sm` (sin auto-zoom iOS), confirmaciones destructivas vía `#confirm-modal` (no `window.confirm()`), y respeto estricto a roles ARIA y foco modal.

## 2. Sistema Visual y Regla Anti Card-itis
- **Lienzo plano por defecto:** Trabaja sobre `bgDark` (`#090D16`) usando aire vertical y separadores `1px` (`border-b border-white/10`, `divide-y`). **Prohibido anidar cards dentro de cards.**
- **Superficies elevadas (`cardDark`, `rounded-2xl`):** Úsalas solo en capas flotantes/transitorias (`#live-ex-menu`, panel swap/añadir), modales, `#ai-report`, panel maestro-detalle de escritorio o zonas destructivas.
- **Tokens y deuda CSS:** No introduzcas nuevos hexadecimales literales ni nuevos modificadores `!important` (`!`) de Tailwind; limpia las clases base en `src/style.css` cuando modifiques un componente.
- **Semántica y contraste:** Reserva `coralRed` / `rose-*` para errores, acciones destructivas o alertas reales (evita aplicarlo a métricas neutras nuevas). Mínimo `text-gray-400` en textos informativos (no uses `text-gray-500`) y aplica `.num-col` / `tabular-nums` en todas las cifras.
- **Iconos y animaciones:** Usa exclusivamente Phosphor Icons Bold vía `icon()` (`src/ui/icons.ts`), nunca emojis funcionales. Anima acordeones/menús mediante `grid-rows-[0fr]` / `grid-rows-[1fr]` sin destruir el nodo DOM y respeta `prefers-reduced-motion`.
- **Gráficas (`Chart.js`):** Crea toda gráfica vía `normalizeChartConfig()` / `chart()` / `runChartJobs()` (`src/ui/shared.ts`) con un único eje `y` salvo unidades distintas (`y` kg vs `y1` % o HRV).

## 3. Arquitectura, Persistencia y Seguridad
- **Fronteras estrictas:** `src/types.ts` (puro) -> `src/lib/*` (lógica, IDB, sync, parseo, sin importar `src/ui/*` ni tocar el DOM) -> `src/ui/*` (HTML sanitizado, sin llamadas directas a IDB/Firestore) -> `src/main.ts` (orquestador único).
- **Carga pesada aislada:** Mantén `src/lib/ai.ts` con import dinámico y el parseo Samsung ZIP/CSV dentro del Web Worker (`src/lib/samsungWorker.ts`).
- **Fechas locales:** Usa `todayIso()` (`src/lib/seed.ts`) para el día actual; nunca `new Date().toISOString().slice(0, 10)` directamente para registros locales del usuario.
- **Render sin saltos:** En acciones frecuentes (inputs, series, contadores, timers) usa parches DOM selectivos en lugar de reconstruir `#app` con `root.innerHTML` o destruir gráficas sin cambios de datos; preserva `focusSelector` y scroll.
- **Contrato Cloud Firestore:** Si cambias `Settings`, rutinas, fases o `buckets`, revisa obligatoriamente `firestore.rules` (delegando al subagente `firestore-rules-author`) y actualiza `tests/sync.test.ts` y `tests/security.test.ts`.
- **Seguridad e integridad:** Envuelve toda interpolación dinámica en HTML con `esc()` (`src/ui/shared.ts`), sanea `Settings` con `sanitizeSettings()` en ingestas/pulls, valida importaciones externas (`parseBackup`, `stripUndefined`) y respeta la CSP de `firebase.json`.

## 4. Verificación Obligatoria
- Antes de dar por terminado cualquier cambio, ejecuta desde la raíz del workspace/worktree activo:
  - `npm test` (`vitest run`)
  - `npm run build` (`tsc --noEmit && vite build`)
- En cambios de UI, comprueba visualmente el resultado en móvil (`~390px`) y escritorio (`~1440px`).
