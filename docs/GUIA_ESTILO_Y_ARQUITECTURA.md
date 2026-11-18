# Guía de Estilo, UX y Arquitectura — GymApp

Documento rector del diseño visual, ergonomía por dispositivo, fronteras de arquitectura e invariantes técnicos de **GymApp** (PWA *offline-first* en español para seguimiento de fuerza, composición corporal, bienestar y planificación).

> Toda modificación de interfaz, estado o persistencia debe respetar las reglas resumidas en [GEMINI.md](../GEMINI.md) y detalladas en esta guía.

---

## 1. Visión y Principios del Producto

GymApp combina dos necesidades operativas opuestas dentro de una misma PWA:

1. **Captura sin fricción durante el entrenamiento.** En el gimnasio no hay margen para jerarquías profundas, pantallas recargadas ni temporizadores intrusivos cuando solo se quiere anotar un peso o marcar una serie.
2. **Análisis profundo fuera del gimnasio.** En casa o en escritorio el usuario evalúa tendencias de fuerza, volumen semanal por grupo muscular, adherencia, métricas corporales, bienestar importado de Samsung Health y recomendaciones de Coach IA.

### Principio rector: Contexto Gimnasio vs. Contexto Laboratorio

| Dimensión | Contexto Gimnasio (Móvil / En vivo) | Contexto Laboratorio (Escritorio / Histórico) |
| :--- | :--- | :--- |
| **Vistas principales** | `Entrenar` -> `En vivo` (`src/ui/workoutView.ts`), `Registrar hecho` (`src/ui/logView.ts`), barra inferior móvil | `Resumen`, `Rutinas` (`Push`/`Pull`/`Leg`...), `Planificación`, `Composición`, `Volumen`, `Adherencia`, `Calculadoras`, `Datos`, `Ajustes` |
| **Carga cognitiva** | **Mínima**: un único ejercicio activo en pantalla durante el entreno en vivo | **Alta controlada**: maestro-detalle, tablas comparativas, múltiples gráficas con rango temporal |
| **Superficie visual** | Lienzo plano `#090D16` con divisores `1px`; cero cards anidadas | Lienzo plano `#090D16` con paneles elevados solo en detalle lateral sticky, modales e informe IA |
| **Prioridad operativa** | Ergonomía con una mano (`>= 44px`), sin auto-zoom iOS, cero pérdidas de foco/datos | Precisión analítica, edición rápida de rutinas, drag & drop FLIP y exportación/sincronización |

---

## 2. Estrategia por Dispositivo y Reglas de UX

### 2.1 Navegación Responsive (`src/main.ts`)

- **Escritorio (`lg:` y superior):** Barra lateral fija (`lg:w-64`, `renderSidebar`) con secciones agrupadas y acceso directo a rutinas, análisis y herramientas.
- **Móvil (`< lg`):** Cabecera superior sticky (`renderMobileHeader`) + barra inferior fija (`renderMobileNav`) orientada al pulgar, priorizando `Resumen`, `Rutinas`, `Análisis` y `Entrenar`.
- El enfoque de teclado y accesibilidad parte del enlace de salto `#main-content` en `index.html`.

### 2.2 Flujos de Entrenamiento: Separación Estricta (`Entrenar`)

El usuario distingue explícitamente entre entrenar **ahora mismo** y registrar un entreno **ya terminado**:

1. **Modo `En vivo` (`src/ui/workoutView.ts`):**
   - Muestra **un solo ejercicio a la vez**, evitando listados largos o sliders horizontales que dispersen la atención.
   - Etiquetas explícitas sobre los campos numéricos (`Peso (kg)` y `Reps`) para evitar dudas con el cansancio del entrenamiento.
   - Temporizador de descanso automático configurable (`60s`, `90s`, `120s`, `180s`) disparado al completar serie, con avance natural hacia las series y el siguiente ejercicio (`liveGoEx`).
   - Flexibilidad real de gimnasio: permitir **añadir/quitar series**, **cambiar el ejercicio por otro** o **añadir un ejercicio adicional** sobre la marcha sin salir de la sesión.
   - Selector de ejercicios mediante **menú tipo hamburguesa animado** (`#live-ex-menu-wrap` / `#live-ex-menu`) con vista rápida de objetivo (`Obj SxR`), historial resumido y acceso a añadir ejercicio.
