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
| **Vistas principales** | `Entrenar` -> `En vivo` (`src/views/LiveWorkoutView.tsx`), `Registrar hecho` (`src/views/LogWorkoutView.tsx`), barra inferior móvil | `Resumen`, `Rutinas` (`Push`/`Pull`/`Leg`...), `Planificación`, `Composición`, `Volumen`, `Adherencia`, `Calculadoras`, `Datos`, `Ajustes` |
| **Carga cognitiva** | **Mínima**: un único ejercicio activo en pantalla durante el entreno en vivo | **Alta controlada**: maestro-detalle, tablas comparativas, múltiples gráficas con rango temporal |
| **Superficie visual** | Lienzo plano `bgDark` (`#0A0D0E` oscuro / `#F3F7F8` claro) con divisores `1px`; cero cards anidadas | Lienzo plano `bgDark` (`#0A0D0E` oscuro / `#F3F7F8` claro) con paneles elevados solo en detalle lateral sticky, modales e informe IA |
| **Prioridad operativa** | Ergonomía con una mano (`>= 44px` global, `>= 48px` en controles primarios `En vivo`), sin auto-zoom iOS, cero pérdidas de foco/datos | Precisión analítica, edición rápida de rutinas, drag & drop FLIP y exportación/sincronización |

---

## 2. Estrategia por Dispositivo y Reglas de UX

### 2.1 Navegación Responsive (`AppShell.tsx`)

- **Escritorio (`lg:` y superior):** Barra lateral fija (`lg:w-64`, `Sidebar.tsx`) con secciones agrupadas y acceso directo a rutinas, análisis y herramientas.
- **Móvil (`< lg`):** Cabecera superior sticky (`MobileHeader.tsx`) + barra inferior fija (`MobileNav.tsx`) orientada al pulgar, priorizando `Resumen`, `Rutinas`, `Análisis` y `Entrenar`.
- El enfoque de teclado y accesibilidad parte del enlace de salto `#main-content` en `index.html`.

### 2.2 Flujos de Entrenamiento: Separación Estricta (`Entrenar`)

El usuario distingue explícitamente entre entrenar **ahora mismo** y registrar un entreno **ya terminado**:

1. **Modo `En vivo` (`src/views/LiveWorkoutView.tsx`):**
   - Muestra **un solo ejercicio a la vez**, evitando listados largos o sliders horizontales que dispersen la atención.
   - Etiquetas explícitas sobre los campos numéricos (`Peso (kg)` y `Reps`) para evitar dudas con el cansancio del entrenamiento.
   - Temporizador de descanso automático configurable (`60s`, `90s`, `120s`, `180s`) disparado al completar serie, con avance natural hacia las series y el siguiente ejercicio (`src/store/workoutActions.ts`).
   - **Comportamiento en segundo plano / bloqueo de pantalla:** `useRestTimer.ts` calcula el tiempo restante contra la marca epoch objetivo (`restUntil - Date.now()`), por lo que nunca pierde la cuenta ni deriva al suspenderse o desbloquear el móvil. Cuando expira en primer plano, dispara aviso sonoro (`AudioContext`), vibración breve (`navigator.vibrate([40, 40, 40])`) y `toast` si el usuario salió a otra pestaña. Actualmente no usa Screen Wake Lock ni Notifications API cuando la pantalla permanece apagada (ver hoja de ruta §5.4).
   - Flexibilidad real de gimnasio: permitir **añadir/quitar series**, **cambiar el ejercicio por otro** o **añadir un ejercicio adicional** sobre la marcha sin salir de la sesión.
   - Selector de ejercicios mediante **menú tipo hamburguesa animado** (`#live-ex-menu-wrap` / `#live-ex-menu`) con vista rápida de objetivo (`Obj SxR`), historial resumido y acceso a añadir ejercicio.
2. **Modo `Registrar hecho` (`src/views/LogWorkoutView.tsx`):**
   - Pensado para anotar sesiones ya finalizadas sin lanzar temporizadores en segundo plano ni interrumpir la captura manual.
   - El descanso es un dato opcional editable por el usuario si desea dejar constancia de él.

### 2.3 Reglas Obligatorias de Ergonomía Táctil (Móvil)

