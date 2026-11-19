import type { State } from '../ui/shared';

/** Dependencias para actualizar perfil del atleta y calculadoras. */
export interface ProfileActionDeps {
  getState: () => State;
  persist: () => Promise<void>;
  render: () => void;
  toast: (msg: string) => void;
}

/**
 * Crea las acciones inmutables del formulario `Perfil del atleta` y las calculadoras 1RM/macros.
 *
 * @param deps - Puentes al estado, persistencia en ajustes y avisos al usuario.
 * @returns Manejadores tipados de perfil biométrico y parámetros de cálculo.
 */
export function createProfileActions(deps: ProfileActionDeps) {
  const state = () => deps.getState();

  const patchProfile = async (
    updater: (cur: State['settings']['profile']) => State['settings']['profile'],
  ) => {
    const S = state();
    S.settings = {
      ...S.settings,
      profile: updater(S.settings.profile),
    };
    await deps.persist();
  };

  return {
    async updateProfileSex(sex: string) {
      await patchProfile((cur) => ({ ...cur, sex }));
    },

    async updateProfileAge(raw: string) {
      const n = Math.round(Number(raw));
      if (!Number.isFinite(n) || n < 12 || n > 110) {
        deps.toast('Edad inválida (12–110 años).');
        deps.render();
        return;
      }
      await patchProfile((cur) => ({ ...cur, age: n }));
    },

    async updateProfileHeight(raw: string) {
      const n = Math.round(Number(raw));
      if (!Number.isFinite(n) || n < 100 || n > 250) {
        deps.toast('Altura inválida (100–250 cm).');
        deps.render();
        return;
      }
      await patchProfile((cur) => ({ ...cur, height: n }));
    },

    async updateProfileGoal(val: string) {
      await patchProfile((cur) => {
        if (val === 'bulk' || val === 'cut' || val === 'recomp' || val === 'strength') {
          return { ...cur, goal: val };
        }
        const { goal: _removed, ...rest } = cur;
        return rest;
      });
    },

    async updateProfileExperience(val: string) {
      await patchProfile((cur) => {
        if (val === 'beginner' || val === 'intermediate' || val === 'advanced') {
          return { ...cur, experience: val };
        }
        const { experience: _removed, ...rest } = cur;
        return rest;
      });
    },

    async updateProfileDays(raw: string) {
      const n = Number(raw);
      await patchProfile((cur) => {
        if (Number.isFinite(n) && n >= 1 && n <= 7) {
          return { ...cur, daysPerWeek: Math.round(n) };
        }
        const { daysPerWeek: _removed, ...rest } = cur;
        return rest;
      });
    },

    applyCalcPreset(raw: string) {
      const [w, r] = raw.split('|');
      const S = state();
      S.calcDraft = { ...S.calcDraft, w, r };
      deps.render();
    },

    updateCalcField(
      field: 'w' | 'r' | 'rir' | 'act' | 'goal' | 'protein' | 'fat' | 'meals',
      value: string,
    ) {
      const S = state();
      S.calcDraft = { ...S.calcDraft, [field]: value };
      deps.render();
    },
  };
}