2. **Modo `Registrar hecho` (`src/ui/logView.ts`):**
   - Pensado para anotar sesiones ya finalizadas sin lanzar temporizadores en segundo plano ni interrumpir la captura manual.
   - El descanso es un dato opcional editable por el usuario si desea dejar constancia de él.

### 2.3 Reglas Obligatorias de Ergonomía Táctil (Móvil)

- **Tamaño mínimo táctil:** Todo botón, chip, enlace o control interactivo de uso frecuente debe alcanzar **`>= 44px × 44px`** (`min-h-[44px]` / `h-11`).
- **Prevención de doble tap / zoom iOS:** Mantener `touch-action: manipulation` en controles táctiles y usar **`text-base sm:text-sm`** (`16px` en móvil, `14px` en escritorio) en todos los `<input>` numéricos y de texto.
- **Botones primarios claros:** Acciones de confirmación (`Terminar`, `Listo`, `Guardar`) con jerarquía inequívoca y separación física suficiente frente a acciones destructivas (`Descartar`, `Eliminar`).

### 2.4 Reglas de Escritorio, Tablas y Accesibilidad (A11y)

- Tablas de datos con **`table-fixed`** y alineación numérica consistente para evitar bailes horizontales al filtrar o cambiar de rango.
- Patrón **maestro-detalle sticky** en `viewDay` (`src/ui/views.ts`) y `viewPlan` (`src/ui/planView.ts`).
- Reordenación mediante **Pointer Events + FLIP** (`src/ui/reorder.ts`), acompañada siempre de controles alternativos accesibles (`↑` / `↓` o equivalentes) utilizables sin gestos de arrastre.
- **Jerarquía de encabezados (`<h1>`) y ARIA:** Garantizar un `<h1>` visible también en escritorio (actualmente el único `<h1>` reside en la cabecera móvil `lg:hidden` de `src/main.ts`), añadir `role="option"` en los ítems de `role="listbox"` de `viewDay`, navegación con flechas en `role="tablist"` y *focus trap* + retorno de foco al cerrar los modales (`#confirm-modal`, `#ex-modal`, `#rt-modal`, `#note-modal`, `#wizard-modal`).
- **Diálogos consistentes:** Usar `#confirm-modal` (`askConfirm`) en lugar de `window.confirm()` nativo (actualmente residual en `liveStart` y `liveDiscard` de `src/main.ts`).

---

## 3. Sistema de Diseño Visual y Antipatrones

### 3.1 Paleta Oficial (`tailwind.config.js`)

| Token Tailwind | Hex | Uso canónico |
| :--- | :--- | :--- |
| `bgDark` | `#090D16` | Lienzo principal de la aplicación y fondo base (`index.html`) |
| `cardDark` | `#111827` | Superficie elevada reservada para bloques autónomos, modales o panel maestro-detalle |
| `borderDark` | `#1F2937` | Bordes estructurales de controles, inputs y separadores sutiles |
| `electricBlue` | `#3B82F6` | Acción primaria, foco activo, serie en curso, acento de marca |
| `emeraldGreen` | `#10B981` | Éxito, serie/objetivo completado, tendencia o adherencia positiva |
| `amberGold` | `#F59E0B` | Precaución, advertencia moderada, indicador intermedio o temporizador de aviso |
| `coralRed` | `#F43F5E` | Error, acción destructiva, déficit crítico o fatiga alta (`text-rose-300` para textos/badges legibles) |