- **Tamaño mínimo táctil:** Todo botón, chip, enlace o control interactivo de uso frecuente debe alcanzar **`>= 44px × 44px`** (`min-h-[44px]` / `h-11`). En **controles primarios de `En vivo`** (steppers de `Peso`/`Reps` y check de serie en `SetRow.tsx`, más botones de `RestTimerBar.tsx` en ejecución), la altura mínima en móvil sube a **`>= 48px`** (`h-12` / `min-h-[48px]`) para operar con fatiga y sudor sin errores de pulsación.
- **Prevención de doble tap / zoom iOS:** Mantener `touch-action: manipulation` en controles táctiles y usar **`text-base sm:text-sm`** (`16px` en móvil, `14px` en escritorio) en todos los `<input>` numéricos y de texto.
- **Botones primarios claros:** Acciones de confirmación (`Terminar`, `Listo`, `Guardar`) con jerarquía inequívoca y separación física suficiente frente a acciones destructivas (`Descartar`, `Eliminar`).

### 2.4 Reglas de Escritorio, Tablas y Accesibilidad (A11y)

- Tablas de datos con **`table-fixed`** y alineación numérica consistente para evitar bailes horizontales al filtrar o cambiar de rango.
- Patrón **maestro-detalle sticky** en `DayRoutineView.tsx` (`DayMasterList` + `DayExerciseDetail`) y `PlanView.tsx`.
- Reordenación mediante **Pointer Events + FLIP** (`src/ui/reorder.ts`), acompañada siempre de controles alternativos accesibles (`↑` / `↓` o equivalentes) utilizables sin gestos de arrastre.
- **Jerarquía de encabezados (`<h1>`) y ARIA:** Garantizar un `<h1>` visible en escritorio y móvil (`activeTabTitle` en `MobileHeader.tsx` y encabezados principales de vista), `role="option"` + `aria-selected` en `role="listbox"` (`DayRoutineView.tsx`), navegación con flechas (`keyboardNav.ts`) en `role="tablist"`, y *focus trap* + retorno de foco al cerrar (`useFocusTrap.ts`) en los **6 modales** unificados en `State.activeModal` / `ModalHost.tsx`: `#confirm-modal`, `#ex-modal`, `#rt-modal`, `#note-modal`, `#wizard-modal` y `#workout-summary-modal`.
- **Diálogos consistentes:** Usar `#confirm-modal` (`askConfirm` -> `State.activeModal` en `ModalHost.tsx`) para toda confirmación destructiva o descarte, nunca `window.confirm()`.

### 2.5 Estados Vacíos, Carga, Error y Modo Offline

- **Primer uso y estados vacíos:** Si no hay historial previo, `HomeView.tsx` muestra `OnboardingHome` y la primera sesión dispara el asistente (`WizardModal.tsx`). Todas las tablas, gráficas y selectores filtrables deben ofrecer un mensaje claro y una acción directa (crear rutina, añadir primer ejercicio, registrar primera medida) en lugar de huecos en blanco.
- **Estados de carga sin saltos:** Operaciones asíncronas (`state.busy`, `state.syncing`, generación IA en `AiJobStatusBanner.tsx`) muestran progreso localizado y deshabilitan el disparador afectado, **sin desmontar la vista ni destruir el borrador o foco** de entrada.
- **Errores recuperables:** Errores de importación, IA o red se comunican en lenguaje claro vía `ToastBanner` o banner contextual (`AiJobStatusBanner` con botón de reintento, `SyncJob` con backoff exponencial en `syncController.ts`).
- **Modo sin conexión visible:** Dado el enfoque *offline-first*, los cambios locales se guardan siempre primero en IndexedDB / `localStorage`, y el estado real de red y cola pendiente (`Solo local`, `Offline · pendiente de subir`, `Sin conexión · caché offline`) se expone de forma visible en `MobileHeader.tsx` y `SidebarAccountFooter.tsx` mediante `syncStatusInfo()`.

### 2.6 Idioma, Unidades y Formato Numérico

