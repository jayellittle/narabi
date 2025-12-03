import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 변수들을 먼저 선언합니다 (타입 호환성을 위해 any 사용)
let auth: Auth
let db: Firestore
let storage: FirebaseStorage
let functions: Functions

// 🚨 여기가 핵심: CI 환경이거나 테스트 중이면 가짜 객체를 주입하고 끝냅니다.
if (import.meta.env.CI || process.env.NODE_ENV === 'test') {
  console.log('🧪 CI/Test 환경 감지됨: Firebase 연결을 차단하고 Mock 객체를 사용합니다.')

  // 빈 껍데기 객체 할당 (무한 로딩 방지)
  auth = {} as any
  db = {} as any
  storage = {} as any
  functions = {} as any
} else {
  // 🚀 실제 환경(개발/배포)일 때만 초기화 수행
  const app = initializeApp(firebaseConfig)

  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)
  functions = getFunctions(app)

  // 로컬 에뮬레이터 연결
  if (location.hostname === 'localhost') {
    console.log('🔧 Localhost detected. Connecting to Emulators...')
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099')
    connectStorageEmulator(storage, 'localhost', 9199)
    connectFunctionsEmulator(functions, 'localhost', 5001)
  }
}

export { auth, db, storage, functions }
