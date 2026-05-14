import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
//  Reemplazá los valores de abajo con tu configuración Firebase
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAi5Uk9YVzEF6Bno-Ukyti1hO_rSbiLGWk",
  authDomain:        "visitas-sr.firebaseapp.com",
  projectId:         "visitas-sr",
  storageBucket:     "visitas-sr.firebasestorage.app",
  messagingSenderId: "254847060930",
  appId:             "1:254847060930:web:9449269d6eaec39660a45b",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