- **Idioma único actual:** Interfaz y textos en **español (`es-ES`)**.
- **Unidades canónicas almacenadas y mostradas:** Peso corporal y carga en **`kg`** (tonelaje resumen en `t` a partir de `1000 kg`), perímetros y estatura en **`cm`**, energía en **`kcal`**, frecuencia cardíaca en **`lpm`** y descansos en **`s`**. Si en el futuro se añade soporte para libras (`lb`), será exclusivamente una capa de presentación y conversión sobre `kg` sin alterar el esquema almacenado.
- **Formato decimal:** Los textos e informes calculados muestran **coma decimal española** (`r1()`, e.g., `2,2 g/kg`). Los campos `<input type="number" inputMode="decimal">` aceptan tanto coma como punto en entrada del usuario (`num()` en `src/app/context.ts`).

---

## 3. Sistema de Diseño Visual y Antipatrones

### 3.1 Paleta Oficial — «Reloj GPS Polar» (`tailwind.config.js` + `src/style.css`)

La interfaz emplea tokens CSS dinámicos (`--c-*` en canales RGB en `src/style.css`) y soporta tres modos de apariencia persistidos en `Settings.theme` (`'dark' | 'light' | 'system'`, gestionados por `src/ui/theme.ts` y seleccionables en `Ajustes`):

| Token Tailwind | Oscuro (`dark`) | Claro (`light`) | Uso canónico |
| :--- | :--- | :--- | :--- |
| `bgDark` (`--c-bg`) | `#0A0D0E` *(Pizarra Mineral)* | `#F3F7F8` *(Hielo Claro)* | Lienzo principal de la aplicación y fondo base |
| `navDark` (`--c-nav`) | `#0E1214` | `#E8EFF1` | Cabecera móvil, barra inferior fija (`MobileNav`) y barra lateral (`Sidebar`) |
| `embedDark` (`--c-embed`) | `#101517` | `#EBF1F3` | Detalle embebido dentro de acordeones móviles (`DayMobileAccordion`) |
| `floatDark` (`--c-float`) | `#121719` | `#FFFFFF` | Capas flotantes transitorias (`LiveExerciseMenu`, `ExercisePickerSheet`) |
| `modalDark` (`--c-modal`) | `#121719` | `#FFFFFF` | Fondo de diálogos modales en `ModalHost` |
| `cardDark` (`--c-card`) | `#121719` | `#FFFFFF` | Superficie elevada reservada para bloques autónomos o panel maestro-detalle |
| `dragDark` (`--c-drag`) | `#181F22` | `#E0EAED` | Superficie temporal de elemento durante arrastre activo (`reorder.ts`) |
| `borderDark` (`--c-border`) | `#222B2E` | `#DCE5E7` | Bordes estructurales de contenedores, cabeceras, `.card` y `.tab` |
| `electricBlue` (`--c-accent`) | `#2DD4BF` *(Hielo Ártico)* | `#0F766E` *(Teal Polar)* | Acción primaria, foco activo, serie en curso y serie principal en gráficas |
| `--c-accent-fg` | `#0A0D0E` *(texto oscuro)* | `#FFFFFF` *(texto blanco)* | Texto e iconos sobre botones/badges sólidos de acento (`bg-electricBlue`, `.btn-primary`) |
| `emeraldGreen` (`--c-emerald`) | `#22C55E` | `#16A34A` | Deltas positivos reales (`+kg`, `+reps`, PR, adherencia) y serie completada |
| `amberGold` (`--c-amber`) | `#F59E0B` | `#D97706` | Consolidación intermedia, precaución o temporizador de aviso |
| `coralRed` (`--c-coral`) | `#F43F5E` | `#E11D48` | Error, acción destructiva, estancamiento o déficit crítico (`text-rose-300` en oscuro) |

- **Paleta de rutinas (`ROUTINE_COLORS` en `src/lib/seed.ts`):** `['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#06B6D4', '#6366F1', '#14B8A6', '#84CC16']`.
- **Paleta multi-serie en gráficas corporales (`PAL` en `src/store/bodyChartConfigs.ts`):** `['#2DD4BF', '#22C55E', '#F59E0B', '#A78BFA', '#38BDF8', '#94A3A8']`.

