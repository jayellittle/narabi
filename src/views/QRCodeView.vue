<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import QrcodeVue from 'qrcode.vue'
import { useFirebase } from '../composables/useFirebase'
import type { WaitingCustomer } from '../types'

const route = useRoute()
const { subscribeToWaitingList, generateQRCode, getStore } = useFirebase()

const storeId = ref(route.params.storeId as string)
const storeName = ref('')
const qrCodeUrl = ref('')
const waitingList = ref<WaitingCustomer[]>([])
const isLoading = ref(true)
const error = ref('')

let unsubscribe: (() => void) | null = null

// 매장 정보 및 대기열 로드
const loadData = async () => {
  isLoading.value = true
  error.value = ''

  try {
    // 매장 정보 가져오기
    const store = await getStore(storeId.value)
    if (store) {
      storeName.value = store.name
    }

    // QR 코드 URL 생성
    const baseUrl = window.location.origin
    qrCodeUrl.value = `${baseUrl}/wait?store=${storeId.value}`

    // 백엔드에도 QR URL 저장
    await generateQRCode(storeId.value)

    // 대기열 실시간 구독
    unsubscribe = subscribeToWaitingList(storeId.value, (customers) => {
      waitingList.value = customers
    })
  } catch (err) {
    console.error('데이터 로드 실패:', err)
    error.value = 'データの読み込みに失敗しました。'
  } finally {
    isLoading.value = false
  }
}

// QR 코드 다운로드
const downloadQR = () => {
  // QR 코드 SVG를 캔버스로 변환 후 다운로드
  const qrElement = document.querySelector('.qr-image-wrapper canvas') as HTMLCanvasElement
  if (qrElement) {
    const link = document.createElement('a')
    link.download = `qr-code-${storeName.value || 'store'}.png`
    link.href = qrElement.toDataURL('image/png')
    link.click()
  }
}

// QR 코드 인쇄
const printQR = () => {
  const qrElement = document.querySelector('.qr-image-wrapper canvas') as HTMLCanvasElement
  if (qrElement) {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QRコード - ${storeName.value}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                font-family: sans-serif;
              }
              h1 {
                margin-bottom: 1rem;
              }
              img {
                border: 2px solid #000;
                padding: 1rem;
              }
              p {
                margin-top: 1rem;
                font-size: 1.2rem;
              }
            </style>
          </head>
          <body>
            <h1>${storeName.value}</h1>
            <h2>順番待ちQRコード</h2>
            <img src="${qrElement.toDataURL('image/png')}" alt="QR Code" />
            <p>このQRコードをスキャンして順番待ちリストに登録してください。</p>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }
}

onMounted(() => {
  loadData()
})

// 컴포넌트 언마운트 시 구독 해제
watch(
  () => route.params.storeId,
  (newId) => {
    if (newId && newId !== storeId.value) {
      if (unsubscribe) unsubscribe()
      storeId.value = newId as string
      loadData()
    }
  },
)

// 컴포넌트 언마운트
onMounted(() => {
  return () => {
    if (unsubscribe) unsubscribe()
  }
})
</script>

<template>
  <div class="qr-code-container">
    <h1>順番待ちQRコード</h1>

    <div v-if="isLoading" class="loading">読み込み中...</div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else class="qr-content">
      <!-- QR 코드 표시 -->
      <div class="qr-display">
        <h2 class="qr-store-name">{{ storeName }}</h2>
        <div class="qr-image-wrapper">
          <qrcode-vue :value="qrCodeUrl" :size="240" level="H" render-as="canvas" />
        </div>
        <p class="qr-instruction">
          お客様にこのQRコードをスキャンしていただくと、順番待ちリストに登録されます。
        </p>
      </div>

      <!-- 대기 인원 표시 (클릭 가능) -->
      <div class="waiting-info">
        <router-link :to="`/store/${storeId}/waiting`" class="info-card">
          <div class="info-icon">👥</div>
          <div class="info-content">
            <div class="info-label">現在順番待ち中</div>
            <div class="info-value">{{ waitingList.length }}名</div>
          </div>
        </router-link>
      </div>

      <!-- 액션 버튼 -->
      <div class="action-buttons">
        <button @click="downloadQR" class="action-button download">📥 ダウンロード</button>
        <button @click="printQR" class="action-button print">🖨️ 印刷</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* モバイルファースト: すべてのデバイスで同じUIを表示 */
.qr-code-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
}

h1 {
  font-size: 1.3rem;
  margin: 0.5rem 0;
  color: #333;
  text-align: center;
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  font-size: 1rem;
}

.error {
  color: #f44336;
}

.qr-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* QR 코드 표시 */
.qr-display {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

/* 店舗名を常に非表示 */
.qr-store-name {
  display: none;
}

.qr-image-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  margin: 0 auto;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

.qr-image-wrapper canvas {
  display: block;
  width: 240px !important;
  height: 240px !important;
  max-width: calc(100vw - 4rem) !important;
  max-height: calc(100vw - 4rem) !important;
  box-sizing: border-box;
}

/* 説明文を常に非表示 */
.qr-instruction {
  display: none;
}

/* 대기 정보 */
.waiting-info {
  display: flex;
  gap: 0.75rem;
}

.info-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.75rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s;
}

.info-card:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.info-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.info-label {
  font-size: 0.85rem;
  opacity: 0.9;
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 1.5rem;
  font-weight: bold;
}

/* 액션 버튼 */
.action-buttons {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
}

.action-button {
  width: 100%;
  padding: 1rem;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.action-button.download {
  background-color: #4caf50;
  color: white;
}

.action-button.download:active {
  background-color: #45a049;
  transform: scale(0.98);
}

.action-button.print {
  background-color: #2196f3;
  color: white;
}

.action-button.print:active {
  background-color: #1976d2;
  transform: scale(0.98);
}

@media print {
  .action-buttons,
  .waiting-info {
    display: none;
  }
}
</style>
