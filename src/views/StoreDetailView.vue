<template>
  <div class="store-detail-container">
    <!-- 사이드바 (데스크톱 또는 모바일 메뉴 페이지에서만 표시) -->
    <aside class="sidebar" :class="{ 'hide-on-mobile': !isMenuPage }">
      <div class="sidebar-header">
        <h2>🏪 NARABI</h2>
        <button @click="goBack" class="back-btn">← 戻る</button>
      </div>

      <div v-if="store" class="store-info-section">
        <!-- 관리 메뉴 -->
        <nav class="nav-menu">
          <h3>管理メニュー</h3>
          <template v-if="isCurrentUserPending">
            <!-- pending 사용자는 스태프 관리만 접근 가능 -->
            <router-link :to="`/store/${storeId}/staff`" class="nav-item" active-class="active">
              <span class="nav-icon">⚙️</span>
              招待承認
            </router-link>
            <div class="menu-notice">
              ℹ️ 招待を承認すると全てのメニューにアクセスできます
            </div>
          </template>
          <template v-else>
            <!-- active 사용자는 전체 메뉴 접근 가능 -->
            <router-link :to="`/store/${storeId}`" class="nav-item" :class="{ active: isMenuPage }" exact>
              <span class="nav-icon">🏠</span>
              メニュー
            </router-link>
            <router-link :to="`/store/${storeId}/qr`" class="nav-item" active-class="active">
              <span class="nav-icon">📱</span>
              QRコード表示
            </router-link>
            <router-link :to="`/store/${storeId}/waiting`" class="nav-item" active-class="active">
              <span class="nav-icon">👥</span>
              順番待ちリスト
            </router-link>
            <router-link :to="`/store/${storeId}/staff`" class="nav-item" active-class="active">
              <span class="nav-icon">⚙️</span>
              スタッフ管理
            </router-link>
          </template>
        </nav>
      </div>

      <div v-else class="loading">読み込み中...</div>
    </aside>

    <!-- 메인 컨텐츠 -->
    <main class="main-content">
      <!-- 모바일 헤더 -->
      <div v-if="store" class="mobile-header">
        <div class="mobile-header-top">
          <button @click="isMenuPage ? goBack() : goToMenu()" class="mobile-back-btn-icon">
            ←
          </button>
          <div class="mobile-user-info">
            <img
              :src="currentStaffMember?.staffImageUrl || currentUser?.photoURL || '/default-avatar.png'"
              alt="プロフィール画像"
              class="mobile-user-avatar"
            />
            <span class="mobile-user-name">{{ currentStaffMember?.displayName || currentUser?.email }}</span>
          </div>
        </div>
        <div class="mobile-store-name">{{ store.name }}</div>
      </div>

      <!-- PC 헤더 (store info card) - 메뉴 페이지에서만 표시 -->
      <div v-if="store && isMenuPage" class="pc-store-header">
        <div class="store-header-card">
          <img
            v-if="store.imageUrl"
            :src="store.imageUrl"
            alt="店舗画像"
            class="store-header-image"
          />
          <div class="store-icon" v-else>🏪</div>
          <div class="store-header-details">
            <h3 class="store-header-name">{{ store.name }}</h3>
            <p class="store-header-address">{{ store.address }}</p>
          </div>
        </div>
      </div>

      <router-view v-if="store" />
      <div v-else class="loading-content">
        <p>店舗情報を読み込み中...</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

interface StaffMember {
  email: string
  userId?: string
  role: 'owner' | 'staff'
  status: 'pending' | 'active' | 'rejected'
  invitedAt: any
}

interface Store {
  id: string
  name: string
  address: string
  phoneNumber: string
  googleMapsUrl?: string
  ownerId: string
  staffList?: StaffMember[]
  createdAt: any
}

const db = getFirestore()
const auth = getAuth()
const route = useRoute()
const router = useRouter()
const storeId = route.params.storeId as string

const store = ref<Store | null>(null)

// 現在のユーザー
const currentUser = computed(() => auth.currentUser)

// 現在のページがメニューページかどうか
const isMenuPage = computed(() => {
  return route.name === 'StoreManagementMenu'
})

// 現在のスタッフメンバー情報
const currentStaffMember = computed(() => {
  if (!store.value || !currentUser.value) return null
  return store.value.staffList?.find(
    (s) => s.email === currentUser.value?.email
  )
})