> **Regla de tokens:** Prohibido introducir códigos hexadecimales literales en clases Tailwind de `src/`. Usar únicamente los tokens semánticos definidos en `tailwind.config.js` y bordes `border-borderDark` / `border-white/10` / `border-white/15` (adaptados automáticamente en `html[data-theme="light"]`).

### 3.2 Semántica de Color y Reserva Estricta de `coralRed`

`coralRed` (`#F43F5E` / `#E11D48` y derivados `rose-*`) queda **reservado exclusivamente** para riesgo, error, alerta o borrado destructivo, y `emeraldGreen` (`#22C55E`) queda reservado para mejoras reales o progreso positivo:
- Acciones destructivas y confirmaciones críticas (`DataView.tsx`, `PlanView.tsx`, `SettingsView.tsx`, `LogExerciseCard.tsx`, `LiveHeader.tsx`, `ExerciseCard.tsx`).
- Alertas reales de análisis: volumen semanal bajo `< 8` series (`VolumeView.tsx`, `PlanView.tsx`), estancamiento/bajada (`StatusBadge.tsx`) y veredicto `'warning'` del Coach IA (`HomeView.tsx`).

**Directriz:** Todas las métricas fisiológicas neutras (`% Grasa`, `Pulso`, objetivo de proteína) y paletas categóricas de rutinas (`ROUTINE_COLORS`, `DAY_COLOR`) o perímetros (`PAL`) emplean acentos informativos no alarmantes sin `#F43F5E` ni `#EC4899`.

### 3.3 Regla Anti *Card-itis* y Jerarquía de Superficies

El ruido visual en móvil proviene de encerrar cada fila, input y cabecera dentro de múltiples cajas con bordes y fondos distintos.

1. **Plano por defecto:** El contenido principal descansa directamente sobre `bgDark` (`#0A0D0E` en oscuro / `#F3F7F8` en claro), estructurado mediante aire vertical y divisores horizontales `1px` (`border-b border-white/10`, `divide-y divide-white/5`).
2. **Prohibido anidar cards dentro de cards:** Nunca colocar una tarjeta redondeada con borde y fondo distinto dentro de otra tarjeta en flujos operativos (`LiveWorkoutView.tsx`, `LogWorkoutView.tsx`).
3. **Cuándo sí usar superficie elevada (`bg-cardDark` / `rounded-2xl` / `.card`):**
   - Capas flotantes o transitorias (`LiveExerciseMenu.tsx`, `ExercisePickerSheet.tsx`).
   - Modales y asistente de bienvenida (`ModalHost.tsx`, `WizardModal.tsx`).
   - Bloques narrativos autónomos diferenciados (`#ai-report` en `AiCoachPanel.tsx`).
   - Panel derecho de detalle en escritorio (`DayExerciseDetail.tsx` fuera de acordeón embebido).
   - Tarjetas discretas de selección única/múltiple (`PlanView.tsx`, `AiPreferencesSection.tsx`) o zona de peligro (`DataView.tsx`).

### 3.4 Tipografía y Contraste (`src/style.css`)

- **Tipografía base:** `Inter Variable` (`@fontsource-variable/inter`) con `antialiased` en `<body>` y pila monoespaciada para datos técnicos cuando corresponda.
- **Estabilidad numérica (`.num-col` / `tabular-nums`):** Obligatorio en pesos, repeticiones, tiempos de descanso, volúmenes, series completadas, porcentajes y celdas numéricas de tabla.
- **Ratios y contraste mínimo (WCAG 2.1 AA):** Todo texto normal debe alcanzar **`>= 4,5:1`** (y texto grande/iconografía activa **`>= 3:1`**). Usar como mínimo **`text-gray-400`** (`#94A3A8` en oscuro, `#4B5E65` en claro) para metadatos, subtítulos e instrucciones secundarias. **Prohibido introducir `text-gray-500`**. En botones/badges con fondo acento brillante en oscuro (`#2DD4BF`), usar texto oscuro (`#0A0D0E` vía `--c-accent-fg`).

### 3.5 Controles (`src/style.css`) y Prohibición de Nuevos `!important`

