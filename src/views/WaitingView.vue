<template>
  <div class="waiting-container">
    <div v-if="status === 'loading'">
      <h2>登録中です...</h2>
      <p>LINE情報を確認しています。少々お待ちください。</p>
    </div>

    <div v-else-if="status === 'success'">
      <h2>登録が完了しました！</h2>
      <p>お順番になりましたら、LINEでお知らせいたします。</p>
    </div>

    <div v-else-if="status === 'error'">
      <h2>エラーが発生しました</h2>
      <p>{{ errorMessage }}</p>
      <button @click="goBack">最初からやり直す</button>
    </div>

    <div v-else>
      <h2>順番待ち登録</h2>
      <p>LINEで簡単に順番待ちの登録ができます。</p>

      <form @submit.prevent="loginWithLine" class="waiting-form">
        <div class="form-group">
          <label for="partySize">人数 <span class="required">*</span></label>
          <input
            type="number"
            id="partySize"
            v-model.number="partySize"
            min="1"
            max="20"
            required
            placeholder="例: 4"
          />
        </div>

        <div class="form-group">
          <label for="customName">お名前</label>
          <input
            type="text"
            id="customName"
            v-model="customName"
            placeholder="例: 山田"
            maxlength="50"
          />
          <small class="form-hint">お名前を入力されない場合は、LINEプロフィールのお名前で自動登録されます。</small>
        </div>

        <div class="form-group">
          <label for="phoneNumber">緊急連絡先</label>
          <input
            type="tel"
            id="phoneNumber"
            v-model="phoneNumber"
            placeholder="例: 090-1234-5678"
            maxlength="20"
          />
          <small class="form-hint">お店から緊急時に連絡を取れるよう、連絡可能な電話番号を追加してください。</small>
        </div>

        <button type="submit" class="line-login-button">
          <img src="/line-icon.png" alt="LINE Icon" />
          LINEで順番待ち
        </button>
      </form>

      <!-- <button @click="loginWithPhoneNumber"> -->
      <button class="secondary-button">LINEをお持ちではないですか？</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFunctions, httpsCallable } from 'firebase/functions'

type Status = 'initial' | 'loading' | 'success' | 'error'

interface RegisterWaitlistResponse {
  success: boolean
}

const status = ref<Status>('initial')
const errorMessage = ref('')

const route = useRoute()
const router = useRouter()

const currentStoreId = ref((route.params.storeId as string) || '')
const partySize = ref<number>(1)
const customName = ref<string>('')
const phoneNumber = ref<string>('')

const loginWithLine = () => {
  // 폼 데이터를 localStorage에 저장
  localStorage.setItem('storeIdForLogin', currentStoreId.value)
  localStorage.setItem('waitingFormData', JSON.stringify({
    partySize: partySize.value,
    customName: customName.value,
    phoneNumber: phoneNumber.value
  }))

  const LINE_LOGIN_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID
  const REDIRECT_URI = `${import.meta.env.VITE_APP_URL}/wait`
  const STATE = '12345abcde' // 任意値

  const lineLoginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
  lineLoginUrl.searchParams.set('response_type', 'code')
  lineLoginUrl.searchParams.set('client_id', LINE_LOGIN_CHANNEL_ID)
  lineLoginUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  lineLoginUrl.searchParams.set('state', STATE)
  lineLoginUrl.searchParams.set('scope', 'profile openid')

  window.location.href = lineLoginUrl.toString()
}

const goBack = () => {
  router.replace({ path: `/wait/${currentStoreId.value}` })
  status.value = 'initial'
}

onMounted(async () => {
  const code = new URL(window.location.href).searchParams.get('code')

  // CASE 1: LINEから戻ってきた場合 (code有り・localStorageにstoreIdを保持中)
  const savedStoreId = localStorage.getItem('storeIdForLogin')
  if (code && savedStoreId) {
    const savedFormDataStr = localStorage.getItem('waitingFormData')
    const savedFormData = savedFormDataStr ? JSON.parse(savedFormDataStr) : {}

    localStorage.removeItem('storeIdForLogin')
    localStorage.removeItem('waitingFormData')

    status.value = 'loading'
    try {
      const functions = getFunctions()
      const registerWaitlist = httpsCallable<
        {
          code: string
          storeId: string
          partySize: number
          customName?: string
          phoneNumber?: string
        },
        RegisterWaitlistResponse
      >(functions, 'registerWaitlist')

      const result = await registerWaitlist({
        code: code,
        storeId: savedStoreId,
        partySize: savedFormData.partySize || 1,
        customName: savedFormData.customName || '',
        phoneNumber: savedFormData.phoneNumber || ''
      })

      if (result.data.success) {
        status.value = 'success'
      } else {
        throw new Error('Registration failed.')
      }
    } catch (error: unknown) {
      console.error('登録 処理 中 エラー:', error)
      errorMessage.value = '登録中に問題が発生しました。もう一度お試しください。'
      status.value = 'error'
    }
  }
  // CASE 2: QRコードで初めて接続した場合 (code無し・URLにstoreIdが有り)
  else if (route.params.storeId) {
    currentStoreId.value = route.params.storeId as string
  }
  // CASE 3: 不正なアクセスの場合
  else {
    errorMessage.value = '不正なアクセスです。もう一度QRコードをスキャンしてください。'
    status.value = 'error'
  }
})
</script>

<style scoped>
.waiting-container {
  max-width: 500px;
  margin: 50px auto;
  padding: 30px;
  text-align: center;
  border: 1px solid #eee;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

h2 {
  margin-bottom: 15px;
}

p {
  color: #666;
  line-height: 1.6;
}

.waiting-form {
  margin-top: 20px;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.form-group .required {
  color: #e74c3c;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #00c300;
}

.form-hint {
  display: block;
  margin-top: 6px;
  color: #888;
  font-size: 12px;
  line-height: 1.4;
}

.line-login-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 14px 24px;
  margin-top: 10px;
  background-color: #00c300;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}

.line-login-button:hover {
  background-color: #00a300;
}

.line-login-button img {
  width: 24px;
  height: 24px;
  margin-right: 12px;
}

.secondary-button {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  background-color: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.secondary-button:hover {
  background-color: #e8e8e8;
}
</style>
