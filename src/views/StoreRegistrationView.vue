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
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

const router = useRouter()
const db = getFirestore()
const auth = getAuth()

// モード: 既存の店舗に登録 vs 新しい店舗を生成
const mode = ref<'existing' | 'new'>('new')

// 既存店舗検索
interface Store {
  id: string
  name: string
  address: string
  phoneNumber: string
  imageUrl?: string
  status?: string
  hasPendingRequest?: boolean
}

const stores = ref<Store[]>([])
const storeSearch = ref('')
const isLoadingStores = ref(false)

// 新しい店舗情報
const newStore = ref({
  storeName: '',
  address: '',
  phoneNumber: '',
  googleMapsUrl: '',
})
const requestMessage = ref('')

// 店舗画像アップロード
const storeImageFile = ref<File | null>(null)
const storeImagePreview = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)

// 提出状態
const isSubmitting = ref(false)
const errorMessage = ref('')

// 検索された店舗リスト
const filteredStores = computed(() => {
  if (!storeSearch.value) return stores.value

  const search = storeSearch.value.toLowerCase()
  return stores.value.filter(
    (store) =>
      store.name.toLowerCase().includes(search) || store.address.toLowerCase().includes(search),
  )
})

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    storeImageFile.value = file

    // プレビュー表示
    const reader = new FileReader()
    reader.onload = (e) => {
      storeImagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const uploadStoreImage = async (storeId: string): Promise<string | null> => {
  if (!storeImageFile.value) return null

  try {
    // タイムアウト付きでアップロード
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Upload timeout')), 3000)
    })

    const uploadPromise = (async () => {
      const imageRef = storageRef(storage, `stores/${storeId}/store.jpg`)
      await uploadBytes(imageRef, storeImageFile.value!)
      const downloadUrl = await getDownloadURL(imageRef)
      return downloadUrl
    })()

    const result = await Promise.race([uploadPromise, timeoutPromise])
    return result
  } catch (error: any) {
    console.error('店舗画像のアップロード失敗:', error.message || error)
    return null
  }
}

// 店舗リスト読み込み
const loadStores = async () => {
  isLoadingStores.value = true
  try {
    const user = auth.currentUser
    if (!user) {
      return
    }

    const q = query(collection(db, 'stores'), where('status', '==', 'approved'))
    const snapshot = await getDocs(q)

    // 現在のユーザーのすべてのpendingリクエストを照会
    const pendingRequestsQuery = query(
      collection(db, 'storeJoinRequests'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    )
    const pendingRequestsSnapshot = await getDocs(pendingRequestsQuery)
    const pendingStoreIds = new Set(
      pendingRequestsSnapshot.docs.map(doc => doc.data().storeId)
    )

    stores.value = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          hasPendingRequest: pendingStoreIds.has(doc.id),
        }) as Store,
    )
  } catch (error) {
    console.error('店舗リスト読み込み失敗:', error)
    errorMessage.value = '店舗リストの読み込みに失敗しました。'
  } finally {
    isLoadingStores.value = false
  }
}

// 既存店舗への参加リクエスト
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
    // 1. 既にスタッフとして登録されているか確認
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

    // 2. 既存リクエストの確認 (pending + rejected 両方)
    const existingRequestQuery = query(
      collection(db, 'storeJoinRequests'),
      where('storeId', '==', storeId),
      where('userId', '==', user.uid),
    )

    const existingRequests = await getDocs(existingRequestQuery)

    // pendingリクエストがあるか確認
    const pendingRequest = existingRequests.docs.find((doc) => doc.data().status === 'pending')

    if (pendingRequest) {
      alert('既に参加リクエストを送信しています。承認をお待ちください。')
      router.push('/dashboard')
      return
    }

    // rejectedリクエストがあればpendingに更新
    const rejectedRequest = existingRequests.docs.find((doc) => doc.data().status === 'rejected')

    if (rejectedRequest) {
      await updateDoc(doc(db, 'storeJoinRequests', rejectedRequest.id), {
        status: 'pending',
        userId: user.uid,
        message: requestMessage.value,
        createdAt: serverTimestamp(),
      })

      alert('参加リクエストを送信しました。承認をお待ちください。')
      router.push('/dashboard')
      return
    }

    // 3. 新しいリクエスト作成
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
    console.error('参加リクエスト失敗:', error)
    errorMessage.value = error.message || '参加リクエストに失敗しました。'
    alert(`エラーが発生しました: ${error.message}`)
  } finally {
    isSubmitting.value = false
  }
}