- Clases compartidas en `src/style.css`: `.card` (reservada estrictamente para los casos permitidos en §3.3, nunca como caja genérica ni anidada), `.btn`, `.btn-primary`, `.inp`, `.lbl`, `.tab` / `.tab-on`, `.nav-item` / `.nav-item-on` / `.nav-sec-lbl`, `.bnav-item` / `.bnav-item-on`, `.num-col`, `.chart-box`.
- Los inputs numéricos ocultan spinners nativos y los `<select>` mantienen contraste adaptativo (`rgb(var(--c-gray-100))` sobre `rgb(var(--c-card))`).
- **Tokens y clases base (`!`):** No añadir nuevos modificadores `!important` (`!`) de Tailwind sobre `.btn`, `.inp` o `.tab`; utilizar las variantes limpias de `src/style.css` (ej. `.btn-sm`, `.btn-accent`, `.btn-danger`, `.icon-btn`).

### 3.6 Iconografía (`src/components/common/Icon.tsx` y `src/ui/icons.ts`)

- Todos los iconos funcionales de interfaz usan SVG de **Phosphor Icons Bold** (`viewBox="0 0 256 256"`) renderizados mediante `<Icon name={...} />` desde `ICON_PATHS`.
- **Prohibido usar emojis como iconos de navegación o acción** en la UI de aplicación.
- No mantener iconos muertos en `icons.ts`.

### 3.7 Gráficas (`Chart.js` con `<ChartCanvas />` y `src/ui/shared.ts`)

- Renderizar todas las gráficas de forma declarativa con **`<ChartCanvas config={...} />`** (`src/components/common/ChartCanvas.tsx`), apoyado en **`normalizeChartConfig()`** (`src/ui/shared.ts`) y observando `data-theme` para adaptarse automáticamente entre oscuro y claro.
- **Sin arcoíris:** La serie principal (peso máx., tendencia 7d, horas de sueño o volumen por músculo) usa el color de acento (`chartAccentColor()`: `#2DD4BF` en oscuro / `#0F766E` en claro); las series de referencia o densidad (tonelaje o peso diario) usan gris mineral discontinuo (`#94A3A8`).
- **Un eje `y` por defecto:** Mantener una sola escala vertical salvo cuando convivan magnitudes de distinta unidad (por ejemplo, `y` en `kg` y `y1` en `% grasa` o `HRV`).
- Respetar `<RangePicker />`, `resolveRange()`, `inRange()` y medias móviles (`movingAverage7d()`).

### 3.8 Animaciones y Microinteracciones

- Los paneles desplegables y menús contextuales deben animar altura mediante **`grid-template-rows` (`grid-rows-[0fr]` -> `grid-rows-[1fr]`)** + transición de opacidad sobre contenedor interno `overflow-hidden`, **sin desmontar el nodo** ni provocar saltos bruscos de layout (patrón aplicado en `#live-ex-menu-wrap` de `src/components/workout/LiveExerciseMenu.tsx`).
- Toda animación o transición nueva —incluidas las transiciones FLIP en `src/ui/reorder.ts`— debe respetar **`prefers-reduced-motion: reduce`**.

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
- El catálogo base `CATALOG_EXERCISES` (`src/lib/seed.ts`) cuenta con **57 ejercicios** (además de personalizados e importados), situando la selección de ejercicios en el tramo **50+**: usa un selector filtrable con búsqueda instantánea NFD y sugerencias rápidas/recientes arriba en `En vivo` (`ExercisePickerSheet.tsx`), `Registrar hecho` y planificación.
- En móvil, prioriza bottom sheets de 44 px mínimo; en escritorio, popovers o paneles maestro-detalle.
- Mantén el lienzo plano, evita radio-cards anidadas y no introduzcas AI glow, glassmorphism,
  bento grids forzados ni gráficas decorativas.
- La búsqueda debe actualizar solo la lista, preservar el foco y no reconstruir `#app`.

---

## 4. Arquitectura, Persistencia y Reglas de Estado

### 4.1 Mapa de Módulos y Fronteras Estrictas (Arquitectura Preact)