// 現在のユーザーがpending状態かどうか
const isCurrentUserPending = computed(() => {
  return currentStaffMember.value?.status === 'pending'
})

onMounted(async () => {
  if (storeId) {
    try {
      const storeDocRef = doc(db, 'stores', storeId)
      const storeDoc = await getDoc(storeDocRef)

      if (storeDoc.exists()) {
        store.value = {
          id: storeDoc.id,
          ...storeDoc.data(),
        } as Store
      } else {
        console.error('Store not found!')
        alert('店舗情報が見つかりませんでした。')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error loading store:', error)
      alert('店舗情報の読み込みに失敗しました。')
      router.push('/dashboard')
    }
  }
})

// pending ユーザーがアクセスできないページへの遷移を防ぐ
watch(
  () => [route.path, isCurrentUserPending.value],
  ([currentPath, isPending]) => {
    if (isPending && store.value) {
      const restrictedPaths = [
        `/store/${storeId}`,
        `/store/${storeId}/qr`,
        `/store/${storeId}/waiting`,
      ]

      if (restrictedPaths.includes(currentPath as string)) {
        alert('招待を承認すると全てのメニューにアクセスできます。')
        router.replace(`/store/${storeId}/staff`)
      }
    }
  },
  { immediate: true }
)

const goBack = () => {
  router.push('/dashboard')
}

const goToMenu = () => {
  // pending ユーザーは店舗一覧に戻る
  if (isCurrentUserPending.value) {
    router.push('/dashboard')
    return
  }
  router.push(`/store/${storeId}`)
}
</script>

<style scoped>
.store-detail-container {
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

.back-btn {
  padding: 0.5rem 1rem;
  background-color: #666;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.3s;
}

.back-btn:hover {
  background-color: #555;
}

.loading {
  padding: 2rem;
  text-align: center;
  color: #666;
}

/* 점포 정보 섹션 */
.store-info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* PC 헤더 (store info card) */
.pc-store-header {
  display: none;
}

.store-header-card {
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.store-header-image {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.store-icon {
  font-size: 3rem;
  background: rgba(255, 255, 255, 0.2);
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  flex-shrink: 0;
}

.store-header-details {
  flex: 1;
  min-width: 0;
}

.store-header-name {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.store-header-address {
  margin: 0;
  font-size: 1rem;
  opacity: 0.9;
}

/* Desktop에서 PC 헤더 표시 */
@media (min-width: 769px) {
  .pc-store-header {
    display: block;
  }
}

/* 네비게이션 메뉴 */
.nav-menu {
  padding: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.nav-menu h3 {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  color: #333;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.3s;
  margin-bottom: 0.5rem;
}

.nav-item:hover {
  background-color: #f5f5f5;
}

.nav-item.active {
  background-color: #4caf50;
  color: white;
}

.nav-icon {
  font-size: 1.2rem;
}

.menu-notice {
  padding: 0.75rem;
  margin: 0.5rem 0;
  background-color: #fff3e0;
  color: #f57c00;
  border-radius: 6px;
  font-size: 0.85rem;
  line-height: 1.4;
}

/* 메인 컨텐츠 */
.main-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.loading-content {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

/* モバイルヘッダー */
.mobile-header {
  display: none;
  position: sticky;
  top: 0;
  z-index: 100;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 0.75rem 1rem;
  flex-direction: column;
  gap: 0.5rem;
}

.mobile-header-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mobile-back-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 1.25rem;
  font-weight: bold;
  color: #333;
  flex-shrink: 0;
}

.mobile-back-btn-icon:hover {
  background: #e0e0e0;
}

.mobile-back-btn-icon:active {
  background: #d0d0d0;
}

.mobile-user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.mobile-user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid #e0e0e0;
}

.mobile-user-name {
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-store-name {
  font-weight: 600;
  color: #333;
  font-size: 1rem;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 0.25rem;
}

/* 反応形 */
@media (max-width: 768px) {
  .store-detail-container {
    flex-direction: column;
  }

  /* モバイルでは常にサイドバーを非表示 */
  .sidebar {
    display: none;
  }

  .main-content {
    padding: 0;
    width: 100%;
  }

  /* モバイルヘッダーを表示 */
  .mobile-header {
    display: flex;
  }
}
</style>