- **Paleta de rutinas (`ROUTINE_COLORS` en `src/lib/seed.ts`):** `['#F43F5E', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#06B6D4', '#EC4899', '#84CC16']`.
- **Paleta multi-serie en gráficas (`PAL` en `src/ui/analyticsViews.ts`):** `['#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#A78BFA', '#22D3EE']`.

> **Normalización de tokens y fondos ad-hoc:** `borderDark` (`#1F2937`) no se usa en `src/` (las vistas emplean `border-white/10`, `border-white/15`, `border-gray-800` y `border-gray-700`). Además conviven varios tonos oscuros literales fuera de `tailwind.config.js` (`#0B101B` en barras/sidebar de `src/main.ts`, `#0D1320` en detalle embebido de `src/ui/views.ts`, `#0E1525` en el menú/panel de `src/ui/workoutView.ts`, `#0F1624` en modales de `src/ui/planView.ts` y `src/ui/wizardView.ts`, y `#121A2B` durante drag activo en `src/ui/reorder.ts`). **Regla:** no introducir nuevos códigos hex literales; cualquier refactor debe mapear estas capas y los bordes a tokens semánticos en `tailwind.config.js`.

### 3.2 Semántica de Color y Conflicto Actual de `coralRed`

Actualmente `coralRed` (`#F43F5E`) cumple dos funciones que compiten visualmente:
- **Semántica de alerta/peligro:** acciones destructivas (`dataView.ts`, `planView.ts`, `settingsView.ts`, `logView.ts`, `workoutView.ts`), volumen semanal bajo `< 8` series (`analyticsViews.ts`, `planView.ts`) y veredicto `'warning'` del Coach IA (`views.ts`).
- **Semántica neutra de métrica o categoría:** `DAY_COLOR.Push` (`shared.ts`), `% Grasa` (`views.ts`, `analyticsViews.ts`), `Pulso` (`views.ts`) y objetivo `Proteína 2,2 g/kg` (`analyticsViews.ts`).

**Directriz:** en código nuevo y refactors visuales, reservar `coralRed` (y derivados `rose-*`) para riesgo, error, alerta o borrado destructivo, y desplazar las métricas fisiológicas neutras hacia acentos informativos no alarmantes (violeta, cyan, índigo o azul) salvo cuando superen un umbral de alerta real.

### 3.3 Regla Anti *Card-itis* y Jerarquía de Superficies

El ruido visual en móvil proviene de encerrar cada fila, input y cabecera dentro de múltiples cajas con bordes y fondos distintos.

1. **Plano por defecto:** El contenido principal descansa directamente sobre `bgDark` (`#090D16`), estructurado mediante aire vertical y divisores horizontales `1px` (`border-b border-white/10`, `divide-y divide-white/5`).
2. **Prohibido anidar cards dentro de cards:** Nunca colocar una tarjeta redondeada con borde y fondo distinto dentro de otra tarjeta en flujos operativos (`workoutView.ts`, `logView.ts`).
3. **Cuándo sí usar superficie elevada (`bg-cardDark` / `rounded-2xl`):**
   - Capas flotantes o transitorias (`#live-ex-menu`, panel de cambio/añadido de ejercicio).
   - Modales y asistente de bienvenida (`renderModals`, `wizardView.ts`).
   - Bloques narrativos autónomos diferenciados (`#ai-report`).
   - Panel derecho de detalle en escritorio (`renderDayDetail` fuera de acordeón embebido).
   - Tarjetas discretas de selección única/múltiple (`viewPlan`, selector de tono IA) o zona de peligro (`dataView.ts`).

### 3.4 Tipografía y Contraste (`src/style.css`)

