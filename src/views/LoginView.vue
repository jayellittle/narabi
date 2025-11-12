<template>
  <div class="logo-container">
    <img src="/logo-rect.png" alt="App Logo" class="app-logo" />
    <h3 class="logo-text">管理者ホーム</h3>
  </div>
  <div class="login-container">
    <h2 class="login-title">{{ isSignUp ? '会員登録' : 'ログイン' }}</h2>

    <!-- プロフィール写真アップロード (会員登録時のみ) -->
    <div v-if="isSignUp" class="form-group profile-upload">
      <div class="profile-image-preview" @click="triggerFileInput">
        <img v-if="profileImagePreview" :src="profileImagePreview" alt="Profile" />
        <div v-else class="profile-placeholder">
          <span class="camera-icon">📷</span>
          <span class="upload-text">写真を選択</span>
        </div>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        @change="handleFileSelect"
        style="display: none"
      />
      <p class="hint-text">プロフィール写真（任意）</p>
    </div>

    <!-- ニックネーム (会員登録時のみ) -->
    <div v-if="isSignUp" class="form-group">
      <input type="text" v-model="displayName" placeholder="ニックネーム（任意）" />
    </div>

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

    <!-- パスワード確認 (会員登録時のみ) -->
    <div v-if="isSignUp" class="form-group">
      <input
        type="password"
        v-model="passwordConfirm"
        placeholder="パスワード確認"
        @keyup.enter="handleSignUp()"
      />
    </div>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <div v-if="isSignUp">
      <button @click="handleSignUp" class="main-button" :disabled="isSubmitting">
        {{ isSubmitting ? '登録中...' : '会員登録' }}
      </button>
      <p>
        アカウントを登録済み
        <button @click.prevent="isSignUp = false" href="#">ログイン</button>
      </p>
    </div>
    <div v-else>
      <button @click="handleSignIn" class="main-button" :disabled="isSubmitting">
        {{ isSubmitting ? 'ログイン中...' : 'ログイン' }}
      </button>
      <p>
        新しいアカウントを作る　<button @click.prevent="isSignUp = true" href="#">会員登録</button>
      </p>
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
  updateProfile,
} from 'firebase/auth'
import type { AuthError } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../firebase'

const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)

const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const displayName = ref('')
const errorMessage = ref('')
const isSignUp = ref(false)
const isSubmitting = ref(false)

// プロフィール画像
const profileImageFile = ref<File | null>(null)
const profileImagePreview = ref<string>('')

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    profileImageFile.value = file

    // プレビュー表示
    const reader = new FileReader()
    reader.onload = (e) => {
      profileImagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const uploadProfileImage = async (userId: string): Promise<string | null> => {
  if (!profileImageFile.value) return null

  try {
    const imageRef = storageRef(storage, `users/${userId}/profile.jpg`)
    await uploadBytes(imageRef, profileImageFile.value)
    const downloadUrl = await getDownloadURL(imageRef)
    return downloadUrl
  } catch (error) {
    console.error('プロフィール画像のアップロード失敗:', error)
    // Storage Emulatorが起動していない場合などでもエラーを無視して続行
    return null
  }
}

const handleSignUp = async () => {
  errorMessage.value = ''

  // バリデーション
  if (!email.value || !password.value) {
    errorMessage.value = 'メールアドレスとパスワードを入力してください。'
    return
  }

  if (password.value !== passwordConfirm.value) {
    errorMessage.value = 'パスワードが一致しません。'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = 'パスワードは6文字以上で設定してください。'
    return
  }

  isSubmitting.value = true

  try {
    // ユーザー作成
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
    const user = userCredential.user

    // プロフィール画像をアップロード（失敗してもスキップ）
    let profileImageUrl: string | null = null
    if (profileImageFile.value) {
      try {
        profileImageUrl = await uploadProfileImage(user.uid)
        if (profileImageUrl) {
          console.log('プロフィール画像アップロード成功')
        } else {
          console.log('プロフィール画像アップロードスキップ（Storageエラー）')
        }
      } catch (uploadError) {
        console.error('プロフィール画像アップロードエラー（続行）:', uploadError)
        // エラーでも続行
      }
    }

    // Firebase Authのプロフィール更新（displayNameまたはphotoURLがある場合のみ）
    const profileUpdate: { displayName?: string; photoURL?: string } = {}
    if (displayName.value && displayName.value.trim()) {
      profileUpdate.displayName = displayName.value.trim()
    }
    if (profileImageUrl) {
      profileUpdate.photoURL = profileImageUrl
    }

    // プロフィール情報がある場合のみ更新
    if (Object.keys(profileUpdate).length > 0) {
      try {
        await updateProfile(user, profileUpdate)
        console.log('プロフィール更新成功')
      } catch (profileError) {
        console.error('プロフィール更新エラー（続行）:', profileError)
        // エラーでも続行
      }
    }

    // Firestoreにユーザー情報を保存
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName.value?.trim() || null,
        profileImageUrl: profileImageUrl,
        createdAt: serverTimestamp(),
      })
      console.log('Firestoreにユーザー情報を保存成功')
    } catch (firestoreError) {
      console.error('Firestore保存エラー（続行）:', firestoreError)
      // エラーでも続行
    }

    // メール認証送信（失敗してもスキップ）
    try {
      await sendEmailVerification(user)
      console.log('確認メール送信成功')
      alert(
        '会員登録が完了しました！\n確認メールを送信しました。メールをご確認ください。',
      )
    } catch (emailError) {
      console.error('確認メール送信エラー（続行）:', emailError)
      // Emulator環境では失敗する可能性があるが、登録は成功
      alert('会員登録が完了しました！')
    }

    router.push('/dashboard')
  } catch (error: unknown) {
    const authError = error as AuthError
    console.error('会員登録エラー:', authError)
    errorMessage.value = getErrorMessage(authError.code)

    // メールアドレスが既に使用されている場合、ログインモードに切り替え
    if (authError.code === 'auth/email-already-in-use') {
      setTimeout(() => {
        isSignUp.value = false
        // パスワード確認とプロフィール情報をクリア
        passwordConfirm.value = ''
        displayName.value = ''
        profileImageFile.value = null
        profileImagePreview.value = ''
      }, 2000)
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleSignIn = async () => {
  errorMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'メールアドレスとパスワードを入力してください。'
    return
  }

  isSubmitting.value = true

  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/dashboard')
  } catch (error: unknown) {
    const authError = error as AuthError
    console.error('ログインエラー:', authError)
    errorMessage.value = getErrorMessage(authError.code)
  } finally {
    isSubmitting.value = false
  }
}

// フォームリセット
const resetSignUpForm = () => {
  email.value = ''
  password.value = ''
  passwordConfirm.value = ''
  displayName.value = ''
  profileImageFile.value = null
  profileImagePreview.value = ''
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
      // この場合、アカウントは作成されているのでログインを試す
      return 'このメールアドレスは既に登録されています。ログインしてください。'
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

/* プロフィール画像アップロード */
.profile-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.profile-image-preview {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid #ddd;
  transition: border-color 0.3s;
  background-color: #f5f5f5;
}

.profile-image-preview:hover {
  border-color: #4caf50;
}

.profile-image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
}

.camera-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.upload-text {
  font-size: 0.85rem;
  color: #666;
}

.hint-text {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #666;
  text-align: center;
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
  transition: background-color 0.3s;
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

/* モバイル対応 */
@media (max-width: 480px) {
  .login-container {
    padding: 20px 16px;
  }

  .profile-image-preview {
    width: 100px;
    height: 100px;
  }

  .camera-icon {
    font-size: 2rem;
  }
}
</style>
