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
        <h2>{{ storeName }}</h2>
        <div class="qr-image-wrapper">
          <qrcode-vue :value="qrCodeUrl" :size="300" level="H" render-as="canvas" />
        </div>
        <p class="qr-instruction">
          お客様にこのQRコードをスキャンしていただくと、<br />
          順番待ちリストに登録されます。
        </p>
      </div>

      <!-- 대기 인원 표시 -->
      <div class="waiting-info">
        <div class="info-card">
          <div class="info-icon">👥</div>
          <div class="info-content">
            <div class="info-label">現在順番待ち中</div>
            <div class="info-value">{{ waitingList.length }}名</div>
          </div>
        </div>
      </div>

      <!-- 액션 버튼 -->
      <div class="action-buttons">
        <button @click="downloadQR" class="action-button download">
          📥 QRコードをダウンロード
        </button>
        <button @click="printQR" class="action-button print">🖨️ QRコードを印刷</button>
      </div>

      <!-- 대기자 목록 미리보기 -->
      <div class="waiting-preview">
        <h3>待機中のお客様</h3>
        <div v-if="waitingList.length === 0" class="no-waiting">現在待機中のお客様はいません。</div>
        <div v-else class="preview-list">
          <div v-for="customer in waitingList.slice(0, 5)" :key="customer.id" class="preview-item">
            <img
              :src="customer.pictureUrl || '/default-avatar.png'"
              :alt="customer.displayName"
              class="preview-avatar"
            />
            <div class="preview-info">
              <div class="preview-name">{{ customer.displayName }}</div>
              <div class="preview-number">順番: {{ customer.queueNumber }}番</div>
            </div>
            <div :class="['preview-status', customer.status]">
              {{ customer.status === 'waiting' ? '待機中' : '呼出済' }}
            </div>
          </div>
          <div v-if="waitingList.length > 5" class="preview-more">
            他 {{ waitingList.length - 5 }}名
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qr-code-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #333;
  text-align: center;
}

.loading,
.error {
  text-align: center;
  padding: 3rem;
  font-size: 1.2rem;
}

.error {
  color: #f44336;
}

.qr-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* QR 코드 표시 */
.qr-display {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.qr-display h2 {
  margin: 0 0 1.5rem 0;
  color: #333;
  font-size: 1.5rem;
}

.qr-image-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  margin: 0 auto 1rem;
  max-width: 100%;
  width: fit-content;
}

.qr-image-wrapper canvas {
  display: block;
  width: 300px !important;
  height: 300px !important;
  max-width: 100%;
}

.qr-instruction {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 1rem 0 0 0;
}

/* 대기 정보 */
.waiting-info {
  display: flex;
  gap: 1rem;
}

.info-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.info-icon {
  font-size: 2.5rem;
}

.info-content {
  flex: 1;
}

.info-label {
  font-size: 0.9rem;
  opacity: 0.9;
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 2rem;
  font-weight: bold;
}

/* 액션 버튼 */
.action-buttons {
  display: flex;
  gap: 1rem;
}

.action-button {
  flex: 1;
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

.action-button.download:hover {
  background-color: #45a049;
}

.action-button.print {
  background-color: #2196f3;
  color: white;
}

.action-button.print:hover {
  background-color: #1976d2;
}

/* 대기자 미리보기 */
.waiting-preview {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.waiting-preview h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.2rem;
}

.no-waiting {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.preview-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.preview-info {
  flex: 1;
}

.preview-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

.preview-number {
  font-size: 0.85rem;
  color: #666;
}

.preview-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.preview-status.waiting {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.preview-status.called {
  background-color: #ffebee;
  color: #c62828;
}

.preview-more {
  text-align: center;
  padding: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}

/* モバイル対応 */
@media (max-width: 768px) {
  .qr-code-container {
    padding: 1rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .qr-display {
    padding: 1.5rem;
  }

  .qr-display h2 {
    font-size: 1.2rem;
  }

  .qr-image-wrapper {
    padding: 0.75rem;
    margin-left: auto;
    margin-right: auto;
    box-sizing: border-box;
    max-width: calc(100% - 3rem);
  }

  .qr-image-wrapper canvas {
    width: 100% !important;
    height: auto !important;
    max-width: 250px;
  }

  .info-card {
    padding: 1.25rem;
  }

  .info-icon {
    font-size: 2rem;
  }

  .info-value {
    font-size: 1.5rem;
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-button {
    width: 100%;
    padding: 1.25rem;
    font-size: 1.1rem;
  }

  .waiting-preview {
    padding: 1.25rem;
  }

  .preview-item {
    padding: 1rem;
  }

  .preview-avatar {
    width: 50px;
    height: 50px;
  }
}

/* 小さいモバイル画面 */
@media (max-width: 480px) {
  h1 {
    font-size: 1.3rem;
  }

  .action-button {
    font-size: 1rem;
    padding: 1rem;
  }
}

@media print {
  .action-buttons,
  .waiting-info,
  .waiting-preview {
    display: none;
  }
}
</style>
