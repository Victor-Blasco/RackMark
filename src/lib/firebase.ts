import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
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

let appCheckInstance: AppCheck | undefined;
if (typeof window !== 'undefined' && recaptchaSiteKey) {
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN !== 'false') {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export type CloudUser = Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL'>;

function toCloudUser(u: User | null): CloudUser | null {
  return u ? { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL } : null;
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
