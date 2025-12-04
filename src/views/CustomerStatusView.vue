<template>
  <div class="status-container">
    <div v-if="loading" class="loading">読み込み中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="myData" class="status-content">
      <h2 class="store-name">{{ store ? store.name : '読み込み中...' }}</h2>

      <div :class="['status-card', myData.status]">
        <div class="status-header">
          <span class="status-label">{{ getStatusText(myData.status) }}</span>
          <span class="queue-number">No. {{ myData.queueNumber }}</span>
        </div>

        <div v-if="myData.status === 'waiting'" class="waiting-info">
          <div class="info-row">
            <span class="label">あなたの前に</span>
            <span class="value">{{ peopleAhead }}</span>
            <span class="unit">組</span>
          </div>
          <!-- <div class="info-row highlight">
            <span class="label">予想待ち時間 約 </span>
            <span class="value">{{ estimatedWaitTime }}</span>
            <span class="unit">分</span>
          </div> -->
        </div>

        <div v-else-if="myData.status === 'called'" class="called-info">
          <h3>お客様のお呼び出しです！</h3>
          <p>スタッフの案内があるまで、<br />店舗の前でお待ちください。</p>
        </div>

        <div v-else class="end-info">
          <p>この受付は終了しました。</p>
        </div>
      </div>

      <div class="actions">
        <button @click="refreshPage" class="refresh-button">🔄 更新する</button>
      </div>
    </div>

    <div v-else class="not-found">
      <p>お客様の情報が見つかりませんでした。</p>
      <p class="sub-text">URLが正しいか確認してください。</p>
      <router-link to="/wait">トップに戻る</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useFirebase } from '../composables/useFirebase'
import type { WaitingCustomer, Store } from '../types'

const route = useRoute()
const { subscribeToWaitingList, getStore } = useFirebase()

const storeId = ref(route.params.storeId as string)
const customerId = ref(route.params.customerId as string)

const waitingList = ref<WaitingCustomer[]>([])
const store = ref<Store | null>(null)
const loading = ref(true)
const error = ref('')
let unsubscribe: (() => void) | null = null

// 내 데이터 찾기
const myData = computed(() => {
  return waitingList.value.find((c) => c.id === customerId.value)
})

// 내 앞의 대기 팀 수 계산
const peopleAhead = computed(() => {
  if (!myData.value || myData.value.status !== 'waiting') return 0

  // 상태가 waiting이고, 내 번호보다 작은 사람들의 수
  return waitingList.value.filter(
    (c) => c.status === 'waiting' && c.queueNumber < myData.value!.queueNumber,
  ).length
})

// 예상 대기 시간 (단순 계산: 1팀당 15분 가정, 필요 시 로직 고도화)
// const estimatedWaitTime = computed(() => {
//   return peopleAhead.value * 15
// })

const getStatusText = (status: string) => {
  switch (status) {
    case 'waiting':
      return '待機中'
    case 'called':
      return 'お呼出'
    case 'completed':
      return '案内済'
    case 'cancelled':
      return 'キャンセル'
    default:
      return status
  }
}

const refreshPage = () => {
  window.location.reload()
}

onMounted(async () => {
  if (!storeId.value || !customerId.value) {
    error.value = '無効なアクセスです。'
    loading.value = false
    return
  }

  try {
    const storeData = await getStore(storeId.value)
    if (storeData) {
      store.value = storeData
    }
  } catch (e) {
    console.error('Store info load failed', e)
  }

  // 전체 대기열을 구독하여 내 순서와 앞사람 수를 계산
  unsubscribe = subscribeToWaitingList(storeId.value, (customers) => {
    waitingList.value = customers

    // 내 데이터가 목록에 없으면 (완료/취소되어 리스트에서 사라진 경우 등) 처리
    // * subscribeToWaitingList는 waiting/called 상태만 가져오므로,
    // 완료/취소된 경우 myData가 없을 수 있음.
    // 이 경우 별도로 단일 문서를 가져오는 로직을 추가하거나,
    // composables의 쿼리 조건을 수정해야 할 수도 있음.
    // 현재는 목록에 없으면 '종료'로 간주하거나 로딩 상태 유지

    loading.value = false
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<style scoped>
.status-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  font-family: sans-serif;
}

.store-name {
  margin-bottom: 20px;
  color: #333;
}

.status-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 24px;
  margin-bottom: 24px;
  border-top: 6px solid #ccc;
}

.status-card.waiting {
  border-top-color: #4caf50;
}
.status-card.called {
  border-top-color: #ff9800;
  background-color: #fff3e0;
}
.status-card.completed {
  border-top-color: #2196f3;
}
.status-card.cancelled {
  border-top-color: #f44336;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
}

.status-label {
  font-weight: bold;
  font-size: 1.2rem;
  color: #555;
}

.queue-number {
  font-size: 1.5rem;
  font-weight: 800;
  color: #333;
}

.info-row {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

.info-row.highlight .value {
  color: #e91e63;
}

.value {
  font-size: 2.5rem;
  font-weight: bold;
  line-height: 1;
}

.label,
.unit {
  color: #666;
  font-size: 0.9rem;
}

.called-info h3 {
  color: #e65100;
  font-size: 1.4rem;
  margin-bottom: 10px;
}

.refresh-button {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #555;
}
</style>
