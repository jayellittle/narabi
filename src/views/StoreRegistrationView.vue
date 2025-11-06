<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const router = useRouter()
const db = getFirestore()
const auth = getAuth()

// 모드: 기존 매장 등록 vs 새 매장 생성
const mode = ref<'existing' | 'new'>('new')

// 기존 매장 검색
interface Store {
  id: string
  name: string
  address: string
  phoneNumber: string
  status?: string
}

const stores = ref<Store[]>([])
const storeSearch = ref('')
const isLoadingStores = ref(false)

// 새 매장 정보
const newStore = ref({
  storeName: '',
  address: '',
  phoneNumber: '',
  googleMapsUrl: '',
})
const requestMessage = ref('')

// 제출 상태
const isSubmitting = ref(false)
const errorMessage = ref('')

// 검색된 매장 목록
const filteredStores = computed(() => {
  if (!storeSearch.value) return stores.value

  const search = storeSearch.value.toLowerCase()
  return stores.value.filter(
    (store) =>
      store.name.toLowerCase().includes(search) || store.address.toLowerCase().includes(search),
  )
})

// 매장 목록 로드
const loadStores = async () => {
  isLoadingStores.value = true
  try {
    const q = query(collection(db, 'stores'), where('status', '==', 'approved'))
    const snapshot = await getDocs(q)
    stores.value = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Store,
    )
  } catch (error) {
    console.error('매장 목록 로드 실패:', error)
    errorMessage.value = '店舗リストの読み込みに失敗しました。'
  } finally {
    isLoadingStores.value = false
  }
}

// 기존 매장 참여 요청
const handleJoinStore = async (storeId: string) => {
  const user = auth.currentUser
  if (!user) {
    alert('ログインが必要です。')
    router.push('/login')
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    // 1. 이미 스태프로 등록되어 있는지 확인
    const storeRef = doc(db, 'stores', storeId)
    const storeDoc = await getDoc(storeRef)

    if (storeDoc.exists()) {
      const staffList = storeDoc.data().staffList || []
      const isAlreadyStaff = staffList.some(
        (staff: any) => staff.email === user.email && staff.status === 'active',
      )

      if (isAlreadyStaff) {
        alert('既にこの店舗のスタッフとして登録されています。')
        router.push('/dashboard')
        return
      }

      const isPending = staffList.some(
        (staff: any) => staff.email === user.email && staff.status === 'pending',
      )

      if (isPending) {
        alert('既に招待を受けています。スタッフ管理ページで承認してください。')
        router.push('/dashboard')
        return
      }
    }

    // 2. 기존 리퀘스트 확인 (pending + rejected 모두)
    const existingRequestQuery = query(
      collection(db, 'storeJoinRequests'),
      where('storeId', '==', storeId),
      where('userEmail', '==', user.email),
    )

    const existingRequests = await getDocs(existingRequestQuery)

    // pending 리퀘스트가 있는지 확인
    const pendingRequest = existingRequests.docs.find((doc) => doc.data().status === 'pending')

    if (pendingRequest) {
      alert('既に参加リクエストを送信しています。承認をお待ちください。')
      router.push('/dashboard')
      return
    }

    // rejected 리퀘스트가 있으면 pending으로 업데이트
    const rejectedRequest = existingRequests.docs.find((doc) => doc.data().status === 'rejected')

    if (rejectedRequest) {
      await updateDoc(doc(db, 'storeJoinRequests', rejectedRequest.id), {
        status: 'pending',
        userId: user.uid,
        message: requestMessage.value,
        createdAt: serverTimestamp(),
      })

      alert('参加リクエストを再送信しました。承認をお待ちください。')
      router.push('/dashboard')
      return
    }

    // 3. 새 리퀘스트 작성
    await addDoc(collection(db, 'storeJoinRequests'), {
      storeId,
      userId: user.uid,
      userEmail: user.email || '',
      message: requestMessage.value,
      status: 'pending',
      createdAt: serverTimestamp(),
    })

    alert('参加リクエストを送信しました。承認をお待ちください。')
    router.push('/dashboard')
  } catch (error: any) {
    console.error('참여 요청 실패:', error)
    errorMessage.value = error.message || '参加リクエストに失敗しました。'

    // 에러가 발생해도 대시보드로 돌아가지 않고 여기에 남음
    alert(`エラーが発生しました: ${error.message}`)
  } finally {
    isSubmitting.value = false
  }
}

