import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

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
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
const functions = getFunctions(app)

const isCI = import.meta.env.VITE_IS_CI_ENV === 'true'

if (!isCI && location.hostname === 'localhost') {
  console.log('🔧 Localhost detected. Connecting to Emulators...')
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectAuthEmulator(auth, 'http://localhost:9099')
  connectStorageEmulator(storage, 'localhost', 9199)
  connectFunctionsEmulator(functions, 'localhost', 5001)
} else {
  console.log('🚀 Production mode or CI Environment detected. Skipping Emulators.')
}

// 서비스 초기화
export { auth, db, storage, functions }

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
