import { initializeApp } from 'firebase/app';
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
  authDomain: 'gymapp-vbg.firebaseapp.com',
  projectId: 'gymapp-vbg',
  storageBucket: 'gymapp-vbg.firebasestorage.app',
  messagingSenderId: '205930773826',
  appId: '1:205930773826:web:bea9f93fe9ba1337f1dcdb',
  measurementId: 'G-R0BCZCJS64',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const fs = getFirestore(app);

export type CloudUser = Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL'>;

export function toCloudUser(u: User | null): CloudUser | null {
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

export const consumeRedirectAuth = () => getRedirectResult(auth).catch(() => null);
export const signOutGoogle = () => signOut(auth);
export const subscribeAuth = (cb: (user: CloudUser | null) => void) =>
  onAuthStateChanged(auth, (u) => cb(toCloudUser(u)));
