import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  signOut, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;

export const loginAnonymously = async () => {
  return await signInAnonymously(auth);
};

export const loginAnonymouslyWithName = async (name: string = "Analista Financeiro") => {
  const userCredential = await signInAnonymously(auth);
  if (userCredential.user) {
    try {
      await updateProfile(userCredential.user, { displayName: name });
    } catch (e) {
      console.warn("Não foi possível atualizar o nome do perfil anônimo:", e);
    }
  }
  return userCredential;
};

export const loginWithEmail = async (email: string, pass: string) => {
  try {
    return await signInWithEmailAndPassword(auth, email, pass);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      // Auto register if user doesn't exist
      const newCred = await createUserWithEmailAndPassword(auth, email, pass);
      const nameFromEmail = email.split('@')[0];
      const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
      await updateProfile(newCred.user, { displayName: formattedName });
      return newCred;
    }
    throw err;
  }
};

export const registerWithEmail = async (email: string, pass: string, name: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  if (userCredential.user && name) {
    await updateProfile(userCredential.user, { displayName: name });
  }
  return userCredential;
};

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return result;
  } catch (error: any) {
    console.warn("Erro no login Google Popup:", error);
    throw error;
  }
};

export const checkRedirectLoginResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }
      return result;
    }
  } catch (err) {
    console.error("Erro ao checar resultado de redirecionamento:", err);
  }
  return null;
};

export const getAccessToken = () => cachedAccessToken;

export const logout = () => {
  cachedAccessToken = null;
  return signOut(auth);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
