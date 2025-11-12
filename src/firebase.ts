import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyBhOoE7W3RVs3VkCfLYLxVF4EolnlD_0rE',
  authDomain: 'narabi-a8765.firebaseapp.com',
  projectId: 'narabi-a8765',
  storageBucket: 'narabi-a8765.firebasestorage.app',
  messagingSenderId: '654813606842',
  appId: '1:654813606842:web:8e5f7e5a7e3d0b8c5e3f7e',
}

// Firebase 초기화
const app = initializeApp(firebaseConfig)

// 서비스 초기化
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)

// 🔥 Emulator 연결 (로컬 개발 시)
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  console.log('🔧 Firebase Emulator에 연결합니다...')

  // Auth Emulator
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

  // Firestore Emulator
  connectFirestoreEmulator(db, '127.0.0.1', 8080)

  // Functions Emulator
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)

  // Storage Emulator
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

export default app
