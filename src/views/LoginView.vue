<template>
  <div class="login-container">
    <h2>{{ isSignUp ? '会員登録' : 'ログイン' }}</h2>
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
      <button @click="handleSignUp">会員登録</button>
      <p>
        登録済みのアカウントをお持ちですか？
        <a @click.prevent="isSignUp = false" href="#">ログイン</a>
      </p>
    </div>
    <div v-else>
      <button @click="handleSignIn">ログイン</button>
      <p>
        アカウントをお持ちではないですか？ <a @click.prevent="isSignUp = true" href="#">会員登録</a>
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
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}
.form-group {
  margin-bottom: 15px;
}
input {
  width: 100%;
  padding: 10px;
  box-sizing: border-box;
}
button {
  width: 100%;
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.error-message {
  color: red;
  margin-bottom: 15px;
}
p {
  margin-top: 15px;
  text-align: center;
}
a {
  color: #007bff;
  cursor: pointer;
}
</style>
