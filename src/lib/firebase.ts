import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBu-detgpetWeXCyyinNLXmzDR_zDUYF1M',
  authDomain: 'rackmark.web.app',
  projectId: 'gymapp-vbg',
  storageBucket: 'gymapp-vbg.firebasestorage.app',
  messagingSenderId: '205930773826',
  appId: '1:205930773826:web:bea9f93fe9ba1337f1dcdb',
  measurementId: 'G-R0BCZCJS64',
};

export const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const fs = getFirestore(app);

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() || '';

if (typeof window !== 'undefined' && recaptchaSiteKey) {
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN !== 'false') {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export type CloudUser = Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL' | 'emailVerified'>;

function toCloudUser(u: User | null): CloudUser | null {
  return u
    ? { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL, emailVerified: u.emailVerified }
    : null;
}

export async function signInGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function signInEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signUpEmail(email: string, password: string, displayName = ''): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = displayName.trim().slice(0, 60);
  if (cleanName) {
    try {
      await updateProfile(cred.user, { displayName: cleanName });
    } catch {
      /* si falla el perfil inicial, el correo y uid siguen creados */
    }
  }
  try {
    await sendEmailVerification(cred.user);
  } catch {
    /* El usuario puede reenviar el correo desde Ajustes si falla el envío inicial */
  }
  return cred.user;
}

export async function resetPasswordEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(): Promise<void> {
  if (auth.currentUser && !auth.currentUser.emailVerified) {
    await sendEmailVerification(auth.currentUser);
  }
}

export async function reloadCurrentUser(): Promise<CloudUser | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return toCloudUser(auth.currentUser);
}

export function isRecentSignIn(maxAgeMs = 4 * 60 * 1000): boolean {
  const raw = auth.currentUser?.metadata.lastSignInTime;
  const ts = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(ts) && Date.now() - ts <= maxAgeMs;
}

export function isGoogleAuthUser(): boolean {
  return Boolean(auth.currentUser?.providerData.some((p) => p.providerId === 'google.com'));
}

export async function reauthenticateGoogle(): Promise<void> {
  if (!auth.currentUser) return;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await reauthenticateWithPopup(auth.currentUser, provider);
}

export async function deleteCurrentUser(): Promise<void> {
  if (auth.currentUser) await deleteUser(auth.currentUser);
}

export async function consumeRedirectAuth(): Promise<{ user: User | null; error?: string }> {
  try {
    const cred = await getRedirectResult(auth);
    return { user: cred?.user ?? null };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return { user: null };
    return { user: null, error: (err as Error)?.message || 'No se pudo completar el inicio de sesión.' };
  }
}
export const signOutGoogle = () => signOut(auth);
export const subscribeAuth = (cb: (user: CloudUser | null) => void) =>
  onAuthStateChanged(auth, (u) => cb(toCloudUser(u)));