- **Tipografía base:** `Inter Variable` (`@fontsource-variable/inter`) con `antialiased` en `<body>` y pila monoespaciada para datos técnicos cuando corresponda.
- **Estabilidad numérica (`.num-col` / `tabular-nums`):** Obligatorio en pesos, repeticiones, tiempos de descanso, volúmenes, series completadas, porcentajes y celdas numéricas de tabla.
- **Contraste mínimo en tema oscuro:** Usar como mínimo **`text-gray-400`** para metadatos, subtítulos e instrucciones secundarias. **Prohibido introducir `text-gray-500`** en texto legible (eliminar gradualmente las 6 ocurrencias restantes en `src/main.ts`, `src/ui/analyticsViews.ts` y `src/ui/workoutView.ts`).

### 3.5 Controles (`src/style.css`) y Prohibición de Nuevos `!important`

- Clases compartidas en `src/style.css`: `.card`, `.btn`, `.btn-primary`, `.inp`, `.lbl`, `.tab` / `.tab-on`, `.nav-item` / `.nav-item-on` / `.nav-sec-lbl`, `.bnav-item` / `.bnav-item-on`, `.num-col`, `.chart-box`.
- Los inputs numéricos ocultan spinners nativos y los `<select>` mantienen paleta oscura legible (`#F9FAFB` sobre fondo oscuro).
- **Deuda técnica conocida (`!`):** `.btn` y `.inp` fijan espaciado y ancho en `src/style.css`, lo que provocó **212 overrides `!important` (`!`)** distribuidos en `src/ui/` y `src/main.ts`. **Regla:** no añadir nuevos modificadores `!` de Tailwind; al tocar una vista o componente, sustituir los overrides `!` por clases base o variantes limpias (ej. `.btn-sm` vs `.btn-touch`).

### 3.6 Iconografía (`src/ui/icons.ts`)

- Todos los iconos funcionales de interfaz usan SVG de **Phosphor Icons Bold** (`viewBox="0 0 256 256"`) renderizados mediante `icon(name, cls)` (25 iconos activos definidos).
- **Prohibido usar emojis como iconos de navegación o acción** en la UI de aplicación.
- No mantener iconos muertos en `icons.ts`.

### 3.7 Gráficas (`Chart.js` en `src/ui/shared.ts` y `analyticsViews.ts`)

- Instanciar todas las gráficas exclusivamente a través de **`normalizeChartConfig()`**, **`chart()`** y **`runChartJobs()`** definidos en `src/ui/shared.ts`.
- **Un eje `y` por defecto:** Mantener una sola escala vertical salvo cuando convivan magnitudes de distinta unidad (por ejemplo, `y` en `kg` y `y1` en `% grasa` o `HRV`).
- Respetar los selectores temporales unificados (`rangePicker`, `resolveRange`, `inRange`) y medias móviles (`movingAverage7d`).
- Evitar llamadas innecesarias a `resetCharts()` en acciones que no modifican los datos graficados.

### 3.8 Animaciones y Microinteracciones

- Los paneles desplegables y menús contextuales deben animar altura mediante **`grid-template-rows` (`grid-rows-[0fr]` -> `grid-rows-[1fr]`)** + transición de opacidad sobre contenedor interno `overflow-hidden`, **sin desmontar el nodo** ni provocar saltos bruscos de layout (patrón aplicado en `#live-ex-menu-wrap` de `src/ui/workoutView.ts`).
- Toda animación o transición nueva —incluidas las transiciones FLIP en `src/ui/reorder.ts`— debe respetar **`prefers-reduced-motion: reduce`** (actualmente cubierto en CSS solo para `.wizard-*` y utilidades `motion-reduce:` puntuales).

### 3.9 Patrones de selección por coste de interacción

El patrón de selección debe decidirse por el número de opciones, la previsibilidad de sus nombres,
la frecuencia de uso, el viewport y la carga cognitiva (Ley de Hick), no por preferencia estética.

