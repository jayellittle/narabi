<template>
  <div class="logo-container">
    <img src="/logo-rect.png" alt="App Logo" class="app-logo" />
    <h3 class="logo-text">管理者ホーム</h3>
  </div>
  <div class="login-container">
    <h2 class="login-title">{{ isSignUp ? '会員登録' : 'ログイン' }}</h2>

    <!-- 認証メール送信完了メッセージ -->
    <div v-if="verificationSent" class="success-message">
      <p style="font-weight: bold">{{ email }}</p>
      <p>に認証メールを送信しました。</p>
      <p>メール内のリンクをクリックして、アカウントを有効化してください。</p>
      <button @click="backToLogin" class="back-to-login-button">ログインページに戻る</button>
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
            <input type="file" @change="handleFileSelect" accept="image/*" class="file-input" />
            <span class="file-upload-button">
              {{ profileImage ? profileImage.name : 'プロフィール画像を選択（任意）' }}
            </span>
          </label>
          <!-- プロフィール画像プレビュー -->
          <div v-if="profileImagePreview" class="image-preview-container">
            <img
              :src="profileImagePreview"
              alt="プロフィール画像プレビュー"
              class="image-preview"
            />
            <button @click="removeProfileImage" type="button" class="remove-image-button">
              ✕ 削除
            </button>
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <div v-if="isSignUp">
        <button @click="handleSignUp" class="main-button" :disabled="loading">
          {{ loading ? '登録中...' : '会員登録' }}
        </button>
        <p>
          <button @click.prevent="isSignUp = false" href="#">
            登録済みのアカウントでログインする
          </button>
        </p>
      </div>
      <div v-else>
        <button @click="handleSignIn" class="main-button" :disabled="loading">
          {{ loading ? 'ログイン中...' : 'ログイン' }}
        </button>
        <p>
          <button @click.prevent="isSignUp = true" href="#">新しいアカウントを作る</button>
        </p>
        <p class="forgot-password-text">
          <button @click.prevent="showPasswordReset = true" class="forgot-password-link">
            パスワードを忘れた場合
          </button>
        </p>
      </div>

      <!-- パスワードリセット画面 -->
      <div
        v-if="showPasswordReset"
        class="password-reset-overlay"
        @click.self="showPasswordReset = false"
      >
        <div class="password-reset-modal">
          <h3>パスワードをリセット</h3>
          <p class="reset-description">
            登録したメールアドレスを入力してください。<br />
            パスワード再設定リンクを送信します。
          </p>
          <div class="form-group">
            <input type="email" v-model="resetEmail" placeholder="メールアドレス" />
          </div>
          <div v-if="resetMessage" :class="resetSuccess ? 'success-message' : 'error-message'">
            {{ resetMessage }}
          </div>
          <div class="modal-buttons">
            <button @click="handlePasswordReset" class="main-button" :disabled="loading">
              {{ loading ? '送信中...' : 'リセットリンクを送信' }}
            </button>
            <button @click="cancelPasswordReset" class="cancel-button">キャンセル</button>
          </div>
        </div>
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
  sendPasswordResetEmail,
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
const profileImagePreview = ref<string>('')
const errorMessage = ref('')
const isSignUp = ref(false)
const loading = ref(false)
const verificationSent = ref(false)
const showPasswordReset = ref(false)
const resetEmail = ref('')
const resetMessage = ref('')
const resetSuccess = ref(false)

// パスワードの強度チェック
const validatePassword = (password: string): { valid: boolean; message: string } => {
  // 最小8文字
  if (password.length < 8) {
    return { valid: false, message: 'パスワードは8文字以上で設定してください。' }
  }

  // 英文字が含まれているか
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'パスワードには英文字を含めてください。' }
  }

  // 数字が含まれているか
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'パスワードには数字を含めてください。' }
  }

  // 連続する同じ文字をチェック (例: aaa, 111)
  if (/(.)\1{2,}/.test(password)) {
    return { valid: false, message: 'パスワードに同じ文字を3回以上連続して使用できません。' }
  }

  // 連続する文字列をチェック (例: abc, 123)
  for (let i = 0; i < password.length - 2; i++) {
    const char1 = password.charCodeAt(i)
    const char2 = password.charCodeAt(i + 1)
    const char3 = password.charCodeAt(i + 2)

    // 昇順の連続 (abc, 123)
    if (char2 === char1 + 1 && char3 === char2 + 1) {
      return {
        valid: false,
        message: 'パスワードに連続する文字列を使用できません。（例：abc、123）',
      }
    }

    // 降順の連続 (cba, 321)
    if (char2 === char1 - 1 && char3 === char2 - 1) {
      return {
        valid: false,
        message: 'パスワードに連続する文字列を使用できません。（例：cba、321）',
      }
    }
  }

  return { valid: true, message: '' }
}

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

    // プレビュー画像を生成
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        profileImagePreview.value = e.target.result as string
      }
    }
    reader.readAsDataURL(file)
  }
}

