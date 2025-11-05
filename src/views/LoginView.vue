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
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import type { AuthError } from 'firebase/auth'

const router = useRouter()
const auth = getAuth()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isSignUp = ref(false)

const isAuthError = (error: unknown): error is AuthError => {
  return (error as AuthError)?.code !== undefined
}

const handleSignUp = async () => {
  try {
    await createUserWithEmailAndPassword(auth, email.value, password.value)
    router.push('/dashboard')
  } catch (error: unknown) {
    if (isAuthError(error)) {
      errorMessage.value = getErrorMessage(error.code)
    } else {
      errorMessage.value = 'エラーが発生しました。'
    }
  }
}

const handleSignIn = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/dashboard')
  } catch (error: unknown) {
    if (isAuthError(error)) {
      errorMessage.value = getErrorMessage(error.code)
    } else {
      errorMessage.value = 'エラーが発生しました。'
    }
  }
}

const getErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-email':
      return '無効なメールアドレスです。'
    case 'auth/user-not-found':
      return '登録されていないメールアドレスです。'
    case 'auth/wrong-password':
      return 'パスワードが間違っています。'
    case 'auth/email-already-in-use':
      return '既に登録されているメールアドレスです。'
    case 'auth/weak-password':
      return 'パスワードは６文字以上で設定してください。'
    case 'auth/invalid-credential':
      return 'メールアドレスまたはパスワードが間違っています。'
    case 'auth/too-many-requests':
      return 'リクエスト過多により一時的にアクセスがブロックされています。'
    default:
      return 'エラーが発生しました。後ほど再度お試しください。'
  }
}
</script>

<style scoped>
.login-container {
  max-width: 400px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin: 0 auto;
}
.logo-container {
  text-align: center;
  margin-bottom: 30px;
}
.app-logo {
  width: 240px;
  object-fit: contain;
  margin-bottom: 2px;
}
.logo-text {
  color: #212758;
  margin-top: 0;
  margin-bottom: 0;
  font-weight: 800;
  font-size: 18px;
}
.login-title {
  text-align: center;
  margin-bottom: 20px;
}
.form-group {
  margin-bottom: 15px;
}
.main-button {
  width: 100%;
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
input {
  width: 100%;
  padding: 10px;
  box-sizing: border-box;
}
.error-message {
  color: red;
  margin-bottom: 15px;
}
p {
  margin-top: 15px;
  text-align: center;
  font-size: 14px;
}
a {
  color: #007bff;
  cursor: pointer;
}
</style>