```text
src/types.ts  (contratos de dominio puros, cero dependencias de runtime)
    ▲
    ├── src/lib/*         (db, sync, firebase, samsung, samsungWorker, measures, analysis, ai, seed)
    │       ▲             · PROHIBIDO importar UI o tocar el DOM
    │       │
    ├── src/app/*         (context, syncController)
    │       ▲             · Infraestructura de borradores, auth, sync y orquestación de trabajos
    │       │
    ├── src/store/* &     (types, navigation, appStore, *Selectors, *ChartConfigs, *Actions,
    │   src/hooks/*        useRestTimer, useFocusTrap)
    │       ▲             · Estado tipado (ActiveModal unificado), selectores puros, cero acceso al DOM
    │       │
    ├── src/components/*  (common/, layout/, modals/, home/, day/, log/, plan/, workout/, body/, calc/, settings/)
    │   + src/views/*     · 11 vistas y componentes Preact .tsx <= 150 líneas (TSDoc y Props explícitas)
    │   + src/ui/*        · Utilidades puras compartidas (shared, icons, selection, reorder, keyboardNav)
    │       ▲
    └── src/main.ts       (punto de entrada: monta AppShell y conecta syncController, IndexedDB y Firebase)
```

- **Carga diferida y Workers:**
  - `src/lib/ai.ts` se importa dinámicamente bajo demanda en `src/main.ts` para no penalizar el arranque inicial.
  - La descompresión e importación pesada de Samsung Health (`fflate` + `papaparse`) se ejecuta en `src/lib/samsungWorker.ts` fuera del hilo principal.
  - En `vite.config.ts`, `rolldownOptions.codeSplitting` separa `firebase-firestore`, `firebase-auth` y `charts`.

### 4.2 Capas de Persistencia y Sincronización

| Capa | Módulos | Qué almacena | Regla clave |
| :--- | :--- | :--- | :--- |
| **IndexedDB (`gymapp` v2)** | `src/lib/db.ts` | 5 *object stores* con el histórico local (fuerza, cardio, bienestar, medidas, ajustes/estado) | Fuente de verdad local *offline-first* |
| **`localStorage`** | `src/app/context.ts`, `src/lib/sync.ts`, `src/main.ts` | Borradores activos (`LogDraft`, `LiveWorkout`) y metadatos de sync | Nunca almacenar secretos ni datos masivos históricos |
| **Cloud Firestore** | `src/lib/sync.ts`, `src/lib/firebase.ts` | Configuración (`settings`) y `buckets` (`items`/`deleted` por `{kind}_{year\|all}`) por `uid` | Protegido por `firestore.rules` (solo propietario con email verificado) |

#### Invariantes de Esquema en `firestore.rules` y Sincronización (`src/lib/sync.ts`)

Cualquier cambio en `Settings`, rutinas, fases o buckets de sincronización **exige revisar `firestore.rules`** (mediante el subagente `firestore-rules-author`) y validar `tests/sync.test.ts` + `tests/security.test.ts`:
- Propiedad estricta por `uid` autenticado con correo verificado.
- `routines`: mínimo `1`, máximo `20` rutinas; mapas auxiliares `<= 500`; `phases <= 100`.
- `buckets`: colecciones `items` y `deleted` con máximo `5000` entradas (`cardio_all`, `measures_all`, `strength_<YYYY|legacy>`, `wellbeing_<YYYY|legacy>`).
- Marcas temporales en milisegundos epoch con margen máximo de `+24h` por desfase de reloj; los tombstones tienen TTL de 90 días.
- Campo `kind` inmutable en documentos de sincronización; regla `deny` por defecto al final de `firestore.rules`.
- Campo legacy opcional `geminiKey` acotado a `<= 256` caracteres únicamente en `firestore.rules` (en `src/` ya no existe y `sanitizeSettings()` lo descarta; pendiente de retirada definitiva en §5.4).
- **Saneamiento y limpieza de sesión:** toda escritura o ingesta de `Settings` (incluyendo pulls remotos en `sync.ts` e importaciones en `main.ts`) debe pasar por `sanitizeSettings()`, un `remote wipe` debe limpiar tanto `gymapp_log_draft` como `gymapp_live_workout`, y los lotes `writeBatch(fs)` deben respetar el límite de 500 operaciones de Firestore.

#### Estado visible de sincronización, conflictos e IA

