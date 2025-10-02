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
      <button class="line-login-button" @click="loginWithLine">
        <img src="/line-icon.png" alt="LINE Icon" />
        LINEで順番待ち
      </button>
      <!-- <button @click="loginWithPhoneNumber"> -->
      <button>LINEをお持ちではないですか？</button>
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

const loginWithLine = () => {
  localStorage.setItem('storeIdForLogin', currentStoreId.value)

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
    localStorage.removeItem('storeIdForLogin')
    status.value = 'loading'
    try {
      const functions = getFunctions()
      const registerWaitlist = httpsCallable<
        { code: string; storeId: string },
        RegisterWaitlistResponse
      >(functions, 'registerWaitlist')

      const result = await registerWaitlist({ code: code, storeId: savedStoreId })

      if (result.data.success) {
        status.value = 'success'
      } else {
        throw new Error('Registration failed.')
      }
    } catch (error: unknown) {
      console.error('등록 처리 중 에러:', error)
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

.line-login-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  margin-top: 20px;
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
</style>