const removeProfileImage = () => {
  profileImage.value = null
  profileImagePreview.value = ''
  // ファイル入力をリセット
  const fileInput = document.querySelector('.file-input') as HTMLInputElement
  if (fileInput) {
    fileInput.value = ''
  }
}

const backToLogin = () => {
  verificationSent.value = false
  isSignUp.value = false
  email.value = ''
  password.value = ''
  passwordConfirm.value = ''
  displayName.value = ''
  errorMessage.value = ''
}

const handleSignUp = async () => {
  errorMessage.value = ''
  loading.value = true

  try {
    // バリデーション
    if (!email.value) {
      errorMessage.value = 'メールアドレスを入力してください。'
      loading.value = false
      return
    }

    if (!password.value) {
      errorMessage.value = 'パスワードを入力してください。'
      loading.value = false
      return
    }

    if (!passwordConfirm.value) {
      errorMessage.value = 'パスワード確認を入力してください。'
      loading.value = false
      return
    }

    // パスワード強度チェック
    const passwordValidation = validatePassword(password.value)
    if (!passwordValidation.valid) {
      errorMessage.value = passwordValidation.message
      loading.value = false
      return
    }

    if (password.value !== passwordConfirm.value) {
      errorMessage.value = 'パスワードが一致しません。'
      loading.value = false
      return
    }

    // ユーザー作成
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
    const user = userCredential.user

    // プロフィール画像をアップロード（選択されている場合）
    let profileImageUrl = ''
    if (profileImage.value) {
      const imageRef = storageRef(storage, `profile_images/${user.uid}/${profileImage.value.name}`)
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

    // フォームをリセット
    profileImage.value = null
    profileImagePreview.value = ''
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
        `このアカウントはまだ有効化されていません。\nメールを確認して、認証リンクをクリックしてください。\n\n${email.value}に認証メールを再送信しますか？`,
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

const handlePasswordReset = async () => {
  resetMessage.value = ''
  resetSuccess.value = false
  loading.value = true

  try {
    if (!resetEmail.value) {
      resetMessage.value = 'メールアドレスを入力してください。'
      resetSuccess.value = false
      loading.value = false
      return
    }

    await sendPasswordResetEmail(auth, resetEmail.value)
    resetMessage.value = `${resetEmail.value}にパスワードリセットのメールを送信しました。`
    resetSuccess.value = true
    loading.value = false

    // 3秒後にモーダルを閉じる
    setTimeout(() => {
      showPasswordReset.value = false
      resetEmail.value = ''
      resetMessage.value = ''
    }, 3000)
  } catch (error: unknown) {
    const authError = error as AuthError
    console.error('パスワードリセットエラー:', authError)
    resetMessage.value = getErrorMessage(authError.code)
    resetSuccess.value = false
    loading.value = false
  }
}

const cancelPasswordReset = () => {
  showPasswordReset.value = false
  resetEmail.value = ''
  resetMessage.value = ''
  resetSuccess.value = false
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

.image-preview-container {
  margin-top: 15px;
  text-align: center;
  position: relative;
}

.image-preview {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  border: 2px solid #ddd;
  object-fit: cover;
}

.remove-image-button {
  display: block;
  margin: 10px auto 0;
  padding: 8px 16px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.remove-image-button:hover {
  background-color: #d32f2f;
}

.error-message {
  color: #f44336;
  background-color: #ffebee;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
  font-size: smaller;
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

.back-to-login-button {
  margin-top: 15px;
  padding: 10px 20px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.back-to-login-button:hover {
  background-color: #1976d2;
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

.forgot-password-text {
  margin-top: 10px;
}

.forgot-password-link {
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  font-size: 13px;
}

.forgot-password-link:hover {
  color: #2196f3;
}

.password-reset-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.password-reset-modal {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.password-reset-modal h3 {
  margin: 0 0 15px 0;
  font-size: 22px;
  color: #333;
  text-align: center;
}

.reset-description {
  font-size: 14px;
  color: #666;
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.6;
}

.modal-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cancel-button {
  width: 100%;
  padding: 12px;
  background-color: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}
</style>