| Opciones | Patrón | Contenedor | Búsqueda |
| --- | --- | --- | --- |
| 2–3 | Segmented control o radio group | Inline | No |
| 4–7 | Radio group, `<select>` nativo o popover corto | Inline / popover | No |
| 8–15 | Listbox o select enriquecido | Popover con scroll / bottom sheet medio | Opcional |
| 16–50 | Selector filtrable | Modal / bottom sheet alto | Obligatoria |
| 50+ | Command palette o buscador dedicado | Modal amplio / sheet completo | Instantánea + filtros |

#### Reglas por tramo

- Con 2–3 opciones, no ocultes alternativas detrás de un modal o desplegable.
- Con 4–7 opciones, evita scroll interno y ordena por frecuencia o probabilidad.
- Con 8–15 opciones, agrupa con cabeceras no seleccionables cuando exista una taxonomía útil.
- Con 16–50 opciones, fija la cabecera con título, cierre y búsqueda; muestra 3–5 recientes arriba
  y deja el scroll únicamente en la lista.
- Con más de 50 opciones, añade filtros facetados y considera virtualización solo si el contenido
  complejo provoca un problema medible de rendimiento.

#### Modelo, búsqueda y accesibilidad

Los selectores complejos pueden usar una estructura equivalente a:

```ts
interface SelectOption {
  id: string;
  label: string;
  subtitle?: string;
  group?: string;
  aliases?: string[];
  lastUsedAt?: number;
  disabled?: boolean;
}
```

Normaliza `label`, `subtitle`, `aliases` y la consulta con `.normalize('NFD')`, eliminación de
diacríticos y minúsculas. Cuando no haya coincidencias, comunica la consulta exacta y ofrece crear
la opción si el dominio lo permite. `lastUsedAt` debe permanecer local salvo que exista una razón
de producto para sincronizarlo.

Un `listbox` custom debe implementar `role="listbox"`, `role="option"`, `aria-selected`,
navegación con flechas, `Enter`, `Escape` y devolución del foco al disparador. Usa `<select>` nativo
cuando proporcione una experiencia más accesible y suficiente para el caso.

#### Aplicación visual en GymApp

- Usa controles de selección inline para métricas, tono IA y otras decisiones de 2–3 opciones.
- Mantén `<select>` nativo para grupos pequeños y estables, como perímetros.
- Usa un selector filtrable con recientes y aliases para catálogos grandes de ejercicios en `En vivo`,
  `Registrar hecho` y planificación.
- En móvil, prioriza bottom sheets de 44 px mínimo; en escritorio, popovers o paneles maestro-detalle.
- Mantén el lienzo plano, evita radio-cards anidadas y no introduzcas AI glow, glassmorphism,
  bento grids forzados ni gráficas decorativas.
- La búsqueda debe actualizar solo la lista, preservar el foco y no reconstruir `#app`.

---

## 4. Arquitectura, Persistencia y Reglas de Estado

### 4.1 Mapa de Módulos y Fronteras Estrictas (Migración Preact en curso)

```text
src/types.ts  (contratos de dominio puros, cero dependencias de runtime)
    ▲
    ├── src/lib/*         (db, sync, firebase, samsung, samsungWorker, measures, analysis, ai, seed)
    │       ▲             · PROHIBIDO importar UI o tocar el DOM
    │       │
    ├── src/store/* &     (types, navigation, appStore, workoutSelectors, workoutActions, useRestTimer, useFocusTrap)
    │   src/hooks/*       · Estado tipado (ActiveModal), selectores puros y hooks reutilizables (<= 150 lín./archivo)
    │       ▲
    ├── src/components/*  (common/, layout/, modals/, workout/) + src/views/* (LiveWorkoutView.tsx...)
    │   & src/ui/*        · Componentes Preact .tsx (<= 150 lín., Props y TSDoc en español) + LegacyViewBridge temporal
    │       ▲
    └── src/main.ts       (punto de entrada: monta AppShell con Preact y mantiene puente para vistas pendientes)
```

