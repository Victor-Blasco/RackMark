import { useEffect, useState } from 'preact/hooks';

type EmailAuthMode = 'login' | 'signup' | 'reset';

interface EmailAuthFormProps {
  /** Deshabilita los controles mientras hay una operación de cuenta en curso. */
  disabled?: boolean;
  /** Modo inicial del formulario (`login`, `signup` o `reset`). */
  initialMode?: EmailAuthMode;
  /** Notifica cambios de modo al contenedor padre. */
  onModeChange?: (mode: EmailAuthMode) => void;
  /** Inicia sesión con correo y contraseña. */
  onEmailLogin: (email: string, password: string) => Promise<boolean>;
  /** Crea una nueva cuenta con nombre, correo y contraseña. */
  onEmailSignUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  /** Envía un correo de recuperación de contraseña. */
  onResetPassword: (email: string) => Promise<boolean>;
}

const MODE_LABELS: Record<EmailAuthMode, string> = {
  login: 'Entrar con correo',
  signup: 'Crear cuenta con correo',
  reset: 'Enviar enlace de recuperación',
};

/**
 * Formulario compacto para iniciar sesión, crear cuenta o recuperar contraseña por correo.
 */
export function EmailAuthForm({
  disabled,
  initialMode = 'login',
  onModeChange,
  onEmailLogin,
  onEmailSignUp,
  onResetPassword,
}: EmailAuthFormProps) {
  const [mode, setMode] = useState<EmailAuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setLocalError(null);
  }, [initialMode]);

  const busy = Boolean(disabled || submitting);

  function switchMode(next: EmailAuthMode) {
    setMode(next);
    setLocalError(null);
    onModeChange?.(next);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (mode === 'signup' && cleanName.length < 2) {
      setLocalError('Introduce tu nombre (al menos 2 caracteres).');
      return;
    }
    if (!cleanEmail?.includes('@')) {
      setLocalError('Introduce un correo electrónico válido.');
      return;
    }
    if (mode !== 'reset' && password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      const ok =
        mode === 'login'
          ? await onEmailLogin(cleanEmail, password)
          : mode === 'signup'
            ? await onEmailSignUp(cleanEmail, password, cleanName)
            : await onResetPassword(cleanEmail);
      if (ok && mode === 'reset') switchMode('login');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form class="space-y-3 border-t border-white/10 pt-3" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <p class="text-xs font-semibold text-gray-300">
        {mode === 'login' ? 'O entra con tu correo' : mode === 'signup' ? 'O regístrate con tu correo' : 'Recuperar contraseña'}
      </p>

      <div class="space-y-2.5">
        {mode === 'signup' && (
          <div>
            <label for="email-auth-name" class="block text-xs text-gray-400 mb-1">Nombre</label>
            <input id="email-auth-name" type="text" autoComplete="name" maxLength={60} placeholder="Tu nombre" class="inp w-full min-h-[44px] text-base sm:text-sm" value={name} disabled={busy} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
          </div>
        )}

        <div>
          <label for="email-auth-email" class="block text-xs text-gray-400 mb-1">Correo electrónico</label>
          <input id="email-auth-email" type="email" autoComplete="email" placeholder="tu@correo.com" class="inp w-full min-h-[44px] text-base sm:text-sm" value={email} disabled={busy} onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)} />
        </div>

        {mode !== 'reset' && (
          <div>
            <label for="email-auth-password" class="block text-xs text-gray-400 mb-1">
              Contraseña {mode === 'signup' ? '(mín. 6 caracteres)' : ''}
            </label>
            <input id="email-auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} placeholder="••••••" class="inp w-full min-h-[44px] text-base sm:text-sm" value={password} disabled={busy} onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} />
          </div>
        )}
      </div>

      {localError && <p role="alert" class="text-xs text-rose-300">{localError}</p>}

      <button type="submit" class="btn w-full min-h-[44px]" disabled={busy}>
        {submitting ? 'Procesando…' : MODE_LABELS[mode]}
      </button>

      <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
        {mode === 'login' ? (
          <>
            <button type="button" class="min-h-[44px] sm:min-h-[36px] text-gray-300 hover:text-white underline underline-offset-4" disabled={busy} onClick={() => switchMode('signup')}>
              Crear cuenta
            </button>
            <button type="button" class="min-h-[44px] sm:min-h-[36px] text-gray-400 hover:text-white underline underline-offset-4" disabled={busy} onClick={() => switchMode('reset')}>
              ¿Olvidaste tu contraseña?
            </button>
          </>
        ) : (
          <button type="button" class="min-h-[44px] sm:min-h-[36px] text-gray-300 hover:text-white underline underline-offset-4" disabled={busy} onClick={() => switchMode('login')}>
            Volver a iniciar sesión
          </button>
        )}
      </div>
    </form>
  );
}
