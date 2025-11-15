<template>
  <div class="dashboard-container">
    <!-- PC: 왼쪽 프로필 / 모바일: 상단 프로필 -->
    <aside class="profile-sidebar">
      <!-- 로딩 -->
      <div v-if="isLoading || isLoadingProfile" class="loading">読み込み中...</div>

      <div v-else class="profile-section">
        <div class="profile-header">
          <h2>👤 プロフィール</h2>
          <button @click="handleSignOut" class="logout-btn">ログアウト</button>
        </div>

        <div class="profile-card" @click="openProfileModal">
          <div class="profile-image-container">
            <img
              v-if="userProfile?.profileImageUrl"
              :src="userProfile.profileImageUrl"
              alt="プロフィール画像"
              class="profile-image"
            />
            <div v-else class="profile-image-placeholder">
              👤
            </div>
          </div>
          <div class="profile-info">
            <h3>{{ userProfile?.displayName || userProfile?.email || 'ユーザー' }}</h3>
            <p v-if="userProfile?.displayName" class="profile-email">{{ userProfile?.email || '' }}</p>
            <p class="edit-hint">クリックして編集</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- PC: 오른쪽 점포 목록 / 모바일: 하단 점포 목록 -->
    <main class="stores-content">
      <div class="stores-header">
        <h1>🏪 店舗一覧</h1>
        <button
          v-if="approvedStores.length > 0 || pendingStores.length > 0 || invitationPendingStores.length > 0"
          @click="goToRegisterStore"
          class="add-store-header-btn"
        >
          + 店舗を追加
        </button>
      </div>

      <div v-if="isLoading" class="loading">読み込み中...</div>

      <div v-else>
        <!-- 점포가 없을 때 -->
        <div v-if="approvedStores.length === 0 && pendingStores.length === 0 && invitationPendingStores.length === 0" class="no-stores">
          <div class="no-stores-icon">🏪</div>
          <p>登録された店舗がありません。</p>
          <button @click="goToRegisterStore" class="primary-btn">+ 店舗を登録</button>
        </div>

        <!-- 점포 목록 (관리메뉴 스타일) -->
        <div v-else class="stores-grid">
          <!-- 초대 대기 중 -->
          <div
            v-for="store in invitationPendingStores"
            :key="store.id"
            class="store-card invitation-pending"
            @click="selectStore(store.id)"
          >
            <div class="store-card-header">
              <div class="store-image-container">
                <img v-if="store.imageUrl" :src="store.imageUrl" alt="店舗画像" class="store-image" />
                <div v-else class="store-image-placeholder">📩</div>
              </div>
            </div>
            <div class="store-card-body">
              <h3>{{ store.name }}</h3>
              <p class="store-address">📍 {{ store.address }}</p>
              <div class="store-status-badge invitation">招待承認待ち</div>
            </div>
            <div class="store-card-arrow">→</div>
          </div>

          <!-- 승인된 점포 -->
          <div
            v-for="store in approvedStores"
            :key="store.id"
            class="store-card approved"
            @click="selectStore(store.id)"
          >
            <div class="store-card-header">
              <div class="store-image-container">
                <img v-if="store.imageUrl" :src="store.imageUrl" alt="店舗画像" class="store-image" />
                <div v-else class="store-image-placeholder">🏪</div>
              </div>
            </div>
            <div class="store-card-body">
              <h3>{{ store.name }}</h3>
              <p class="store-address">📍 {{ store.address }}</p>
            </div>
            <div class="store-card-arrow">→</div>
          </div>

          <!-- 관리자 승인 대기 중 -->
          <div
            v-for="store in pendingStores"
            :key="store.id"
            class="store-card pending"
          >
            <div class="store-card-header">
              <div class="store-image-container">
                <img v-if="store.imageUrl" :src="store.imageUrl" alt="店舗画像" class="store-image" />
                <div v-else class="store-image-placeholder">⏳</div>
              </div>
            </div>
            <div class="store-card-body">
              <h3>{{ store.name }}</h3>
              <p class="store-address">📍 {{ store.address }}</p>
              <div class="store-status-badge pending-badge">承認待ち</div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 프로필 수정 모달 -->
    <div v-if="showProfileModal" class="modal-overlay" @click="closeProfileModal">
      <div class="modal-content" @click.stop>
        <h2>プロフィール編集</h2>

        <form @submit.prevent="handleProfileUpdate" class="profile-form">
          <div class="form-group">
            <label>プロフィール画像</label>
            <div class="profile-image-upload">
              <div v-if="profileImagePreview || userProfile?.profileImageUrl" class="profile-preview">
                <img :src="profileImagePreview || userProfile?.profileImageUrl" alt="プロフィール" />
                <button type="button" @click="removeProfileImage" class="remove-image-btn">✕</button>
              </div>
              <label v-else class="profile-upload-label">
                <input
                  type="file"
                  accept="image/*"
                  @change="handleProfileImageSelect"
                  style="display: none"
                />
                <div class="upload-placeholder-small">
                  <span class="upload-icon">📷</span>
                  <span>画像を選択</span>
                </div>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>表示名（任意）</label>
            <input
              v-model="editableProfile.displayName"
              type="text"
              placeholder="表示名を入力"
            />
          </div>

          <div class="form-group">
            <label>メールアドレス</label>
            <input
              v-model="editableProfile.email"
              type="email"
              disabled
              class="disabled-input"
            />
            <p class="form-hint">メールアドレスは変更できません</p>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeProfileModal" class="cancel-button">キャンセル</button>
            <button type="submit" :disabled="isUpdatingProfile" class="submit-button">
              {{ isUpdatingProfile ? '更新中...' : '更新' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { signOut } from 'firebase/auth'
import { useRouter, useRoute } from 'vue-router'
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth } from '../firebase'

interface Store {
  id: string
  name: string
  address: string
  imageUrl?: string
  status?: string
}

interface UserProfile {
  email: string
  displayName: string
  profileImageUrl: string
}

const router = useRouter()
const route = useRoute()
const db = getFirestore()
const storage = getStorage()

const myStores = ref<Store[]>([])
const isLoading = ref(true)
const selectedStoreId = ref<string | null>(null)

// 사용자 프로필
const userProfile = ref<UserProfile | null>(null)
const isLoadingProfile = ref(true)

// 프로필 수정
const showProfileModal = ref(false)
const editableProfile = ref({
  displayName: '',
  email: '',
})
const profileImageFile = ref<File | null>(null)
const profileImagePreview = ref<string | null>(null)
const profileImageToDelete = ref(false)
const isUpdatingProfile = ref(false)

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

// 사용자 프로필 로드
const loadUserProfile = async () => {
  isLoadingProfile.value = true
  try {
    const user = auth.currentUser
    if (!user) {
      router.push('/login')
      return
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (userDoc.exists()) {
      userProfile.value = userDoc.data() as UserProfile
    } else {
      // 기본값
      userProfile.value = {
        email: user.email || '',
        displayName: user.displayName || 'ユーザー',
        profileImageUrl: '',
      }
    }
  } catch (error) {
    console.error('プロフィール読み込み失敗:', error)
  } finally {
    isLoadingProfile.value = false
  }
}

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
      const data = doc.data()
      storesMap.set(doc.id, {
        id: doc.id,
        name: data.name as string,
        address: data.address as string,
        imageUrl: data.imageUrl as string | undefined,
        status: (data.status as string) || 'approved',
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
          imageUrl: data.imageUrl as string | undefined,
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
    console.error('店舗読み込み失敗:', error)
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
    console.error('ログアウト失敗:', error)
  }
}

// 매장 등록 페이지로 이동
const goToRegisterStore = () => {
  router.push('/register-store')
}

// 프로필 모달 열기
const openProfileModal = () => {
  if (userProfile.value) {
    editableProfile.value = {
      displayName: userProfile.value.displayName,
      email: userProfile.value.email,
    }
  }
  profileImagePreview.value = null
  profileImageFile.value = null
  profileImageToDelete.value = false
  showProfileModal.value = true
}

// 프로필 모달 닫기
const closeProfileModal = () => {
  showProfileModal.value = false
  profileImagePreview.value = null
  profileImageFile.value = null
  profileImageToDelete.value = false
}

// 프로필 이미지 선택
const handleProfileImageSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください。')
      return
    }

    profileImageFile.value = file

    const reader = new FileReader()
    reader.onload = (e) => {
      profileImagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// 프로필 이미지 제거
const removeProfileImage = () => {
  profileImageFile.value = null
  profileImagePreview.value = null
  profileImageToDelete.value = true

  // 기존 프로필 이미지도 UI에서 즉시 제거
  if (userProfile.value) {
    userProfile.value.profileImageUrl = ''
  }
}

// 프로필 업데이트
const handleProfileUpdate = async () => {
  const user = auth.currentUser
  if (!user) {
    alert('ログインが必要です。')
    return
  }

  isUpdatingProfile.value = true

  try {
    const updates: any = {
      displayName: editableProfile.value.displayName,
    }

    // 이미지 삭제
    if (profileImageToDelete.value && !profileImageFile.value) {
      updates.profileImageUrl = ''
    }
    // 새 이미지 업로드
    else if (profileImageFile.value) {
      const fileName = `users/${user.uid}/profile/${Date.now()}_${profileImageFile.value.name}`
      const imageRef = storageRef(storage, fileName)
      await uploadBytes(imageRef, profileImageFile.value)
      const downloadURL = await getDownloadURL(imageRef)
      updates.profileImageUrl = downloadURL
    }

    // Firestore 업데이트
    await updateDoc(doc(db, 'users', user.uid), updates)

    // 로컬 상태 업데이트
    if (userProfile.value) {
      userProfile.value.displayName = editableProfile.value.displayName
      if ('profileImageUrl' in updates) {
        userProfile.value.profileImageUrl = updates.profileImageUrl
      }
    }

    alert('プロフィールを更新しました。')
    closeProfileModal()
  } catch (error) {
    console.error('プロフィール更新失敗:', error)
    alert('プロフィールの更新に失敗しました。')
  } finally {
    isUpdatingProfile.value = false
  }
}

onMounted(() => {
  loadUserProfile()
  loadStores()
})

// route가 변경될 때 점포 목록 새로고침
watch(() => route.path, (newPath, oldPath) => {
  // dashboard 페이지로 돌아왔을 때만 새로고침
  if (newPath === '/dashboard' && oldPath !== '/dashboard') {
    loadStores()
  }
})
</script>

<style scoped>
.dashboard-container {
  display: flex;
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* ========== 프로필 사이드바 ========== */
.profile-sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.profile-header h2 {
  margin: 0;
  color: #4caf50;
  font-size: 1.3rem;
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

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.profile-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.profile-image-container {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.profile-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #667eea;
  color: white;
  font-size: 3rem;
}

.profile-info {
  text-align: center;
  width: 100%;
}

.profile-info h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.2rem;
}

.profile-email {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
  word-break: break-all;
}

.edit-hint {
  margin: 0;
  color: #667eea;
  font-size: 0.85rem;
  font-weight: 500;
}

/* ========== 점포 컨텐츠 ========== */
.stores-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.stores-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.stores-header h1 {
  margin: 0;
  color: #333;
  font-size: 2rem;
}

.add-store-header-btn {
  padding: 0.75rem 1.5rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s;
}

.add-store-header-btn:hover {
  background-color: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.no-stores {
  text-align: center;
  padding: 4rem 2rem;
}

.no-stores-icon {
  font-size: 6rem;
  opacity: 0.3;
  margin-bottom: 1rem;
}

.no-stores p {
  color: #999;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
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

/* ========== 점포 그리드 (관리메뉴 스타일) ========== */
.stores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.store-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  overflow: hidden;
  cursor: pointer;
}

.store-card::before {
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

.store-card:hover::before {
  transform: scaleX(1);
}

.store-card.approved:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  border-color: #4caf50;
}

.store-card.approved::before {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
}

.store-card.invitation-pending:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  border-color: #ff9800;
}

.store-card.invitation-pending::before {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
}

.store-card.pending {
  opacity: 0.6;
  cursor: default;
}

.store-card.pending:hover {
  transform: none;
  border-color: transparent;
}

.store-card-header {
  width: 100%;
  height: 180px;
  overflow: hidden;
}

.store-image-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.store-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.store-image-placeholder {
  font-size: 5rem;
}

.store-card-body {
  padding: 1.5rem;
  flex: 1;
}

.store-card-body h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: #333;
  font-weight: 600;
}

.store-address {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.5;
}

.store-status-badge {
  display: inline-block;
  margin-top: 0.75rem;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.store-status-badge.invitation {
  background-color: #fff3e0;
  color: #f57c00;
}

.store-status-badge.pending-badge {
  background-color: #f5f5f5;
  color: #999;
}

.store-card-arrow {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  font-size: 1.25rem;
  color: #667eea;
  font-weight: bold;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.3s;
}

.store-card:hover .store-card-arrow {
  opacity: 1;
  transform: translateX(0);
}

.store-card.pending .store-card-arrow {
  display: none;
}

/* ========== 프로필 모달 ========== */
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
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content h2 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.profile-form {
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

.disabled-input {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: #666;
}

.profile-image-upload {
  margin-top: 0.5rem;
}

.profile-preview {
  position: relative;
  display: inline-block;
  width: 150px;
  height: 150px;
}

.profile-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 2px solid #e0e0e0;
}

.profile-upload-label {
  display: block;
  cursor: pointer;
}

.upload-placeholder-small {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  border: 2px dashed #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
  transition: all 0.3s;
}

.upload-placeholder-small:hover {
  border-color: #4caf50;
  background-color: #f1f8f4;
}

.upload-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.remove-image-btn {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
  background-color: rgba(244, 67, 54, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s;
}

.remove-image-btn:hover {
  background-color: rgba(198, 40, 40, 1);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.cancel-button,
.submit-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s;
}

.cancel-button {
  background-color: #f5f5f5;
  color: #333;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}

.submit-button {
  background-color: #4caf50;
  color: white;
}

.submit-button:hover:not(:disabled) {
  background-color: #45a049;
}

.submit-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* ========== 반응형 (모바일) ========== */
@media (max-width: 768px) {
  .dashboard-container {
    flex-direction: column;
  }

  .profile-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
    padding: 0;
    display: block;
    position: relative;
  }

  .profile-section {
    width: 100%;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* 모バイルに서 프로필 헤더 - 로그아웃 버튼만 */
  .profile-header {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0;
    border: none;
    margin: 0;
    z-index: 10;
  }

  .profile-header h2 {
    display: none;
  }

  /* 로그아웃 버튼 */
  .logout-btn {
    position: static;
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .profile-card {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    width: 100%;
    max-width: 400px;
    margin: 0;
  }

  .profile-image-container {
    width: 60px;
    height: 60px;
    margin-bottom: 0;
    flex-shrink: 0;
  }

  .profile-info {
    text-align: left;
    flex: 1;
  }

  .profile-info h3 {
    font-size: 1rem;
  }

  .profile-email {
    font-size: 0.8rem;
  }

  .stores-content {
    padding: 1rem;
  }

  .stores-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .stores-header h1 {
    font-size: 1.5rem;
  }

  .stores-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
