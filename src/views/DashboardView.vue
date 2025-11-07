<template>
  <div class="dashboard-container">
    <!-- 사이드바 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>🏪 NARABI</h2>
        <button @click="handleSignOut" class="logout-btn">ログアウト</button>
      </div>

      <!-- 로딩 -->
      <div v-if="isLoading" class="loading">読み込み中...</div>

      <div v-else>
        <!-- 승인된 매장 목록 -->
        <div class="store-section">
          <h3>店舗一覧</h3>

          <div v-if="approvedStores.length === 0 && pendingStores.length === 0 && invitationPendingStores.length === 0" class="no-stores">
            <p>登録された店舗がありません。</p>
            <button @click="goToRegisterStore" class="primary-btn">+ 店舗を登録</button>
          </div>

          <div v-else class="store-list">
            <!-- 초대 대기 중 (먼저 표시) -->
            <div
              v-for="store in invitationPendingStores"
              :key="store.id"
              :class="['store-item', 'invitation-pending', { active: selectedStoreId === store.id }]"
              @click="selectStore(store.id)"
            >
              <div class="store-icon">📩</div>
              <div class="store-info">
                <div class="store-name">{{ store.name }}</div>
                <div class="invitation-label">招待待ち - クリックして承認</div>
              </div>
            </div>

            <!-- 승인된 매장 -->
            <div
              v-for="store in approvedStores"
              :key="store.id"
              :class="['store-item', { active: selectedStoreId === store.id }]"
              @click="selectStore(store.id)"
            >
              <div class="store-icon">🏪</div>
              <div class="store-info">
                <div class="store-name">{{ store.name }}</div>
                <div class="store-address">{{ store.address }}</div>
              </div>
            </div>

            <!-- 관리자 승인 대기 중 -->
            <div v-for="store in pendingStores" :key="store.id" class="store-item pending">
              <div class="store-icon">⏳</div>
              <div class="store-info">
                <div class="store-name">{{ store.name }}</div>
                <div class="pending-label">承認待ち</div>
              </div>
            </div>
          </div>

          <button v-if="myStores.length > 0" @click="goToRegisterStore" class="add-store-btn">
            + 店舗を追加
          </button>
        </div>
      </div>
    </aside>

    <!-- 메인 컨텐츠 -->
    <main class="main-content">
      <div class="welcome">
        <h1>NARABI 順番待ち管理システム</h1>
        <p>左のメニューから店舗を選択してください。</p>
        <div class="welcome-image">🎫</div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { signOut } from 'firebase/auth'
import { useRouter, useRoute } from 'vue-router'
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore'
import { auth } from '../firebase'

interface Store {
  id: string
  name: string
  address: string
  status?: string
}

const router = useRouter()
const route = useRoute()
const db = getFirestore()

const myStores = ref<Store[]>([])
const isLoading = ref(true)
const selectedStoreId = ref<string | null>(null)

// 현재 선택된 매장
const selectedStore = computed(() => {
  if (!selectedStoreId.value) return null
  return myStores.value.find((s) => s.id === selectedStoreId.value) || null
})

// 승인된 매장만 필터링
const approvedStores = computed(() => {
  return myStores.value.filter((s) => s.status === 'approved' || !s.status)
})

// 승인 대기 중인 매장 (오너가 등록한 매장이 관리자 승인 대기 중)
const pendingStores = computed(() => {
  return myStores.value.filter((s) => s.status === 'pending')
})

// 초대 대기 중인 매장 (내가 스태프로 초대받아서 승인 대기 중)
const invitationPendingStores = computed(() => {
  return myStores.value.filter((s) => s.status === 'invitation-pending')
})

