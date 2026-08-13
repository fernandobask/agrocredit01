import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(configStr);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Logado como:", cred.user.uid);
    const snap = await getDocs(collection(db, "simulations"));
    console.log(`TOTAL DE CONTRATOS SALVOS: ${snap.size}`);
  } catch (err) {
    console.error("Erro:", err.message);
  }
  process.exit(0);
}
check();
