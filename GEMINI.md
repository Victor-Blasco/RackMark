# Reglas del Proyecto — GymApp

Antes de diseñar vistas nuevas, tocar estilos o modificar persistencia/sincronización, lee la especificación completa en [docs/GUIA_ESTILO_Y_ARQUITECTURA.md](docs/GUIA_ESTILO_Y_ARQUITECTURA.md).

## 1. Contexto de Uso y Ergonomía (Mobile-First en Gimnasio)
- **Dos contextos:** `Entrenar` (`En vivo` en `src/views/LiveWorkoutView.tsx` y `Registrar hecho` en `src/views/LogWorkoutView.tsx`) prioriza velocidad con una mano en móvil; el resto (`Resumen`, `Rutinas`, `Planificación`, `Análisis`, `Datos`, `Ajustes`) optimiza densidad y analítica en escritorio.
- **Un ejercicio activo en vivo:** En `En vivo` muestra un solo ejercicio a la vez, con etiquetas explícitas (`Peso (kg)`, `Reps`) y menú tipo hamburguesa animado (`#live-ex-menu-wrap`), nunca sliders ni cards apiladas.
- **`Registrar hecho` sin timer invasivo:** El registro histórico de un entrenamiento ya terminado no inicia temporizadores en segundo plano; el descanso es opcional.
- **Táctil y accesibilidad:** Controles interactivos móviles `>= 44px` (`min-h-[44px]` / `h-11`) y `>= 48px` de altura en controles primarios de `En vivo` (`SetRow`, `RestTimerBar` en ejecución), `touch-action: manipulation`, `<input>` con `text-base sm:text-sm` (sin auto-zoom iOS), confirmaciones destructivas vía `#confirm-modal` (no `window.confirm()`), y respeto estricto a roles ARIA y foco modal.

## 2. Sistema Visual y Regla Anti Card-itis
- **Lienzo plano por defecto ("Reloj GPS Polar"):** Trabaja sobre `bgDark` (`#0A0D0E` en oscuro / `#F3F7F8` en claro vía tokens `--c-*` en `src/style.css` y `tailwind.config.js`) usando aire vertical y separadores `1px` (`border-b border-white/10`, `divide-y`). **Prohibido anidar cards dentro de cards.**
- **Apariencia Oscuro / Claro / Sistema:** Gestionada por `Settings.theme` (`'dark' | 'light' | 'system'`) y `applyTheme()` (`src/ui/theme.ts`) sin `<script>` inline en `index.html`.
- **Superficies elevadas (`cardDark`, `rounded-2xl`):** Úsalas solo en capas flotantes/transitorias (`#live-ex-menu`, panel swap/añadir), modales, `#ai-report`, panel maestro-detalle de escritorio o zonas destructivas.
- **Tokens y deuda CSS:** No introduzcas nuevos hexadecimales literales ni nuevos modificadores `!important` (`!`) de Tailwind; limpia las clases base en `src/style.css` cuando modifiques un componente. Botones y badges con fondo acento (`electricBlue` / `bg-blue-600`) deben usar texto `--c-accent-fg` (`#0A0D0E` en oscuro sobre `#2DD4BF`; `#FFFFFF` en claro sobre `#0F766E`).
- **Semántica y contraste:** Reserva `coralRed` / `rose-*` para errores, acciones destructivas o alertas reales y `emeraldGreen` para deltas/progresos reales (evita usarlos de adorno en métricas neutras o paletas categóricas). Cumple WCAG 2.1 AA (`>= 4,5:1` texto normal, `>= 3:1` texto grande/iconos): mínimo `text-gray-400` en textos informativos (no uses `text-gray-500`) y aplica `.num-col` / `tabular-nums` en todas las cifras.
- **Iconos y animaciones:** Usa exclusivamente Phosphor Icons Bold vía `<Icon />` (`src/components/common/Icon.tsx`, paths en `src/ui/icons.ts`), nunca emojis funcionales. Anima acordeones/menús mediante `grid-rows-[0fr]` / `grid-rows-[1fr]` (`<Collapsible />`) sin destruir el nodo DOM y respeta `prefers-reduced-motion`.
- **Gráficas (`Chart.js`):** Renderiza toda gráfica declarativamente mediante `<ChartCanvas config={...} />` (`src/components/common/ChartCanvas.tsx`) con `normalizeChartConfig()` (`src/ui/shared.ts`), sin arcoíris (acento Polar `#2DD4BF`/`#0F766E` en la serie principal y gris mineral `#94A3A8` en referencias/medias) y un único eje `y` salvo unidades distintas (`y` kg vs `y1` % o HRV).