// 매장 로드 - 오너 + 스태프로 등록된 매장 모두 가져오기
const loadStores = async () => {
  isLoading.value = true
  try {
    const user = auth.currentUser
    if (!user) {
      router.push('/login')
      return
    }

    // 1. 내가 오너인 매장
    const ownerQuery = query(collection(db, 'stores'), where('ownerId', '==', user.uid))
    const ownerSnapshot = await getDocs(ownerQuery)

    // 2. 모든 매장을 가져와서 staffList에 내 이메일이 있는지 확인
    const allStoresQuery = query(collection(db, 'stores'))
    const allStoresSnapshot = await getDocs(allStoresQuery)

    const storesMap = new Map<string, Store>()

    // 오너인 매장 추가
    ownerSnapshot.docs.forEach((doc) => {
      storesMap.set(doc.id, {
        id: doc.id,
        name: doc.data().name as string,
        address: doc.data().address as string,
        status: (doc.data().status as string) || 'approved',
      })
    })

    // 스태프로 등록된 매장 추가 (active 또는 pending)
    allStoresSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      const staffList = data.staffList || []

      // staffList에서 내 이메일이 있는지 확인 (active 또는 pending)
      const myStaffEntry = staffList.find(
        (staff: any) => staff.email === user.email && (staff.status === 'active' || staff.status === 'pending'),
      )

      if (myStaffEntry && !storesMap.has(doc.id)) {
        storesMap.set(doc.id, {
          id: doc.id,
          name: data.name as string,
          address: data.address as string,
          status: myStaffEntry.status === 'pending' ? 'invitation-pending' : ((data.status as string) || 'approved'),
        })
      }
    })

    myStores.value = Array.from(storesMap.values())

    // URL에 storeId가 있으면 자동 선택
    if (route.params.storeId) {
      selectedStoreId.value = route.params.storeId as string
    } else if (approvedStores.value.length > 0) {
      // 첫 번째 승인된 매장 자동 선택
      selectedStoreId.value = approvedStores.value[0].id
    }
  } catch (error) {
    console.error('매장 로드 실패:', error)
  } finally {
    isLoading.value = false
  }
}

// 매장 선택
const selectStore = (storeId: string) => {
  selectedStoreId.value = storeId

  // 초대 대기 중인 매장은 스태프 관리 페이지로 직접 이동
  const store = myStores.value.find((s) => s.id === storeId)
  if (store?.status === 'invitation-pending') {
    router.push(`/store/${storeId}/staff`)
  } else {
    router.push(`/store/${storeId}`)
  }
}

// 로그아웃
const handleSignOut = async () => {
  try {
    await signOut(auth)
    router.push('/login')
  } catch (error) {
    console.error('로그아웃 실패:', error)
  }
}

// 매장 등록 페이지로 이동
const goToRegisterStore = () => {
  router.push('/register-store')
}

onMounted(() => {
  loadStores()
})
</script>

<style scoped>
.dashboard-container {
  display: flex;
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* 사이드바 */
.sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  color: #4caf50;
  font-size: 1.5rem;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.3s;
}

.logout-btn:hover {
  background-color: #da190b;
}

.loading {
  padding: 2rem;
  text-align: center;
  color: #666;
}

/* 매장 섹션 */
.store-section {
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.store-section h3 {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.no-stores {
  text-align: center;
  padding: 1rem 0;
}

.no-stores p {
  color: #999;
  margin-bottom: 1rem;
}

.primary-btn {
  padding: 0.75rem 1.5rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.primary-btn:hover {
  background-color: #45a049;
}

.store-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.store-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.store-item:not(.pending):hover {
  background-color: #f5f5f5;
}

.store-item.active {
  background-color: #e8f5e9;
  border-left: 3px solid #4caf50;
}

.store-item.pending {
  opacity: 0.6;
  cursor: default;
}

.store-item.invitation-pending {
  background-color: #fff3e0;
  border-left: 3px solid #ff9800;
  cursor: pointer;
  opacity: 1;
}

.store-item.invitation-pending:hover {
  background-color: #ffe0b2;
}

.store-item.invitation-pending.active {
  background-color: #ffcc80;
}

.store-icon {
  font-size: 1.5rem;
}

.store-info {
  flex: 1;
  min-width: 0;
}

.store-name {
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.store-address {
  font-size: 0.8rem;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.25rem;
}

.pending-label {
  font-size: 0.75rem;
  color: #ff9800;
  margin-top: 0.25rem;
}

.invitation-label {
  font-size: 0.75rem;
  color: #f57c00;
  margin-top: 0.25rem;
  font-weight: 500;
}

.add-store-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: #f5f5f5;
  color: #333;
  border: 1px dashed #ccc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.add-store-btn:hover {
  background-color: #e0e0e0;
  border-color: #999;
}

/* 메인 컨텐츠 */
.main-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.welcome {
  text-align: center;
  padding: 4rem 2rem;
}

.welcome h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 1rem;
}

.welcome p {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 2rem;
}

.welcome-image {
  font-size: 8rem;
  opacity: 0.3;
}

/* 반응형 */
@media (max-width: 768px) {
  .dashboard-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .main-content {
    padding: 1rem;
  }
}
</style>
