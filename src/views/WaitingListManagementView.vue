<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useFirebase, useTimeFormat } from '../composables/useFirebase'
import type { WaitingCustomer } from '../types'

const route = useRoute()
const { subscribeToWaitingList, callCustomer, cancelWaiting, completeEntry } = useFirebase()
const { formatTimestamp } = useTimeFormat()

const storeId = ref(route.params.storeId as string)
const waitingList = ref<WaitingCustomer[]>([])
const isLoading = ref(true)
const error = ref('')
const processingCustomerId = ref<string | null>(null)

let unsubscribe: (() => void) | null = null

// 상태별 필터링
const statusFilter = ref<'all' | 'waiting' | 'called'>('all')

const filteredList = computed(() => {
  if (statusFilter.value === 'all') {
    return waitingList.value
  }
  return waitingList.value.filter((customer) => customer.status === statusFilter.value)
})

// 통계
const stats = computed(() => {
  return {
    total: waitingList.value.length,
    waiting: waitingList.value.filter((c) => c.status === 'waiting').length,
    called: waitingList.value.filter((c) => c.status === 'called').length,
  }
})

// 상태 라벨
const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    waiting: '待機中',
    called: '呼出済',
    cancelled: '取消',
    completed: '完了',
  }
  return labels[status] || status
}

// 상태 색상 클래스
const getStatusClass = (status: string): string => {
  return `status-${status}`
}

// 고객 호출
const handleCallCustomer = async (customer: WaitingCustomer) => {
  if (processingCustomerId.value) return

  const confirm = window.confirm(
    `${customer.displayName}様を呼び出しますか？\nLINEメッセージが送信されます。`,
  )

  if (!confirm) return

  processingCustomerId.value = customer.id

  try {
    await callCustomer(storeId.value, customer.id)
    // 성공 메시지는 표시하지 않음 (실시간으로 상태 업데이트됨)
  } catch (err: any) {
    console.error('호출 실패:', err)
    alert(err.message || '呼び出しに失敗しました。')
  } finally {
    processingCustomerId.value = null
  }
}

// 입장 완료
const handleCompleteEntry = async (customer: WaitingCustomer) => {
  if (processingCustomerId.value) return

  const confirm = window.confirm(`${customer.displayName}様の入店を完了しますか？`)

  if (!confirm) return

  processingCustomerId.value = customer.id

  try {
    await completeEntry(storeId.value, customer.id)
  } catch (err: any) {
    console.error('완료 처리 실패:', err)
    alert(err.message || '完了処理に失敗しました。')
  } finally {
    processingCustomerId.value = null
  }
}

// 취소
const handleCancelWaiting = async (customer: WaitingCustomer) => {
  if (processingCustomerId.value) return

  const confirm = window.confirm(`${customer.displayName}様の待機をキャンセルしますか？`)

  if (!confirm) return

  processingCustomerId.value = customer.id

  try {
    await cancelWaiting(storeId.value, customer.id)
  } catch (err: any) {
    console.error('취소 실패:', err)
    alert(err.message || 'キャンセルに失敗しました。')
  } finally {
    processingCustomerId.value = null
  }
}

