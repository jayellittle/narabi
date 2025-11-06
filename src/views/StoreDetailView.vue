<template>
  <div class="store-detail-container">
    <!-- 사이드바 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>🏪 NARABI</h2>
        <button @click="goBack" class="back-btn">← 戻る</button>
      </div>

      <div v-if="store" class="store-info-section">
        <!-- 점포 정보 -->
        <div class="store-card">
          <div class="store-icon">🏪</div>
          <div class="store-details">
            <h3 class="store-name">{{ store.name }}</h3>
            <p class="store-address">{{ store.address }}</p>
          </div>
        </div>

        <!-- 관리 메뉴 -->
        <nav class="nav-menu">
          <h3>管理メニュー</h3>
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
        </nav>
      </div>

      <div v-else class="loading">読み込み中...</div>
    </aside>

    <!-- 메인 컨텐츠 -->
    <main class="main-content">
      <router-view v-if="store" />
      <div v-else class="loading-content">
        <p>店舗情報を読み込み中...</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFirestore, doc, getDoc } from 'firebase/firestore'

interface Store {
  id: string
  name: string
  address: string
  phoneNumber: string
  googleMapsUrl?: string
  ownerId: string
  createdAt: any
}

const db = getFirestore()
const route = useRoute()
const router = useRouter()
const storeId = route.params.storeId as string

const store = ref<Store | null>(null)

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

const goBack = () => {
  router.push('/dashboard')
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

.store-card {
  margin: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.store-icon {
  font-size: 2.5rem;
  background: rgba(255, 255, 255, 0.2);
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.store-details {
  flex: 1;
  min-width: 0;
}

.store-name {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.store-address {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* 반응형 */
@media (max-width: 768px) {
  .store-detail-container {
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

  .store-card {
    margin: 1rem;
    padding: 1rem;
  }

  .store-icon {
    font-size: 2rem;
    width: 50px;
    height: 50px;
  }

  .store-name {
    font-size: 1.1rem;
  }
}
</style>