// 新しい店舗の登録申請 (直接Firestoreに作成)
const handleCreateStore = async () => {
  // バリデーション
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
    const now = new Date()

    // Firestoreに直接作成
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
          invitedAt: now,
        },
      ],
      createdAt: serverTimestamp(),
    })

    // 店舗画像をアップロード（失敗してもスキップ）
    if (storeImageFile.value) {
      try {
        const imageUrl = await uploadStoreImage(docRef.id)
        if (imageUrl) {
          // 店舗ドキュメントにimageUrlを追加
          await updateDoc(doc(db, 'stores', docRef.id), {
            imageUrl: imageUrl,
          })
          console.log('店舗画像アップロード成功')
        } else {
          console.log('店舗画像アップロードスキップ（Storageエラー）')
        }
      } catch (uploadError) {
        console.error('店舗画像アップロードエラー（続行）:', uploadError)
        // エラーでも続行
      }
    }

    alert('店舗を作成しました！')
    router.push(`/dashboard/${docRef.id}`)
  } catch (error: any) {
    console.error('店舗登録失敗:', error)
    errorMessage.value = error.message || '店舗登録に失敗しました。'
  } finally {
    isSubmitting.value = false
  }
}

// タブ変更時に店舗リストを読み込む
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

    <!-- タブ -->
    <div class="tabs">
      <button :class="{ active: mode === 'existing' }" @click="handleModeChange('existing')">
        既存の店舗に登録
      </button>
      <button :class="{ active: mode === 'new' }" @click="handleModeChange('new')">
        新しい店舗を生成
      </button>
    </div>

    <!-- エラーメッセージ -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <!-- 既存店舗に登録 -->
    <div v-if="mode === 'existing'" class="existing-store-section">
      <div class="search-box">
        <input v-model="storeSearch" type="text" placeholder="店舗名検索" class="search-input" />
      </div>

      <div v-if="isLoadingStores" class="loading">読み込み中...</div>

      <div v-else class="store-list">
        <div v-for="store in filteredStores" :key="store.id" class="store-card">
          <div v-if="store.imageUrl" class="store-image">
            <img :src="store.imageUrl" :alt="store.name" />
          </div>
          <div v-else class="store-image store-emoji">🏪</div>

          <div class="store-info">
            <h3>{{ store.name }}</h3>
            <p class="address">📍 {{ store.address }}</p>
            <p class="phone">📞 {{ store.phoneNumber }}</p>
          </div>
          <button @click="handleJoinStore(store.id)" :disabled="isSubmitting || store.hasPendingRequest" class="join-button">
            {{ store.hasPendingRequest ? '承認待ち' : '登録リクエストを送る' }}
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

    <!-- 新しい店舗生成 -->
    <div v-else class="new-store-section">
      <form @submit.prevent="handleCreateStore" class="store-form">
        <!-- 店舗画像アップロード -->
        <div class="form-group store-image-upload">
          <label>店舗画像（任意）</label>
          <div class="image-preview-container" @click="triggerFileInput">
            <img v-if="storeImagePreview" :src="storeImagePreview" alt="Store" class="image-preview" />
            <div v-else class="image-placeholder">
              <span class="camera-icon">📷</span>
              <span class="upload-text">写真を選択</span>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            style="display: none"
          />
        </div>

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
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.tabs button {
  flex: 1;
  padding: 0.875rem 1rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 0.95rem;
  color: #666;
  transition: all 0.3s;
  white-space: nowrap;
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

/* 既存店舗セクション */
.existing-store-section {
  margin-top: 1.5rem;
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
  margin-bottom: 1.5rem;
}

.store-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  transition: box-shadow 0.3s;
}

.store-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.store-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.store-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.store-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
}

.store-info {
  flex: 1;
  min-width: 0;
}

.store-info h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.store-info p {
  margin: 0.25rem 0;
  color: #666;
  font-size: 0.9rem;
}

.join-button {
  padding: 0.75rem 1.25rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background-color 0.3s;
  white-space: nowrap;
  flex-shrink: 0;
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

/* 新しい店舗セクション */
.new-store-section {
  margin-top: 1.5rem;
}

.store-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

/* 店舗画像アップロード */
.store-image-upload {
  margin-bottom: 0.5rem;
}

.image-preview-container {
  width: 100%;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px dashed #ddd;
  transition: border-color 0.3s;
  background-color: #f9f9f9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-container:hover {
  border-color: #4caf50;
  background-color: #f5f5f5;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.camera-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.upload-text {
  font-size: 1rem;
  color: #666;
}

.message-box {
  margin-top: 1rem;
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
  resize: vertical;
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

/* モバイル対応 */
@media (max-width: 768px) {
  .store-registration-container {
    padding: 1rem;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .tabs {
    gap: 0.25rem;
  }

  .tabs button {
    padding: 0.75rem 0.5rem;
    font-size: 0.85rem;
  }

  .store-card {
    flex-wrap: wrap;
    padding: 0.875rem;
  }

  .store-image {
    width: 60px;
    height: 60px;
  }

  .store-emoji {
    font-size: 2rem;
  }

  .store-info {
    flex: 1;
    min-width: calc(100% - 80px);
  }

  .store-info h3 {
    font-size: 1rem;
  }

  .store-info p {
    font-size: 0.85rem;
  }

  .join-button {
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.875rem;
  }

  .image-preview-container {
    height: 180px;
  }

  .store-form {
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .tabs button {
    font-size: 0.8rem;
    padding: 0.7rem 0.4rem;
  }

  .image-preview-container {
    height: 160px;
  }

  .camera-icon {
    font-size: 2.5rem;
  }
}
</style>