// 데이터 로드
const loadData = () => {
  isLoading.value = true
  error.value = ''

  try {
    unsubscribe = subscribeToWaitingList(storeId.value, (customers) => {
      waitingList.value = customers
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
  <div class="waiting-list-container">
    <div class="header">
      <h1>順番待ち中のお客様リスト</h1>

      <!-- 통계 -->
      <div class="stats">
        <div class="stat-card total">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">合計</div>
        </div>
        <div class="stat-card waiting">
          <div class="stat-value">{{ stats.waiting }}</div>
          <div class="stat-label">待機中</div>
        </div>
        <div class="stat-card called">
          <div class="stat-value">{{ stats.called }}</div>
          <div class="stat-label">呼出済</div>
        </div>
      </div>
    </div>

    <!-- 필터 -->
    <div class="filters">
      <button :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">
        全て ({{ stats.total }})
      </button>
      <button :class="{ active: statusFilter === 'waiting' }" @click="statusFilter = 'waiting'">
        待機中 ({{ stats.waiting }})
      </button>
      <button :class="{ active: statusFilter === 'called' }" @click="statusFilter = 'called'">
        呼出済 ({{ stats.called }})
      </button>
    </div>

    <!-- 로딩 -->
    <div v-if="isLoading" class="loading">読み込み中...</div>

    <!-- 에러 -->
    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <!-- 대기자 목록 -->
    <div v-else-if="filteredList.length === 0" class="no-customers">
      <div class="no-customers-icon">😊</div>
      <p>現在待機中のお客様はいません。</p>
    </div>

    <div v-else class="customer-list">
      <div v-for="(customer, index) in filteredList" :key="customer.id" class="customer-card">
        <!-- 순번 -->
        <div class="queue-number">
          <div class="number">{{ customer.queueNumber }}</div>
          <div class="label">番</div>
        </div>

        <!-- 액션 버튼 (모바일에서만 여기에 표시) -->
        <div class="customer-actions mobile-actions">
          <!-- 대기 중 -->
          <template v-if="customer.status === 'waiting'">
            <button
              @click="handleCallCustomer(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn call-btn"
            >
              📞 呼出
            </button>
            <button
              @click="handleCancelWaiting(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn cancel-btn"
            >
              ❌ 取消
            </button>
          </template>

          <!-- 호출됨 -->
          <template v-else-if="customer.status === 'called'">
            <button
              @click="handleCompleteEntry(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn complete-btn"
            >
              ✅ 来店完了
            </button>
            <button
              @click="handleCancelWaiting(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn cancel-btn"
            >
              ❌ 取消
            </button>
          </template>
        </div>

        <!-- 고객 정보 -->
        <div class="customer-info">
          <img
            :src="customer.pictureUrl || '/default-avatar.png'"
            :alt="customer.displayName"
            class="customer-avatar"
          />
          <div class="customer-details">
            <h3 class="customer-name">{{ customer.displayName }}</h3>
            <div class="customer-time-status">
              <div class="time-info">
                <p class="customer-time">登録: {{ formatTimestamp(customer.createdAt) }}</p>
                <p v-if="customer.calledAt" class="customer-time">
                  呼出: {{ formatTimestamp(customer.calledAt) }}
                </p>
              </div>
              <span :class="['status-badge', getStatusClass(customer.status)]">
                {{ getStatusLabel(customer.status) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 액션 버튼 (PC에서만 여기에 표시) -->
        <div class="customer-actions desktop-actions">
          <!-- 대기 중 -->
          <template v-if="customer.status === 'waiting'">
            <button
              @click="handleCallCustomer(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn call-btn"
            >
              📞 呼出
            </button>
            <button
              @click="handleCancelWaiting(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn cancel-btn"
            >
              ❌ 取消
            </button>
          </template>

          <!-- 호출됨 -->
          <template v-else-if="customer.status === 'called'">
            <button
              @click="handleCompleteEntry(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn complete-btn"
            >
              ✅ 来店完了
            </button>
            <button
              @click="handleCancelWaiting(customer)"
              :disabled="processingCustomerId === customer.id"
              class="action-btn cancel-btn"
            >
              ❌ 取消
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.waiting-list-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* 헤더 */
.header {
  margin-bottom: 2rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 1.5rem;
  color: #333;
}

.stats {
  display: flex;
  gap: 1rem;
}

.stat-card {
  flex: 1;
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  color: white;
}

.stat-card.total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-card.waiting {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.called {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.9;
}

/* 필터 */
.filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding: 0.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filters button {
  flex: 1;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 0.95rem;
}

.filters button:hover {
  background: #f5f5f5;
}

.filters button.active {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
  font-weight: 500;
}

/* 로딩 및 에러 */
.loading,
.error,
.no-customers {
  text-align: center;
  padding: 3rem;
  font-size: 1.1rem;
}

.error {
  color: #f44336;
}

.no-customers-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.no-customers p {
  color: #666;
}

/* 고객 목록 */
.customer-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.customer-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s;
}

.customer-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* 순번 */
.queue-number {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
}

.queue-number .number {
  font-size: 1.8rem;
  font-weight: bold;
  line-height: 1;
}

.queue-number .label {
  font-size: 0.75rem;
  opacity: 0.9;
}

/* 고객 정보 */
.customer-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.customer-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e0e0e0;
}

.customer-details {
  flex: 1;
  min-width: 0;
}

.customer-name {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  color: #333;
}

.customer-time-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.time-info {
  flex: 1;
  min-width: 0;
}

.customer-time {
  margin: 0.125rem 0;
  font-size: 0.85rem;
  color: #666;
}

.status-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.status-waiting {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-called {
  background-color: #ffebee;
  color: #c62828;
}

.status-cancelled {
  background-color: #f5f5f5;
  color: #757575;
}

.status-completed {
  background-color: #e3f2fd;
  color: #1565c0;
}

/* 액션 버튼 */
.customer-actions {
  display: flex;
  gap: 0.5rem;
}

/* PC에서는 mobile-actions 숨기고 desktop-actions 표시 */
.mobile-actions {
  display: none;
}

.desktop-actions {
  display: flex;
}

.action-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s;
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.call-btn {
  background-color: #4caf50;
  color: white;
}

.call-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.complete-btn {
  background-color: #2196f3;
  color: white;
}

.complete-btn:hover:not(:disabled) {
  background-color: #1976d2;
}

.cancel-btn {
  background-color: #f44336;
  color: white;
}

.cancel-btn:hover:not(:disabled) {
  background-color: #da190b;
}

/* 反応形 */
@media (max-width: 768px) {
  .waiting-list-container {
    padding: 1rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  .stats {
    gap: 0.5rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .stat-label {
    font-size: 0.75rem;
  }

  .filters {
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .filters button {
    padding: 0.75rem 0.5rem;
    font-size: 0.85rem;
  }

  .customer-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
  }

  /* 모바일: desktop-actions 숨기고 mobile-actions 표시 */
  .desktop-actions {
    display: none !important;
  }

  .mobile-actions {
    display: flex !important;
    gap: 0.5rem;
  }

  .queue-number {
    min-width: 60px;
    height: 60px;
  }

  .queue-number .number {
    font-size: 1.8rem;
  }

  .customer-info {
    width: 100%;
  }

  .customer-avatar {
    width: 50px;
    height: 50px;
  }

  .customer-name {
    font-size: 1.1rem;
  }

  .customer-time-status {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.75rem 0.5rem;
    font-size: 0.85rem;
  }
}

/* 小さいモバイル画面 */
@media (max-width: 480px) {
  h1 {
    font-size: 1.3rem;
  }

  .stat-value {
    font-size: 1.75rem;
  }

  .queue-number {
    min-width: 60px;
    height: 60px;
  }

  .queue-number .number {
    font-size: 1.6rem;
  }
}
</style>