- **Indicador visible de sync (`syncStatusInfo()` en `src/store/navigation.ts`):** muestra de forma uniforme en `MobileHeader.tsx`, `SidebarAccountFooter.tsx` y `AccountSyncSection.tsx` los estados `Solo local` / `Sin conexión · local`, `Sincronizando…`, `Sincronizado`, `Pendiente de sincronizar` / `Offline · pendiente de subir` y `Error de sincronización · reintentando` (con hora del próximo reintento en `AccountSyncSection`).
- **Resolución de conflictos (`src/lib/sync.ts`):**
  - En buckets (`mergeBucket`), las colecciones `strength`, `cardio` y `measures` aplican estrategia *Last-Write-Wins* por clave y timestamp local vs `remoteBucket.updatedAt`, respetando *tombstones* (TTL 90 días) salvo edición local posterior. `wellbeing` fusiona campos diarios preservando los campos modificados más recientes de cada dispositivo.
  - En ajustes (`mergeSyncSettings`), ante conflicto concurrente prevalece el documento más reciente salvo en mapas auxiliares locales (`customNames`, `refNames`, `aliases`, `notes`, `muscles`), cuyas claves locales se conservan y se notifica mediante `toast`.
  - Si cambia el `uid` autenticado o llega un `wipedAt` remoto más reciente, se limpia IndexedDB y los borradores activos locales antes de sincronizar para impedir mezclar datos entre cuentas.
- **Coach IA (`src/lib/ai.ts`):** se invoca desde cliente usando **Firebase AI Logic** (`firebase/ai` con `GoogleAIBackend` vinculado a la app autenticada), sin guardar claves API de IA en el cliente, `localStorage` ni Firestore.

### 4.3 Regla Crítica de Fechas Locales

- Para generar o comparar la fecha del día actual del usuario, utilizar **`todayIso()`** en `src/lib/seed.ts` (calculada en hora local).
- **Prohibido usar `new Date().toISOString().slice(0, 10)` directamente** para fechas de entrenamiento o bienestar del usuario, ya que provoca saltos de día en zonas horarias distintas de UTC cerca de medianoche (solo aceptable en manipulaciones de rangos ISO ya normalizados).

### 4.4 Ciclo de Render, Foco y Estado Reactivo (`Preact`)

- Todas las vistas y modales renderizan declarativamente mediante **Preact (`src/store/appStore.tsx`)** sin reconstruir `#app`:
  - El foco de `<input>` y botones se mantiene entre actualizaciones por diferenciación de Virtual DOM.
  - Las gráficas se gestionan en `<ChartCanvas />` actualizando datos sin recrear innecesariamente el `<canvas>` y destruyendo instancias limpiamente al desmontar.
  - El cronómetro de descanso (`useRestTimer`) aísla el tick por segundo dentro de `RestTimerBar` y de los indicadores de navegación sin provocar re-renders de toda la pantalla.
  - Los 6 modales comparten `State.activeModal` dentro de `ModalHost` con captura y retorno de foco en `useFocusTrap`.

---

## 5. Seguridad, Calidad, Verificación y Hoja de Ruta

### 5.1 Reglas de Seguridad y Calidad de Código