- **Carga diferida y Workers:**
  - `src/lib/ai.ts` se importa dinámicamente bajo demanda en `src/main.ts` para no penalizar el arranque inicial.
  - La descompresión e importación pesada de Samsung Health (`fflate` + `papaparse`) se ejecuta en `src/lib/samsungWorker.ts` fuera del hilo principal.
  - En `vite.config.ts`, `rolldownOptions.codeSplitting` separa `firebase-firestore`, `firebase-auth` y `charts`.

### 4.2 Capas de Persistencia y Sincronización

| Capa | Módulos | Qué almacena | Regla clave |
| :--- | :--- | :--- | :--- |
| **IndexedDB (`gymapp` v2)** | `src/lib/db.ts` | 5 *object stores* con el histórico local (fuerza, cardio, bienestar, medidas, ajustes/estado) | Fuente de verdad local *offline-first* |
| **`localStorage`** | `src/main.ts`, `workoutView.ts`, `logView.ts`, `sync.ts` | Borradores activos (`LogDraft`, `LiveWorkout`) y metadatos de sync | Nunca almacenar secretos ni datos masivos históricos |
| **Cloud Firestore** | `src/lib/sync.ts`, `src/lib/firebase.ts` | Configuración (`settings`) y `buckets` (`items`/`deleted` por `{kind}_{year\|all}`) por `uid` | Protegido por `firestore.rules` (solo propietario con email verificado) |

#### Invariantes de Esquema en `firestore.rules` y Sincronización (`src/lib/sync.ts`)

Cualquier cambio en `Settings`, rutinas, fases o buckets de sincronización **exige revisar `firestore.rules`** (mediante el subagente `firestore-rules-author`) y validar `tests/sync.test.ts` + `tests/security.test.ts`:
- Propiedad estricta por `uid` autenticado con correo verificado.
- `routines`: mínimo `1`, máximo `20` rutinas; mapas auxiliares `<= 500`; `phases <= 100`.
- `buckets`: colecciones `items` y `deleted` con máximo `5000` entradas (`cardio_all`, `measures_all`, `strength_<YYYY|legacy>`, `wellbeing_<YYYY|legacy>`).
- Marcas temporales en milisegundos epoch con margen máximo de `+24h` por desfase de reloj; los tombstones tienen TTL de 90 días.
- Campo `kind` inmutable en documentos de sincronización; regla `deny` por defecto al final de `firestore.rules`.
- Campo legacy opcional `geminiKey` acotado a `<= 256` caracteres hasta su retirada definitiva.
- **Saneamiento y limpieza de sesión:** toda escritura o ingesta de `Settings` (incluyendo pulls remotos en `sync.ts` e importaciones en `main.ts`) debe pasar por `sanitizeSettings()`, un `remote wipe` debe limpiar tanto `gymapp_log_draft` como `gymapp_live_workout`, y los lotes `writeBatch(fs)` deben respetar el límite de 500 operaciones de Firestore.

### 4.3 Regla Crítica de Fechas Locales

- Para generar o comparar la fecha del día actual del usuario, utilizar **`todayIso()`** en `src/lib/seed.ts` (calculada en hora local).
- **Prohibido usar `new Date().toISOString().slice(0, 10)` directamente** para fechas de entrenamiento o bienestar del usuario, ya que provoca saltos de día en zonas horarias distintas de UTC cerca de medianoche (solo aceptable en manipulaciones de rangos ISO ya normalizados).

### 4.4 Ciclo de Render, Foco y Parches DOM (`src/main.ts`)

- Gran parte de las vistas reconstruyen `#app` vía `root.innerHTML`; sin embargo, en flujos de alta frecuencia se deben usar **parches DOM selectivos** (como ya hacen `syncSetDom`, `updateLogCountersDom`, `updateSyncDom`, `updateRestBarDom`, `logStepW`/`logStepR`/`logToggleSet` y `liveToggleMenu`) para evitar:
  - Pérdida de foco (`focusSelector`) o cierre del teclado virtual en móvil.
  - Saltos de posición de scroll.
  - Destrucción y reconstrucción innecesaria de gráficas `Chart.js` (`resetCharts()`).
