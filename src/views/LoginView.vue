<template>
  <div class="logo-container">
    <img src="/logo-rect.png" alt="App Logo" class="app-logo" />
    <h3 class="logo-text">管理者ホーム</h3>
  </div>
  <div class="login-container">
    <h2 class="login-title">{{ isSignUp ? '会員登録' : 'ログイン' }}</h2>
    <div class="form-group">
      <input type="email" v-model="email" placeholder="メールアドレス" />
    </div>
    <div class="form-group">
      <input
        type="password"
        v-model="password"
        placeholder="パスワード"
        @keyup.enter="isSignUp ? handleSignUp() : handleSignIn()"
      />
    </div>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <div v-if="isSignUp">
      <button @click="handleSignUp" class="main-button">会員登録</button>
      <p>
        アカウントを登録済み　
        <button @click.prevent="isSignUp = false" href="#">ログイン</button>
      </p>
    </div>
    <div v-else>
      <button @click="handleSignIn" class="main-button">ログイン</button>
      <p>
        新しいアカウントを作る　<button @click.prevent="isSignUp = true" href="#">会員登録</button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import type { AuthError } from 'firebase/auth'
import { auth } from '../firebase' // ← 여기가 중요!

const router = useRouter()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isSignUp = ref(false)

const handleSignUp = async () => {
  errorMessage.value = ''
  try {
    await createUserWithEmailAndPassword(auth, email.value, password.value)
    router.push('/dashboard')
  } catch (error: unknown) {
    const authError = error as AuthError
    console.error('会員登録エラー:', authError)
    errorMessage.value = getErrorMessage(authError.code)
  }
}

const handleSignIn = async () => {
  errorMessage.value = ''
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/dashboard')
  } catch (error: unknown) {
    const authError = error as AuthError
    console.error('ログインエラー:', authError)
    errorMessage.value = getErrorMessage(authError.code)
  }
}

const getErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません。'
    case 'auth/user-disabled':
      return 'このアカウントは無効化されています。'
    case 'auth/user-not-found':
      return '登録されていないメールアドレスです。'
    case 'auth/wrong-password':
      return 'パスワードが間違っています。'
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に登録されています。'
    case 'auth/weak-password':
      return 'パスワードは6文字以上で設定してください。'
    case 'auth/invalid-credential':
      return '登録されていないメールアドレスです。'
    default:
      return 'エラーが発生しました。もう一度お試しください。'
  }
}
</script>

<style scoped>
.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
}

.app-logo {
  width: 200px;
  height: auto;
  margin-bottom: 16px;
}

.logo-text {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 40px 20px;
}

.login-title {
  text-align: center;
  margin-bottom: 30px;
  font-size: 28px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #4caf50;
}

.error-message {
  color: #f44336;
  background-color: #ffebee;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.main-button {
  width: 100%;
  padding: 12px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 20px;
}

.main-button:hover {
  background-color: #1976d2;
}

p {
  text-align: center;
  color: #666;
}

p button {
  background: none;
  border: none;
  color: #2196f3;
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
}

p button:hover {
  color: #1976d2;
}
</style>
