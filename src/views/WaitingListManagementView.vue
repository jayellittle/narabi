<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFirebase, useTimeFormat } from '../composables/useFirebase'
import type { WaitingCustomer } from '../types'

const route = useRoute()
const router = useRouter()
const { subscribeToWaitingList, callCustomer, cancelWaiting, completeEntry, registerManualCustomer } =
  useFirebase()
const { formatTimestamp } = useTimeFormat()

const storeId = ref(route.params.storeId as string)
const waitingList = ref<WaitingCustomer[]>([])
const isLoading = ref(true)
const error = ref('')
const processingCustomerId = ref<string | null>(null)
const showManualRegistrationModal = ref(false)
const manualRegistrationForm = ref({
  displayName: '',
  partySize: 1,
  phoneNumber: '',
})
const isSubmittingManualRegistration = ref(false)

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

// 이력 페이지로 이동
const goToCompletedHistory = () => {
  router.push(`/store/${storeId.value}/completed-history`)
}

const goToCancelledHistory = () => {
  router.push(`/store/${storeId.value}/cancelled-history`)
}

// 수동 등록 모달 열기/닫기
const openManualRegistrationModal = () => {
  showManualRegistrationModal.value = true
  // 폼 초기화
  manualRegistrationForm.value = {
    displayName: '',
    partySize: 1,
    phoneNumber: '',
  }
}

const closeManualRegistrationModal = () => {
  showManualRegistrationModal.value = false
}