## 3. Patrones de selección por coste de interacción
- **2–3 opciones:** usa segmented control o radio group inline; todas las opciones deben estar visibles y seleccionables en un toque.
- **4–7 opciones:** usa radio group vertical, `<select>` nativo o popover corto; no añadas scroll interno para listas pequeñas.
- **8–15 opciones:** usa listbox/select enriquecido, agrupación semántica y búsqueda solo cuando los nombres no sean predecibles.
- **16–50 opciones:** usa modal de escritorio o bottom sheet móvil con búsqueda obligatoria, cabecera fija y recientes/frecuentes arriba.
- **50+ opciones:** usa command palette o sheet móvil a pantalla completa con búsqueda instantánea y filtros; virtualiza solo si el DOM complejo lo justifica.
- **Datos y búsqueda:** las opciones pueden incluir `id`, `label`, `subtitle`, `group`, `aliases`, `lastUsedAt` y `disabled`. Normaliza texto con NFD antes de comparar y muestra un estado vacío accionable.
- **Accesibilidad:** los listboxes deben implementar `role="option"`, `aria-selected`, flechas, Enter, Escape y devolución del foco al disparador. Prefiere controles nativos si ofrecen mejor accesibilidad.
- **Anti-AI-Slop:** no uses bento grids forzados, AI glow, glassmorphism innecesario, cards anidadas, gráficas decorativas ni chatbots genéricos. Prioriza jerarquía, aire, divisores, datos accionables y movimiento sobrio.

## 4. Arquitectura, Persistencia y Seguridad
- **Fronteras estrictas:** `src/types.ts` (puro) -> `src/lib/*` (lógica, IDB, sync, parseo, sin importar UI ni tocar el DOM) -> `src/app/*` (`context.ts`, `syncController.ts`) & `src/store/*` y `src/hooks/*` (estado, selectores puros, modales `ActiveModal` y acciones sin acceso directo a vistas ni al DOM) -> `src/components/*` y `src/views/*` (componentes Preact `.tsx` <= 150 líneas con `Props` y TSDoc en español) -> `src/main.ts` (orquestador).
- **Carga pesada aislada:** Mantén `src/lib/ai.ts` con import dinámico y el parseo Samsung ZIP/CSV dentro del Web Worker (`src/lib/samsungWorker.ts`).
- **Fechas locales:** Usa `todayIso()` (`src/lib/seed.ts`) para el día actual; nunca `new Date().toISOString().slice(0, 10)` directamente para registros locales del usuario.
- **Render sin saltos:** Todas las vistas principales (`Resumen`, `Rutinas / Día`, `En vivo`, `Registrar hecho`, `Planificación`, `Cuerpo`, `Volumen`, `Adherencia`, `Calculadoras`, `Datos`, `Ajustes`) y los 6 modales unificados en `State.activeModal` (`ModalHost`) renderizan de forma declarativa en Preact difiriendo el DOM sin reconstruir `#app`.
- **Contrato Cloud Firestore:** Si cambias `Settings`, rutinas, fases o `buckets`, revisa obligatoriamente `firestore.rules` (delegando al subagente `firestore-rules-author`) y actualiza `tests/sync.test.ts` y `tests/security.test.ts`.
- **Seguridad e integridad:** Mantén el escape automático de JSX en Preact sin `dangerouslySetInnerHTML`, sanea texto en `fmtDate`/`short` (`src/ui/shared.ts`), sanea `Settings` con `sanitizeSettings()` en ingestas/pulls, valida importaciones externas (`parseBackup`, `stripUndefined`) y respeta la CSP de `firebase.json`.

## 5. Verificación Obligatoria
- Antes de dar por terminado cualquier cambio, ejecuta desde la raíz del workspace/worktree activo:
  - `npm test` (`vitest run`)
  - `npm run build` (`tsc --noEmit && vite build`)
- En cambios de UI, comprueba visualmente el resultado en móvil (`~390px`) y escritorio (`~1440px`).
