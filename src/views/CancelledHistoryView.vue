<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFirebase, useTimeFormat } from '../composables/useFirebase'
import type { WaitingCustomer } from '../types'

const route = useRoute()
const router = useRouter()
const { subscribeToCancelledHistory } = useFirebase()
const { formatTimestamp } = useTimeFormat()

const storeId = ref(route.params.storeId as string)
const cancelledList = ref<WaitingCustomer[]>([])
const isLoading = ref(true)
const error = ref('')

let unsubscribe: (() => void) | null = null

// 뒤로가기
const goBack = () => {
  router.push(`/store/${storeId.value}/waiting`)
}

// 대기 시간 계산 (분 단위)
const calculateWaitingTime = (customer: WaitingCustomer): string => {
  if (!customer.createdAt || !customer.cancelledAt) return '-'

  const createdDate =
    customer.createdAt.toDate ? customer.createdAt.toDate() : new Date(customer.createdAt)
  const cancelledDate =
    customer.cancelledAt.toDate ? customer.cancelledAt.toDate() : new Date(customer.cancelledAt)

  const diffMinutes = Math.floor((cancelledDate.getTime() - createdDate.getTime()) / 1000 / 60)

  if (diffMinutes < 60) return `${diffMinutes}分`
  const hours = Math.floor(diffMinutes / 60)
  const minutes = diffMinutes % 60
  return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`
}

// 데이터 로드
const loadData = () => {
  isLoading.value = true
  error.value = ''

  try {
    unsubscribe = subscribeToCancelledHistory(storeId.value, (customers) => {
      cancelledList.value = customers
      isLoading.value = false
    })
  } catch (err) {
    console.error('데이터 로드 실패:', err)
    error.value = 'データの読み込みに失敗しました。'
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()

  // 컴포넌트 언마운트 시 구독 해제
  return () => {
    if (unsubscribe) unsubscribe()
  }
})
</script>

<template>
  <div class="history-container">
    <div class="header">
      <button @click="goBack" class="back-btn">← 戻る</button>
      <h1>取消履歴</h1>
    </div>

    <!-- 로딩 -->
    <div v-if="isLoading" class="loading">読み込み中...</div>

    <!-- 에러 -->
    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <!-- 이력 없음 -->
    <div v-else-if="cancelledList.length === 0" class="no-history">
      <div class="no-history-icon">📋</div>
      <p>取消履歴はありません。</p>
    </div>

    <!-- 이력 목록 -->
    <div v-else class="history-list">
      <div v-for="customer in cancelledList" :key="customer.id" class="history-card">
        <!-- 순번 -->
        <div class="queue-number">
          <div class="number">{{ customer.queueNumber }}</div>
          <div class="label">番</div>
        </div>

        <!-- 고객 정보 -->
        <div class="customer-info">
          <img
            v-if="customer.pictureUrl"
            :src="customer.pictureUrl"
            :alt="customer.displayName"
            class="customer-avatar"
          />
          <div v-else class="customer-avatar-placeholder">👤</div>
          <div class="customer-details">
            <div class="customer-name-row">
              <h3 class="customer-name">{{ customer.displayName }}</h3>
              <span v-if="customer.isManualRegistration" class="manual-badge">手動登録</span>
            </div>
            <div class="customer-info-details">
              <p v-if="customer.partySize" class="info-text">人数: {{ customer.partySize }}名</p>
              <p v-if="customer.phoneNumber" class="info-text">
                電話: {{ customer.phoneNumber }}
              </p>
            </div>
            <div class="customer-time-status">
              <p class="customer-time">登録: {{ formatTimestamp(customer.createdAt) }}</p>
              <p class="customer-time">取消: {{ formatTimestamp(customer.cancelledAt) }}</p>
              <p class="waiting-time">待機時間: {{ calculateWaitingTime(customer) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
}

/* 헤더 */
.header {
  margin-bottom: 1rem;
}

.back-btn {
  padding: 0.5rem 1rem;
  background-color: #f5f5f5;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  transition: background-color 0.3s;
}

.back-btn:active {
  background-color: #e0e0e0;
}

h1 {
  font-size: 1.3rem;
  margin: 0;
  color: #333;
}

/* 로딩 및 에러 */
.loading,
.error,
.no-history {
  text-align: center;
  padding: 2rem;
  font-size: 1rem;
}

.error {
  color: #f44336;
}

.no-history-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.no-history p {
  color: #666;
}

/* 이력 목록 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 순번 */
.queue-number {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 45px;
  height: 45px;
  background: linear-gradient(135deg, #9e9e9e 0%, #616161 100%);
  color: white;
  border-radius: 12px;
  flex-shrink: 0;
}

.queue-number .number {
  font-size: 1.3rem;
  font-weight: bold;
  line-height: 1;
}

.queue-number .label {
  font-size: 0.7rem;
  opacity: 0.9;
}

/* 고객 정보 */
.customer-info {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.customer-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e0e0e0;
  flex-shrink: 0;
}

.customer-avatar-placeholder {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.customer-details {
  flex: 1;
  min-width: 0;
}

.customer-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.customer-name {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.manual-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: #fff3e0;
  color: #e65100;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

.customer-info-details {
  margin-bottom: 0.5rem;
}

.info-text {
  margin: 0.25rem 0;
  font-size: 0.85rem;
  color: #666;
}

.customer-time-status {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.customer-time {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.waiting-time {
  margin: 0;
  font-size: 0.85rem;
  color: #9e9e9e;
  font-weight: 500;
}
</style>