- **Prevención XSS:** Todo contenido textual dinámico (nombres de rutinas, ejercicios, notas, CSV importados, errores) se renderiza mediante nodos JSX de Preact (con escape automático y sin `dangerouslySetInnerHTML`), acompañado del saneado de `fmtDate()` / `short()` en `src/ui/shared.ts`.
- **Validación en fronteras externas:** Sanitizar entradas en importación JSON/CSV (`parseBackup`, prevención de contaminación de prototipos, limpieza con `stripUndefined` antes de persistir/sincronizar en Firestore).
- **CSP (`firebase.json`):** Mantener compatibles los scripts, estilos y Web Workers con la cabecera CSP (`default-src 'self'`, `worker-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `style-src 'self' 'unsafe-inline'`, `COOP same-origin-allow-popups`, `X-Frame-Options DENY`).
- **IA sin claves persistidas:** El acceso a Gemini se realiza mediante **Firebase AI Logic** (`firebase/ai`), sin almacenar ni sincronizar API keys en cliente ni Firestore.
- **Calidad de código:** Funciones pequeñas, retorno temprano, cero helpers *passthrough* triviales y evitar programación defensiva redundante sobre tipos internos ya garantizados por TypeScript.

### 5.2 Comandos de Verificación

Ejecutar desde la raíz del repositorio:

```bash
# Suite de tests unitarios y contratos (Vitest: tests/features.test.ts, integration.test.ts, sync.test.ts, security.test.ts, parsers.test.ts)
npm test

# Comprobación estricta de tipos TypeScript + bundle de producción (tsc --noEmit && vite build)
npm run build
```

Cobertura mínima verificada en `tests/`:
- **Dominio, fechas locales y sanitización:** `todayIso()` sin desfase UTC y `sanitizeSettings()` / `parseBackup()` en `tests/features.test.ts`, `tests/integration.test.ts` y `tests/security.test.ts`.
- **Sincronización y reglas:** resolución de conflictos, tombstones, limpieza de sesión y reglas Firestore en `tests/sync.test.ts` y `tests/security.test.ts`.
- **Renderizado Preact, selectores y ergonomía:** renderizado aislado con `preact-render-to-string` en `tests/features.test.ts` (roles ARIA, controles táctiles y paletas).

Todo cambio con impacto visual o interactivo debe verificarse también en navegador en viewport móvil (`~390px`) y escritorio (`~1440px`), prestando especial atención al flujo completo en `Entrenar` (`En vivo` y `Registrar hecho`) y al comportamiento sin errores en consola.

### 5.3 Historial de Deuda Resuelta

Los bloques de refactorización de auditoría v2 y migración a Preact han quedado completados:

- **Bloque 1 (PWA / Offline, Sync e Integridad):** migración de `registerType` a `'prompt'` con banner de actualización controlada, saneamiento `sanitizeSettings()` en ingestas y pulls, limpieza de `gymapp_live_workout` en wipe/cambio de cuenta, troceo de batches en Firestore y sustitución de `confirm()` nativo por `#confirm-modal`.
- **Bloque 2 (Ergonomía táctil, Tokens, Contraste y Accesibilidad):** tokens de superficie en `tailwind.config.js`, sistema de botones `.btn-sm` / `.btn-danger` / `.icon-btn`, mínimo `text-gray-400`, desacople semántico de `coralRed`, áreas táctiles `>= 44 px` globales y `>= 48 px` en controles primarios de `En vivo`, `<h1>` accesible en escritorio, navegación por teclado en `[role="tablist"]`, `role="option"` en `listbox` y *focus trap* modal + `prefers-reduced-motion` en FLIP.
- **Bloque 3 (Gráficas, Modularización, Limpieza y Tests):** reutilización de instancias `Chart.js` sin recrear el `<canvas>`, separación entre Peso y Masa muscular en composición corporal, eliminación de iconos muertos y `geminiKey` en cliente, y cobertura completa de `parsers.test.ts` con fixtures sintéticos.
- **Bloque D (Migración Preact completa):** retirada de `LegacyViewBridge`, adaptadores SSR en `src/ui/`, `domPatches.ts` y controladores legacy (`planController.ts`, `workoutController.ts`, `importController.ts`); unificación total de modales en `State.activeModal` y `<ModalHost />`; eliminación de atributos legacy `data-*`; división modular de `src/store/`, `src/hooks/`, `src/components/` y `src/views/` (`<= 150` líneas por archivo); y migración completa de la suite de tests a Preact.

### 5.4 Hoja de Ruta Pendiente

1. **Retirada definitiva de `geminiKey` en `firestore.rules`:** eliminar la clave legacy opcional de `isValidSettingsPayload` (mediante el subagente `firestore-rules-author`) tras completar la migración de cuentas antiguas.
2. **Descanso con pantalla bloqueada en móvil:** evaluar **Screen Wake Lock API** opcional durante sesiones `En vivo` y/o notificación local cuando el Service Worker o la app vuelve de segundo plano al vencer `restUntil`.
3. **Auditoría automática de accesibilidad:** incorporar chequeos automatizados (`axe-core`) sobre vistas clave en verificación E2E/CI para validar contraste y roles ARIA de forma continua.
4. **Soporte opcional de unidades (`lb`):** valorar selector de unidad visual manteniendo `kg` como unidad canónica almacenada en IndexedDB y Cloud Firestore.