// 새 매장 등록 신청 (직접 Firestore에 작성)
const handleCreateStore = async () => {
  // 유효성 검사
  if (!newStore.value.storeName || !newStore.value.address || !newStore.value.phoneNumber) {
    errorMessage.value = '店舗名、住所、電話番号は必須です。'
    return
  }

  const user = auth.currentUser
  if (!user) {
    alert('ログインが必要です。')
    router.push('/login')
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    // ✅ 현재 시간을 Date 객체로
    const now = new Date()

    // Firestore에 직접 작성
    const docRef = await addDoc(collection(db, 'stores'), {
      name: newStore.value.storeName,
      address: newStore.value.address,
      phoneNumber: newStore.value.phoneNumber,
      googleMapsUrl: newStore.value.googleMapsUrl || '',
      status: 'approved',
      approvalRequestMessage: requestMessage.value,
      ownerId: user.uid,
      ownerEmail: user.email || '',
      staffList: [
        {
          email: user.email || '',
          userId: user.uid,
          role: 'owner',
          status: 'active',
          invitedAt: now, // ✅ 여기만 변경
        },
      ],
      createdAt: serverTimestamp(),
    })

    alert('店舗を作成しました！')
    router.push(`/dashboard/${docRef.id}`)
  } catch (error: any) {
    console.error('매장 등록 실패:', error)
    errorMessage.value = error.message || '店舗登録に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

// 탭 변경 시 매장 목록 로드
const handleModeChange = (newMode: 'existing' | 'new') => {
  mode.value = newMode
  errorMessage.value = ''

  if (newMode === 'existing' && stores.value.length === 0) {
    loadStores()
  }
}
</script>

<template>
  <div class="store-registration-container">
    <h1>店舗登録</h1>

    <!-- 탭 -->
    <div class="tabs">
      <button :class="{ active: mode === 'existing' }" @click="handleModeChange('existing')">
        既存の店舗に登録
      </button>
      <button :class="{ active: mode === 'new' }" @click="handleModeChange('new')">
        新しい店舗を生成
      </button>
    </div>

    <!-- 에러 메시지 -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- 기존 매장에 등록 -->
    <div v-if="mode === 'existing'" class="existing-store-section">
      <div class="search-box">
        <input v-model="storeSearch" type="text" placeholder="店舗名検索" class="search-input" />
      </div>

      <div v-if="isLoadingStores" class="loading">読み込み中...</div>

      <div v-else class="store-list">
        <div v-for="store in filteredStores" :key="store.id" class="store-card">
          <div class="store-info">
            <h3>{{ store.name }}</h3>
            <p class="address">📍 {{ store.address }}</p>
            <p class="phone">📞 {{ store.phoneNumber }}</p>
          </div>
          <button @click="handleJoinStore(store.id)" :disabled="isSubmitting" class="join-button">
            登録リクエストを送る
          </button>
        </div>

        <div v-if="filteredStores.length === 0" class="no-results">
          該当する店舗が見つかりませんでした。
        </div>
      </div>

      <div class="message-box">
        <label>メッセージ（任意）</label>
        <textarea
          v-model="requestMessage"
          placeholder="店舗オーナーへのメッセージを入力してください"
          rows="3"
        ></textarea>
      </div>
    </div>

    <!-- 새 매장 생성 -->
    <div v-else class="new-store-section">
      <form @submit.prevent="handleCreateStore" class="store-form">
        <div class="form-group">
          <label>店舗名 <span class="required">*</span></label>
          <input
            v-model="newStore.storeName"
            type="text"
            placeholder="例：タイホーム 大阪店"
            required
          />
        </div>

        <div class="form-group">
          <label>住所 <span class="required">*</span></label>
          <input
            v-model="newStore.address"
            type="text"
            placeholder="例：大阪府大阪市北区梅田1-1-7"
            required
          />
        </div>

        <div class="form-group">
          <label>電話番号 <span class="required">*</span></label>
          <input
            v-model="newStore.phoneNumber"
            type="tel"
            placeholder="例：06-1234-5678"
            required
          />
        </div>

        <div class="form-group">
          <label>Google Maps URL（任意）</label>
          <input
            v-model="newStore.googleMapsUrl"
            type="url"
            placeholder="https://maps.google.com/..."
          />
        </div>

        <div class="form-group">
          <label>メッセージ（任意）</label>
          <textarea
            v-model="requestMessage"
            placeholder="承認担当者へのメッセージを入力してください"
            rows="4"
          ></textarea>
        </div>

        <button type="submit" :disabled="isSubmitting" class="submit-button">
          {{ isSubmitting ? '送信中...' : '生成' }}
        </button>
      </form>
    </div>

    <div class="back-link">
      <router-link to="/dashboard">← ダッシュボードに戻る</router-link>
    </div>
  </div>
</template>

<style scoped>
.store-registration-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #333;
}

.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.tabs button {
  padding: 1rem 2rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  transition: all 0.3s;
}

.tabs button.active {
  color: #4caf50;
  border-bottom-color: #4caf50;
  font-weight: bold;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

/* 기존 매장 섹션 */
.existing-store-section {
  margin-top: 2rem;
}

.search-box {
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.store-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.store-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  transition: box-shadow 0.3s;
}

.store-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.store-info h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.store-info p {
  margin: 0.25rem 0;
  color: #666;
  font-size: 0.9rem;
}

.join-button {
  padding: 0.75rem 1.5rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.join-button:hover:not(:disabled) {
  background-color: #45a049;
}

.join-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: #666;
}

/* 새 매장 섹션 */
.new-store-section {
  margin-top: 2rem;
}

.store-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.required {
  color: #f44336;
}

.form-group input,
.form-group textarea {
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4caf50;
}

.message-box {
  margin-top: 1.5rem;
}

.message-box label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.message-box textarea {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

.submit-button {
  padding: 1rem 2rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: bold;
  transition: background-color 0.3s;
}

.submit-button:hover:not(:disabled) {
  background-color: #45a049;
}

.submit-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.back-link {
  margin-top: 2rem;
  text-align: center;
}

.back-link a {
  color: #4caf50;
  text-decoration: none;
  font-size: 1rem;
}

.back-link a:hover {
  text-decoration: underline;
}
</style>
