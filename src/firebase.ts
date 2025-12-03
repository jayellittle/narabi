import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 🔍 디버깅용 로그 (CI 로그에서 확인용)
console.log('=== FIREBASE DEBUG INFO ===')
console.log('Is CI?', import.meta.env.CI)
console.log('Hostname:', location.hostname)
console.log('API Key Exists?', !!import.meta.env.VITE_FIREBASE_API_KEY)
console.log('===========================')

// Firebase 초기화
const app = initializeApp(firebaseConfig)

// 서비스 초기化
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)

// 🔥 Emulator 연결 (로컬 개발 시)
// if (!import.meta.env.CI && location.hostname === 'localhost') {
//   console.log('🔧 Firebase Emulator에 연결합니다...')

//   // Auth Emulator
//   connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

//   // Firestore Emulator
//   connectFirestoreEmulator(db, '127.0.0.1', 8080)

//   // Functions Emulator
//   connectFunctionsEmulator(functions, '127.0.0.1', 5001)

//   // Storage Emulator
//   connectStorageEmulator(storage, '127.0.0.1', 9199)
// }

export default app
