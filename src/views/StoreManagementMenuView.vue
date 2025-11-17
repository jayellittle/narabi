<template>
  <div class="management-menu-container">
    <div class="welcome-section">
      <h1>管理メニュー</h1>
      <p class="subtitle">管理したい項目を選択してください</p>
    </div>

    <div class="menu-grid">
      <router-link :to="`/store/${storeId}/qr`" class="menu-card qr">
        <div class="menu-icon">📱</div>
        <h2>QRコード表示</h2>
        <p class="menu-description">お客様が順番待ちに登録するためのQRコードを表示・印刷します</p>
        <div class="menu-arrow">→</div>
      </router-link>

      <router-link :to="`/store/${storeId}/waiting`" class="menu-card waiting">
        <div class="menu-icon">👥</div>
        <div class="menu-title-with-badge">
          <h2>順番待ちリスト</h2>
          <span v-if="waitingCount > 0" class="waiting-badge">{{ waitingCount }}</span>
        </div>
        <p class="menu-description">現在待機中のお客様を確認し、呼び出しを行います</p>
        <div class="menu-arrow">→</div>
      </router-link>

      <router-link :to="`/store/${storeId}/staff`" class="menu-card staff">
        <div class="menu-icon">⚙️</div>
        <h2>スタッフ管理</h2>
        <p class="menu-description">店舗スタッフの招待・管理を行います</p>
        <div class="menu-arrow">→</div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore'

const route = useRoute()
const storeId = route.params.storeId as string
const db = getFirestore()

// 대기 중인 고객 수
const waitingCount = ref(0)
let unsubscribe: (() => void) | null = null

// 대기 목록 실시간 구독
onMounted(() => {
  const q = query(
    collection(db, `stores/${storeId}/waitingList`),
    where('status', '==', 'waiting')
  )

  unsubscribe = onSnapshot(q, (snapshot) => {
    waitingCount.value = snapshot.size
  })
})

// 컴포넌트 언마운트 시 구독 해제
onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped>
.management-menu-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100%;
}

/* ウェルカムセクション */
.welcome-section {
  text-align: center;
  margin-bottom: 2rem;
}

.welcome-section h1 {
  font-size: 2rem;
  color: #333;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.subtitle {
  font-size: 1rem;
  color: #666;
  margin: 0;
}

/* メニューグリッド */
.menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

/* メニューカード */
.menu-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 1.5rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  overflow: hidden;
}

.menu-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s;
}

.menu-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.menu-card:hover::before {
  transform: scaleX(1);
}

.menu-card:active {
  transform: translateY(-4px);
}

/* カード別の色 */
.menu-card.qr:hover {
  border-color: #4caf50;
}

.menu-card.qr::before {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
}

.menu-card.waiting:hover {
  border-color: #2196f3;
}

.menu-card.waiting::before {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
}

.menu-card.staff:hover {
  border-color: #ff9800;
}

.menu-card.staff::before {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
}

/* メニューアイコン */
.menu-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 16px;
  transition: transform 0.3s;
}

.menu-card:hover .menu-icon {
  transform: scale(1.1) rotate(5deg);
}

.menu-title-with-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  justify-content: center;
}

.menu-card h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: #333;
  font-weight: 600;
}

.waiting-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background-color: #f44336;
  color: white;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
}

.menu-card p {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.5;
  flex: 1;
}

.menu-arrow {
  margin-top: 1rem;
  font-size: 1.25rem;
  color: #667eea;
  font-weight: bold;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.3s;
}

.menu-card:hover .menu-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* モバイル対応 */
@media (max-width: 768px) {
  .management-menu-container {
    padding: 1.5rem 1rem;
  }

  .welcome-section {
    margin-bottom: 2rem;
  }

  .welcome-section h1 {
    font-size: 1.8rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .menu-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .menu-card {
    padding: 0.75rem 1rem;
  }

  /* モバイルで説明文を非表示 */
  .menu-description {
    display: none;
  }

  .menu-icon {
    font-size: 3rem;
    width: 80px;
    height: 80px;
  }

  .menu-card h2 {
    font-size: 1.3rem;
  }

  /* モバイルではhoverの代わりにタップ効果 */
  .menu-card:active {
    transform: scale(0.98);
  }
}

/* タブレット対応 */
@media (min-width: 769px) and (max-width: 1024px) {
  .menu-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 小さいモバイル画面 */
@media (max-width: 480px) {
  .welcome-section h1 {
    font-size: 1.5rem;
  }

  .menu-card {
    padding: 1.5rem 1rem;
  }

  .menu-icon {
    font-size: 2.5rem;
    width: 70px;
    height: 70px;
  }
}
</style>
