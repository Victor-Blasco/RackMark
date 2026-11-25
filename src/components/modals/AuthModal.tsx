import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../common/Icon';
import { ModalShell } from '../common/ModalShell';
import { EmailAuthForm } from '../settings/EmailAuthForm';

type AuthModalMode = 'login' | 'signup' | 'reset';

interface AuthModalProps {
  /** Modo inicial al abrir el modal (`login` por defecto). */
  initialMode?: AuthModalMode;
  /** Deshabilita los controles mientras hay una sincronización en curso. */
  disabled?: boolean;
  /** Inicia sesión / registra usando Google. */
  onGoogleLogin: () => void;
  /** Inicia sesión con correo y contraseña. */
  onEmailLogin: (email: string, password: string) => Promise<boolean>;
  /** Crea cuenta con nombre, correo y contraseña. */
  onEmailSignUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  /** Envía enlace de recuperación de contraseña. */
  onResetPassword: (email: string) => Promise<boolean>;
  /** Cierra el modal. */
  onClose: () => void;
}

const HEADER_COPY: Record<AuthModalMode, { title: string; subtitle: string }> = {
  login: {
    title: 'Iniciar sesión',
    subtitle: 'Sincroniza tus entrenamientos entre dispositivos y activa el Coach IA.',
  },
  signup: {
    title: 'Crear cuenta',
    subtitle: 'Guarda tus rutinas y medidas en la nube con Google o correo.',
  },
  reset: {
    title: 'Recuperar contraseña',
    subtitle: 'Te enviaremos un enlace a tu correo para restablecer el acceso.',
  },
};

/**
 * Modal unificado de inicio de sesión, registro y recuperación de cuenta.
 */
export function AuthModal({
  initialMode = 'login',
  disabled,
  onGoogleLogin,
  onEmailLogin,
  onEmailSignUp,
  onResetPassword,
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const copy = HEADER_COPY[mode];

  return (
    <ModalShell id="auth-modal" labelledBy="authModalTitle" panelClass="max-w-md border-white/10" onClose={onClose}>
      <div class="p-5 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 id="authModalTitle" class="text-base font-extrabold text-white">{copy.title}</h3>
            <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">{copy.subtitle}</p>
          </div>
          <button type="button" aria-label="Cerrar modal" class="icon-btn shrink-0" onClick={onClose}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {mode !== 'reset' && (
          <button
            type="button"
            class="btn-primary w-full min-h-[44px]"
            disabled={disabled}
            onClick={onGoogleLogin}
          >
            <Icon name="login" className="h-4 w-4" /> Continuar con Google
          </button>
        )}

        <EmailAuthForm
          initialMode={mode}
          disabled={disabled}
          onModeChange={setMode}
          onEmailLogin={onEmailLogin}
          onEmailSignUp={onEmailSignUp}
          onResetPassword={onResetPassword}
        />
      </div>
    </ModalShell>
  );
}