- **Pendiente de migrar a parche selectivo:** `liveStepW`, `liveStepR`, `liveToggleSet` y `planSearch` en `src/main.ts` siguen disparando `render()` completo. Al añadir interacciones nuevas, evitar `root.innerHTML` cuando baste actualizar nodos identificados por `data-*` o `id`.

---

## 5. Seguridad, Calidad, Verificación y Hoja de Ruta

### 5.1 Reglas de Seguridad y Calidad de Código

- **Prevención XSS:** Todo contenido textual dinámico (nombres de rutinas, ejercicios, notas, CSV importados, errores) interpolado en plantillas HTML debe envolverse con **`esc()`** (`src/ui/shared.ts`).
- **Validación en fronteras externas:** Sanitizar entradas en importación JSON/CSV (`parseBackup`, prevención de contaminación de prototipos, limpieza con `stripUndefined` antes de persistir/sincronizar en Firestore).
- **CSP (`firebase.json`):** Mantener compatibles los scripts, estilos y Web Workers con la cabecera CSP (`default-src 'self'`, `worker-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `style-src 'self' 'unsafe-inline'`, `COOP same-origin-allow-popups`, `X-Frame-Options DENY`).
- **Calidad de código:** Funciones pequeñas, retorno temprano, cero helpers *passthrough* triviales y evitar programación defensiva redundante sobre tipos internos ya garantizados por TypeScript.

### 5.2 Comandos de Verificación

Ejecutar desde la raíz del worktree activo (o añadiendo `--prefix .worktrees/auditoria-v2` desde la raíz del repo):

```bash
# Suite de tests unitarios y contratos (Vitest: tests/features.test.ts, sync.test.ts, security.test.ts, parsers.test.ts)
npm test

# Comprobación estricta de tipos TypeScript + bundle de producción (tsc --noEmit && vite build)
npm run build
```

Todo cambio con impacto visual o interactivo debe verificarse también en navegador en viewport móvil (`~390px`) y escritorio (`~1440px`), prestando especial atención al flujo completo en `Entrenar` (`En vivo` y `Registrar hecho`) y al comportamiento sin errores en consola.

### 5.3 Estado de la Deuda Técnica (Auditoría v2)

Los tres bloques prioritarios detectados en la auditoría v2 han quedado resueltos:

- **Bloque 1 (PWA / Offline, Sync e Integridad, Parches DOM):** migración de `registerType` a `'prompt'` con banner de actualización controlada, saneamiento `sanitizeSettings()` en ingestas y pulls, limpieza de `gymapp_live_workout` en wipe/cambio de cuenta, troceo de batches en Firestore, sustitución de `confirm()` nativo por `#confirm-modal`, y parches DOM selectivos en `En vivo` y `Plan`.
- **Bloque 2 (Ergonomía táctil, Tokens, Contraste y Accesibilidad):** tokens de superficie en `tailwind.config.js`, sistema de botones `.btn-sm` / `.btn-danger` / `.icon-btn`, texto mínimo `text-gray-400`, desacople semántico de `coralRed`, áreas táctiles `>= 44 px` en móvil, `<h1>` accesible en escritorio, navegación por teclado en `[role="tablist"]`, `role="option"` en `listbox` y *focus trap* modal + `prefers-reduced-motion` en FLIP.
- **Bloque 3 (Gráficas, Modularización, Limpieza y Tests):** reutilización de instancias `Chart.js` vía `updateChart()` sin recrear el `<canvas>`, separación entre Peso y Masa muscular en composición corporal, extracción de `src/ui/shellView.ts` y `src/ui/domPatches.ts` desde `src/main.ts`, eliminación de iconos muertos (`sparkle`, `info`) y `geminiKey` legacy, y eliminación de tests omitidos mediante fixtures sintéticos en `tests/parsers.test.ts`.