// 수동 고객 등록
const handleManualRegistration = async () => {
  const { displayName, partySize, phoneNumber } = manualRegistrationForm.value

  if (!displayName.trim()) {
    alert('お客様のお名前を入力してください。')
    return
  }

  if (partySize < 1) {
    alert('人数は1人以上を入力してください。')
    return
  }

  if (!phoneNumber.trim()) {
    alert('電話番号を入力してください。')
    return
  }

  const confirm = window.confirm(
    `以下の内容で登録しますか？\n\nお名前: ${displayName}\n人数: ${partySize}名\n電話番号: ${phoneNumber}`,
  )

  if (!confirm) return

  isSubmittingManualRegistration.value = true

  try {
    await registerManualCustomer(storeId.value, {
      displayName: displayName.trim(),
      partySize,
      phoneNumber: phoneNumber.trim(),
    })
    closeManualRegistrationModal()
    alert('お客様を登録しました。')
  } catch (err: any) {
    console.error('수동 등록 실패:', err)
    alert(err.message || 'お客様の登録に失敗しました。')
  } finally {
    isSubmittingManualRegistration.value = false
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

      <!-- 이력 및 수동 등록 버튼 -->
      <div class="action-buttons">
        <button @click="goToCompletedHistory" class="history-btn completed-btn">
          来店完了履歴
        </button>
        <button @click="goToCancelledHistory" class="history-btn cancelled-btn">取消履歴</button>
        <button @click="openManualRegistrationModal" class="manual-registration-btn">
          ➕ お客様を追加
        </button>
      </div>

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
      <div v-for="customer in filteredList" :key="customer.id" class="customer-card">
        <!-- 순번 -->
        <div class="queue-number">
          <div class="number">{{ customer.queueNumber }}</div>
          <div class="label">番</div>
        </div>

        <!-- 액션 버튼 (모바일에서만 여기에 표시) -->
        <div class="customer-actions mobile-actions">
          <!-- 수동 등록 고객 -->
          <template v-if="customer.isManualRegistration">
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

          <!-- LINE 등록 고객 - 대기 중 -->
          <template v-else-if="customer.status === 'waiting'">
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

          <!-- LINE 등록 고객 - 호출됨 -->
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
            v-if="customer.pictureUrl"
            :src="customer.pictureUrl"
            :alt="customer.displayName"
            class="customer-avatar"
          />
          <div v-else class="customer-avatar-placeholder">👤</div>
          <div class="customer-details">
            <div class="customer-name-row">
              <h3 class="customer-name">{{ customer.displayName }}</h3>
              <span :class="['status-badge', getStatusClass(customer.status)]">
                {{ getStatusLabel(customer.status) }}
              </span>
            </div>
            <div class="customer-time-status">
              <p class="customer-time">登録: {{ formatTimestamp(customer.createdAt) }}</p>
              <p v-if="customer.calledAt" class="customer-time">
                呼出: {{ formatTimestamp(customer.calledAt) }}
              </p>
            </div>
          </div>
        </div>

        <!-- 액션 버튼 (PC에서만 여기에 표시) -->
        <div class="customer-actions desktop-actions">
          <!-- 수동 등록 고객 -->
          <template v-if="customer.isManualRegistration">
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

          <!-- LINE 등록 고객 - 대기 중 -->
          <template v-else-if="customer.status === 'waiting'">
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

          <!-- LINE 등록 고객 - 호출됨 -->
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

    <!-- 수동 등록 모달 -->
    <div v-if="showManualRegistrationModal" class="modal-overlay" @click="closeManualRegistrationModal">
      <div class="modal-content" @click.stop>
        <h2>お客様を追加</h2>
        <form @submit.prevent="handleManualRegistration">
          <div class="form-group">
            <label for="displayName">お名前 *</label>
            <input
              id="displayName"
              v-model="manualRegistrationForm.displayName"
              type="text"
              placeholder="お客様のお名前"
              required
            />
          </div>

          <div class="form-group">
            <label for="partySize">人数 *</label>
            <input
              id="partySize"
              v-model.number="manualRegistrationForm.partySize"
              type="number"
              min="1"
              placeholder="人数"
              required
            />
          </div>

          <div class="form-group">
            <label for="phoneNumber">電話番号 *</label>
            <input
              id="phoneNumber"
              v-model="manualRegistrationForm.phoneNumber"
              type="tel"
              placeholder="電話番号"
              required
            />
          </div>

          <div class="modal-actions">
            <button
              type="button"
              @click="closeManualRegistrationModal"
              class="cancel-modal-btn"
              :disabled="isSubmittingManualRegistration"
            >
              キャンセル
            </button>
            <button type="submit" class="submit-btn" :disabled="isSubmittingManualRegistration">
              {{ isSubmittingManualRegistration ? '登録中...' : '登録' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* モバイルファースト: すべてのデバイスで同じUIを表示 */
.waiting-list-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
}

/* 헤더 */
.header {
  margin-bottom: 1rem;
}

h1 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
  color: #333;
}

/* 액션 버튼들 */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.history-btn {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.history-btn.completed-btn {
  background-color: #e3f2fd;
  color: #1565c0;
}

.history-btn.completed-btn:active {
  background-color: #bbdefb;
}

.history-btn.cancelled-btn {
  background-color: #f5f5f5;
  color: #757575;
}

.history-btn.cancelled-btn:active {
  background-color: #e0e0e0;
}

.manual-registration-btn {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.manual-registration-btn:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.stats {
  display: flex;
  gap: 0.5rem;
}

.stat-card {
  flex: 1;
  padding: 1rem;
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
  font-size: 1.75rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  opacity: 0.9;
}

/* 필터 */
.filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filters button {
  flex: 1;
  padding: 0.75rem 0.5rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 0.85rem;
}

.filters button:active {
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
  padding: 2rem;
  font-size: 1rem;
}

.error {
  color: #f44336;
}

.no-customers-icon {
  font-size: 3rem;
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
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
  gap: 1rem;
  padding: 1.25rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s;
}

.customer-card:active {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* 순번 */
.queue-number {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 45px;
  height: 45px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

/* 액션 버튼 (모바일) */
.customer-actions.mobile-actions {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  gap: 0.5rem;
  flex: 1;
  align-self: center;
}

/* 고객 정보 */
.customer-info {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
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

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
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

/* desktop-actions 숨김 */
.customer-actions.desktop-actions {
  display: none;
}

.action-btn {
  flex: 1;
  padding: 0.6rem 0.4rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
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

.call-btn:active:not(:disabled) {
  background-color: #45a049;
  transform: scale(0.98);
}

.complete-btn {
  background-color: #2196f3;
  color: white;
}

.complete-btn:active:not(:disabled) {
  background-color: #1976d2;
  transform: scale(0.98);
}

.cancel-btn {
  background-color: #f44336;
  color: white;
}

.cancel-btn:active:not(:disabled) {
  background-color: #da190b;
  transform: scale(0.98);
}

/* 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-content h2 {
  margin: 0 0 1.5rem 0;
  font-size: 1.3rem;
  color: #333;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.cancel-modal-btn,
.submit-btn {
  flex: 1;
  padding: 0.875rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.cancel-modal-btn {
  background-color: #f5f5f5;
  color: #666;
}

.cancel-modal-btn:active:not(:disabled) {
  background-color: #e0e0e0;
}

.submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.98);
  opacity: 0.9;
}

.cancel-modal-btn:disabled,
.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* モバイルファースト: すべてのデバイスで同じUIを表示 */
</style>
