<template>
  <div class="logo-container">
    <img src="/logo-rect.png" alt="App Logo" class="app-logo" />
    <h3 class="logo-text">管理者ホーム</h3>
  </div>
  <div class="login-container">
    <h2 class="login-title">{{ isSignUp ? '会員登録' : 'ログイン' }}</h2>

    <!-- 認証メール送信完了メッセージ -->
    <div v-if="verificationSent" class="success-message">
      <p>{{ email }}に認証メールを送信しました。</p>
      <p>メール内のリンクをクリックして、アカウントを有効化してください。</p>
    </div>

    <div v-else>
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

      <!-- 会員登録時の追加フィールド -->
      <div v-if="isSignUp">
        <div class="form-group">
          <input
            type="password"
            v-model="passwordConfirm"
            placeholder="パスワード確認"
            @keyup.enter="handleSignUp()"
          />
        </div>
        <div class="form-group">
          <input type="text" v-model="displayName" placeholder="ニックネーム（任意）" />
        </div>
        <div class="form-group">
          <label class="file-upload-label">
            <input
              type="file"
              @change="handleFileSelect"
              accept="image/*"
              class="file-input"
            />
            <span class="file-upload-button">
              {{ profileImage ? profileImage.name : 'プロフィール画像を選択（任意）' }}
            </span>
          </label>
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <div v-if="isSignUp">
        <button @click="handleSignUp" class="main-button" :disabled="loading">
          {{ loading ? '登録中...' : '会員登録' }}
        </button>
        <p>
          アカウントを登録済み
          <button @click.prevent="isSignUp = false" href="#">ログイン</button>
        </p>
      </div>
      <div v-else>
        <button @click="handleSignIn" class="main-button" :disabled="loading">
          {{ loading ? 'ログイン中...' : 'ログイン' }}
        </button>
        <p>
          新しいアカウントを作る　<button @click.prevent="isSignUp = true" href="#">会員登録</button>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth'
import type { AuthError } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../firebase'

const router = useRouter()

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const displayName = ref('')
const profileImage = ref<File | null>(null)
const errorMessage = ref('')
const isSignUp = ref(false)
const loading = ref(false)
const verificationSent = ref(false)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    // ファイルサイズチェック (5MB)
    if (file.size > 5 * 1024 * 1024) {
      errorMessage.value = 'ファイルサイズは5MB以下にしてください。'
      return
    }
    // 画像形式チェック
    if (!file.type.startsWith('image/')) {
      errorMessage.value = '画像ファイルを選択してください。'
      return
    }
    profileImage.value = file
    errorMessage.value = ''
  }
}

const handleSignUp = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    // バリデーション
    if (!email.value || !password.value || !passwordConfirm.value) {
      errorMessage.value = 'メールアドレスとパスワードを入力してください。'
      loading.value = false
      return
    }

    if (password.value !== passwordConfirm.value) {
      errorMessage.value = 'パスワードが一致しません。'
      loading.value = false
      return
    }

    // ユーザー作成
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    )
    const user = userCredential.user

    // プロフィール画像をアップロード（選択されている場合）
    let profileImageUrl = ''
    if (profileImage.value) {
      const imageRef = storageRef(
        storage,
        `profile_images/${user.uid}/${profileImage.value.name}`
      )
      await uploadBytes(imageRef, profileImage.value)
      profileImageUrl = await getDownloadURL(imageRef)
    }

    // Firestoreにユーザー情報を保存
    await setDoc(doc(db, 'users', user.uid), {
      email: email.value,
      displayName: displayName.value || '',
      profileImageUrl: profileImageUrl,
      emailVerified: false,
      createdAt: new Date(),
    })

    // 認証メールを送信
    await sendEmailVerification(user)

    // 一旦ログアウト（メール認証が完了するまでログインさせない）
    await signOut(auth)

    // 成功メッセージを表示
    verificationSent.value = true
    loading.value = false
  } catch (error: unknown) {
    const authError = error as AuthError
    console.error('会員登録エラー:', authError)
    errorMessage.value = getErrorMessage(authError.code)
    loading.value = false
  }
}

const handleSignIn = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value)
    const user = userCredential.user

    // メール認証チェック
    if (!user.emailVerified) {
      // 認証されていない場合
      const resend = confirm(
        `${email.value}に認証メールを再送信しますか？\n\nメールを確認して、認証リンクをクリックしてください。`
      )

      if (resend) {
        await sendEmailVerification(user)
        alert('認証メールを再送信しました。メールを確認してください。')
      }

      // ログアウトさせる
      await signOut(auth)
      loading.value = false
      return
    }

    // 認証済みの場合、ダッシュボードへ
    router.push('/dashboard')
  } catch (error: unknown) {
    const authError = error as AuthError
    console.error('ログインエラー:', authError)
    errorMessage.value = getErrorMessage(authError.code)
    loading.value = false
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

.form-group input[type='email'],
.form-group input[type='password'],
.form-group input[type='text'] {
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

.file-upload-label {
  display: block;
  width: 100%;
}

.file-input {
  display: none;
}

.file-upload-button {
  display: block;
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f5f5f5;
  cursor: pointer;
  text-align: center;
  box-sizing: border-box;
}

.file-upload-button:hover {
  background-color: #e0e0e0;
}

.error-message {
  color: #f44336;
  background-color: #ffebee;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.success-message {
  color: #4caf50;
  background-color: #e8f5e9;
  padding: 20px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.success-message p {
  margin: 10px 0;
  color: #2e7d32;
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

.main-button:hover:not(:disabled) {
  background-color: #1976d2;
}

.main-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
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
