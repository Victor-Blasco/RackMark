import type { AthleteProfile } from '../../types';

interface AthleteProfileSectionProps {
  /** Perfil biométrico y objetivo actual del usuario. */
  profile: AthleteProfile;
  /** Abre el asistente guiado inicial en 3 pasos. */
  onOpenWizard: () => void;
  /** Actualiza el sexo biológico de referencia. */
  onChangeSex: (sex: string) => void;
  /** Valida y guarda la edad introducida. */
  onChangeAge: (raw: string) => void;
  /** Valida y guarda la altura en cm. */
  onChangeHeight: (raw: string) => void;
  /** Actualiza el objetivo de entrenamiento seleccionado. */
  onChangeGoal: (val: string) => void;
  /** Actualiza el nivel de experiencia. */
  onChangeExperience: (val: string) => void;
  /** Actualiza la disponibilidad de días semanales. */
  onChangeDays: (raw: string) => void;
}

const DAY_CHOICES = [2, 3, 4, 5, 6];

/**
 * Formulario de perfil del atleta utilizado en estimaciones energéticas e informes IA.
 */
export function AthleteProfileSection({
  profile,
  onOpenWizard,
  onChangeSex,
  onChangeAge,
  onChangeHeight,
  onChangeGoal,
  onChangeExperience,
  onChangeDays,
}: AthleteProfileSectionProps) {
  const customSex = Boolean(profile.sex && profile.sex !== 'hombre' && profile.sex !== 'mujer');

  return (
    <div class="space-y-3">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="font-bold text-white">Perfil del atleta</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            Se utiliza para calcular tu gasto energético diario y contextualizar el informe de IA.
          </p>
        </div>
        <button type="button" class="btn-sm btn-accent" onClick={onOpenWizard}>
          Asistente inicial
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="block">
          <span class="lbl">Sexo</span>
          <select class="inp" value={profile.sex} onChange={(e) => onChangeSex(e.currentTarget.value)}>
            <option value="hombre" selected={profile.sex === 'hombre'}>Hombre</option>
            <option value="mujer" selected={profile.sex === 'mujer'}>Mujer</option>
            {customSex && <option value={profile.sex} selected>{profile.sex}</option>}
          </select>
        </label>
        <label class="block">
          <span class="lbl">Edad</span>
          <input
            class="inp tabular-nums font-medium"
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            min="12"
            max="110"
            value={profile.age}
            onChange={(e) => onChangeAge(e.currentTarget.value)}
          />
        </label>
        <label class="block">
          <span class="lbl">Altura (cm)</span>
          <input
            class="inp tabular-nums font-medium"
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            min="100"
            max="250"
            value={profile.height}
            onChange={(e) => onChangeHeight(e.currentTarget.value)}
          />
        </label>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="block">
          <span class="lbl">Objetivo</span>
          <select class="inp" value={profile.goal ?? ''} onChange={(e) => onChangeGoal(e.currentTarget.value)}>
            <option value="" selected={!profile.goal}>Sin definir</option>
            <option value="bulk" selected={profile.goal === 'bulk'}>Ganar músculo</option>
            <option value="cut" selected={profile.goal === 'cut'}>Definición</option>
            <option value="recomp" selected={profile.goal === 'recomp'}>Perder grasa y ganar músculo</option>
            <option value="strength" selected={profile.goal === 'strength'}>Fuerza máxima</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Experiencia</span>
          <select class="inp" value={profile.experience ?? ''} onChange={(e) => onChangeExperience(e.currentTarget.value)}>
            <option value="" selected={!profile.experience}>Sin definir</option>
            <option value="beginner" selected={profile.experience === 'beginner'}>Principiante (&lt;1 año)</option>
            <option value="intermediate" selected={profile.experience === 'intermediate'}>Intermedio (1–3 años)</option>
            <option value="advanced" selected={profile.experience === 'advanced'}>Avanzado (+3 años)</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Días / semana</span>
          <select
            class="inp tabular-nums"
            value={profile.daysPerWeek != null ? String(profile.daysPerWeek) : ''}
            onChange={(e) => onChangeDays(e.currentTarget.value)}
          >
            <option value="" selected={!profile.daysPerWeek}>Sin definir</option>
            {DAY_CHOICES.map((d) => (
              <option key={d} value={String(d)} selected={profile.daysPerWeek === d}>{d} días</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
