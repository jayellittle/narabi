<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFirebase, useTimeFormat } from '../composables/useFirebase'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
} from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { Store, StaffMember } from '../types'

const route = useRoute()
const router = useRouter()
const auth = getAuth()
const db = getFirestore()
const storage = getStorage()
const functions = getFunctions()
const { getStore, inviteStaff, respondToInvitation, updateStaffDisplayName } = useFirebase()
const { formatTimestamp } = useTimeFormat()

const storeId = ref(route.params.storeId as string)
const store = ref<Store | null>(null)
const isLoading = ref(true)
const error = ref('')

// 참여 요청 목록
interface JoinRequest {
  id: string
  storeId: string
  userId: string
  userEmail: string
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: any
}

const joinRequests = ref<JoinRequest[]>([])

// 초대 모달
const showInviteModal = ref(false)
const inviteForm = ref({
  email: '',
  role: 'staff' as 'staff' | 'owner',
})
const isInviting = ref(false)

// 표시명 편집 모달
const showDisplayNameModal = ref(false)
const displayNameForm = ref({
  displayName: '',
})
const staffImageFile = ref<File | null>(null)
const staffImagePreview = ref<string | null>(null)
const isUpdatingDisplayName = ref(false)

// 초대 승인 시 표시명 입력 모달
const showInvitationAcceptModal = ref(false)
const invitationAcceptForm = ref({
  displayName: '',
})
const isAcceptingInvitation = ref(false)

// 현재 사용자 정보
const currentUser = computed(() => auth.currentUser)
const currentUserEmail = computed(() => currentUser.value?.email || '')

// 스태프 필터링
const pendingStaff = computed(() => {
  return store.value?.staffList.filter((s) => s.status === 'pending') || []
})

const activeStaff = computed(() => {
  return store.value?.staffList.filter((s) => s.status === 'active') || []
})

const rejectedStaff = computed(() => {
  return store.value?.staffList.filter((s) => s.status === 'rejected') || []
})

// 대기 중인 참여 요청
const pendingJoinRequests = computed(() => {
  return joinRequests.value.filter((r) => r.status === 'pending')
})

// 현재 사용자가 오너인지 확인
const isOwner = computed(() => {
  return store.value?.ownerId === currentUser.value?.uid
})

// 현재 사용자가 pending 상태인지 확인
const isCurrentUserPending = computed(() => {
  const myStaffEntry = store.value?.staffList.find(
    (s) => s.email === currentUserEmail.value
  )
  return myStaffEntry?.status === 'pending'
})

// 현재 사용자가 active 상태인지 확인
const isCurrentUserActive = computed(() => {
  const myStaffEntry = store.value?.staffList.find(
    (s) => s.email === currentUserEmail.value
  )
  return myStaffEntry?.status === 'active' || isOwner.value
})

// 오너가 탈퇴 가능한지 확인 (다른 오너가 있는지)
const canOwnerLeave = computed(() => {
  const owners = activeStaff.value.filter((s) => s.role === 'owner')
  return owners.length > 1
})

// 역할 라벨
const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    owner: 'オーナー',
    staff: 'スタッフ',
  }
  return labels[role] || role
}

// 참여 요청 로드
const loadJoinRequests = async () => {
  try {
    const q = query(
      collection(db, 'storeJoinRequests'),
      where('storeId', '==', storeId.value),
      where('status', '==', 'pending'),
    )
    const snapshot = await getDocs(q)
    joinRequests.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as JoinRequest[]
  } catch (err) {
    console.error('참여 요청 로드 실패:', err)
  }
}

// 매장 정보 로드
const loadStore = async () => {
  isLoading.value = true
  error.value = ''

  try {
    const storeData = await getStore(storeId.value)
    if (!storeData) {
      error.value = '店舗が見つかりませんでした。'
      return
    }
    store.value = storeData

    // 참여 요청도 함께 로드
    await loadJoinRequests()
  } catch (err) {
    console.error('매장 로드 실패:', err)
    error.value = 'データの読み込みに失敗しました。'
  } finally {
    isLoading.value = false
  }
}

// 참여 요청 승인/거절
const handleJoinRequest = async (requestId: string, approved: boolean, userEmail: string, displayName?: string) => {
  try {
    const requestRef = doc(db, 'storeJoinRequests', requestId)
    const storeRef = doc(db, 'stores', storeId.value)

    if (approved) {
      // 승인: staffList에 추가 (displayName 포함)
      await updateDoc(storeRef, {
        staffList: arrayUnion({
          email: userEmail,
          role: 'staff',
          status: 'active',
          invitedAt: new Date(),
          displayName: displayName || null,
        }),
      })

      // 요청 상태를 approved로 업데이트
      await updateDoc(requestRef, {
        status: 'approved',
      })
    } else {
      // 거절: 요청 상태만 rejected로 업데이트 (삭제하지 않음)
      await updateDoc(requestRef, {
        status: 'rejected',
      })
    }

    alert(approved ? '参加リクエストを承認しました。' : '参加リクエストを拒否しました。')

    // 데이터 새로고침
    await loadStore()
  } catch (err: any) {
    console.error('참여 요청 처리 실패:', err)
    alert(err.message || 'リクエストの処理に失敗しました。')
  }
}

// 스태프 초대
const handleInviteStaff = async () => {
  if (!inviteForm.value.email) {
    alert('メールアドレスを入力してください。')
    return
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(inviteForm.value.email)) {
    alert('有効なメールアドレスを入力してください。')
    return
  }

  isInviting.value = true

  try {
    await inviteStaff(storeId.value, inviteForm.value.email, inviteForm.value.role)
    alert('招待を送信しました。')

    // 폼 초기화 및 모달 닫기
    inviteForm.value.email = ''
    inviteForm.value.role = 'staff'
    showInviteModal.value = false

    // 매장 정보 새로고침
    await loadStore()
  } catch (err: any) {
    console.error('초대 실패:', err)

    // Firebase Functions 에러 메시지 추출
    let errorMessage = '招待に失敗しました。'

    if (err.code) {
      switch (err.code) {
        case 'unauthenticated':
          errorMessage = 'ログインが必要です。'
          break
        case 'permission-denied':
          errorMessage = '権限がありません。オーナーのみスタッフを招待できます。'
          break
        case 'not-found':
          errorMessage = '店舗が見つかりませんでした。'
          break
        case 'already-exists':
          // 이미 초대된 사용자와 이미 소속된 스태프를 구분
          const staffList = store.value?.staffList || []
          const existingStaff = staffList.find(s => s.email === inviteForm.value.email)
          if (existingStaff && existingStaff.status === 'active') {
            errorMessage = 'このメールアドレスは既にこの店舗に所属しています。'
          } else if (existingStaff && existingStaff.status === 'pending') {
            errorMessage = '既に招待されたユーザーです。承認をお待ちください。'
          } else {
            errorMessage = '既に招待されたユーザーです。'
          }
          break
        case 'invalid-argument':
          errorMessage = 'メールアドレスが無効です。'
          break
        default:
          errorMessage = err.message || '招待に失敗しました。'
      }
    } else if (err.message) {
      errorMessage = err.message
    }

    alert(errorMessage)
  } finally {
    isInviting.value = false
  }
}

// 초대 취소
const cancelInvite = () => {
  inviteForm.value.email = ''
  inviteForm.value.role = 'staff'
  showInviteModal.value = false
}

// 스태프 제거
const handleRemoveStaff = async (staffEmail: string) => {
  if (!confirm(`${staffEmail}をスタッフから削除しますか？`)) {
    return
  }

  try {
    const storeRef = doc(db, 'stores', storeId.value)
    const storeDoc = await getDoc(storeRef)

    if (storeDoc.exists()) {
      const staffList = storeDoc.data().staffList || []
      const updatedStaffList = staffList.filter((staff: any) => staff.email !== staffEmail)

      await updateDoc(storeRef, {
        staffList: updatedStaffList,
      })

      alert('スタッフを削除しました。')
      await loadStore()
    }
  } catch (err: any) {
    console.error('스태프 제거 실패:', err)
    alert(err.message || 'スタッフの削除に失敗しました。')
  }
}

// 초대 승인 모달 열기
const openInvitationAcceptModal = () => {
  invitationAcceptForm.value.displayName = ''
  showInvitationAcceptModal.value = true
}

// 초대 승인 처리
const handleAcceptInvitation = async () => {
  isAcceptingInvitation.value = true

  try {
    const displayNameToSend = invitationAcceptForm.value.displayName.trim() || undefined
    await respondToInvitation(storeId.value, true, displayNameToSend)

    showInvitationAcceptModal.value = false
    alert('招待を承認しました。ページを再読み込みします。')

    // Firestoreの更新を確実に反映するため、完全なページリロードを行う
    window.location.href = `/store/${storeId.value}`
  } catch (err: any) {
    console.error('初대 승인 실패:', err)
    alert(err.message || '招待の承認に失敗しました。')
  } finally {
    isAcceptingInvitation.value = false
  }
}

// 초대 거절 처리
const handleRejectInvitation = async () => {
  if (!confirm('招待を拒否しますか？')) {
    return
  }

  try {
    await respondToInvitation(storeId.value, false)

    alert('招待を拒否しました。')
    router.push('/dashboard')
  } catch (err: any) {
    console.error('초대 거절 실패:', err)
    alert(err.message || '招待の拒否に失敗しました。')
  }
}

// 초대 승인/거절 핸들러 (기존 함수는 사용하지 않음)
const handleRespondToInvitation = async (accepted: boolean) => {
  if (accepted) {
    openInvitationAcceptModal()
  } else {
    await handleRejectInvitation()
  }
}

// 탈퇴 핸들러
const handleLeaveStore = async () => {
  const myStaffEntry = store.value?.staffList.find(
    (s) => s.email === currentUserEmail.value
  )

  if (!myStaffEntry) return

  // 오너인 경우 다른 오너가 있는지 확인
  if (myStaffEntry.role === 'owner' && !canOwnerLeave.value) {
    alert('他のオーナーがいないため、退店できません。')
    return
  }

  if (!confirm('本当に退店しますか？')) {
    return
  }

  try {
    // Firebase Functionsを使用してスタッフを削除
    const removeStaffSelf = httpsCallable(functions, 'removeStaffSelf')
    await removeStaffSelf({ storeId: storeId.value })

    alert('退店しました。')
    router.push('/dashboard')
  } catch (err: any) {
    console.error('탈퇴 실패:', err)
    alert(err.message || '退店に失敗しました。')
  }
}

// 이미지 선택
const handleStaffImageSelect = (event: Event) => {
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

    staffImageFile.value = file

    const reader = new FileReader()
    reader.onload = (e) => {
      staffImagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// 이미지 제거
const removeStaffImage = () => {
  staffImageFile.value = null
  staffImagePreview.value = null
  staffImageToDelete.value = true
}

// 이미지 업로드 함수
const uploadStaffImage = async (): Promise<string | null> => {
  if (!staffImageFile.value) return null

  try {
    const user = auth.currentUser
    if (!user) return null

    const fileName = `staff/${storeId.value}/${user.uid}/${Date.now()}_${staffImageFile.value.name}`
    const imageRef = storageRef(storage, fileName)
    await uploadBytes(imageRef, staffImageFile.value)
    const downloadURL = await getDownloadURL(imageRef)
    return downloadURL
  } catch (error) {
    console.error('画像アップロード失敗:', error)
    return null
  }
}

// 표시명 편집 모달 열기
const openDisplayNameModal = () => {
  const myStaffEntry = store.value?.staffList.find(
    (s) => s.email === currentUserEmail.value
  )
  displayNameForm.value.displayName = myStaffEntry?.displayName || ''
  staffImagePreview.value = myStaffEntry?.staffImageUrl || null
  staffImageFile.value = null
  staffImageToDelete.value = false
  showDisplayNameModal.value = true
}

// 표시명 업데이트
const handleUpdateDisplayName = async () => {
  isUpdatingDisplayName.value = true

  try {
    // 画像アップロード
    let staffImageUrl: string | null = null
    if (staffImageFile.value) {
      staffImageUrl = await uploadStaffImage()
    }

    // staffList 업데이트
    const storeRef = doc(db, 'stores', storeId.value)
    const storeDoc = await getDoc(storeRef)

    if (storeDoc.exists()) {
      const staffList = storeDoc.data().staffList || []
      const updatedStaffList = staffList.map((staff: any) => {
        if (staff.email === currentUserEmail.value) {
          const updates: any = {
            ...staff,
            displayName: displayNameForm.value.displayName.trim() || null,
          }
          // 이미지 삭제
          if (staffImageToDelete.value && !staffImageFile.value) {
            updates.staffImageUrl = null
          }
          // 새 이미지가 업로드된 경우에만 staffImageUrl 업데이트
          else if (staffImageUrl) {
            updates.staffImageUrl = staffImageUrl
          }
          return updates
        }
        return staff
      })

      await updateDoc(storeRef, {
        staffList: updatedStaffList,
      })

      alert('表示名とプロフィール画像を更新しました。')
      showDisplayNameModal.value = false
      staffImageFile.value = null
      staffImagePreview.value = null
      await loadStore()
    }
  } catch (err: any) {
    console.error('표시명 업데이트 실패:', err)
    alert(err.message || '表示名の更新に失敗しました。')
  } finally {
    isUpdatingDisplayName.value = false
  }
}

// 표시명 모달 취소
const cancelDisplayName = () => {
  displayNameForm.value.displayName = ''
  showDisplayNameModal.value = false
}

onMounted(() => {
  loadStore()
})
</script>

<template>
  <div class="staff-management-container">
    <div class="header">
      <h1>スタッフ管理</h1>
      <div class="header-buttons">
        <button v-if="isCurrentUserActive" @click="openDisplayNameModal" class="display-name-button">
          ✏️ 表示名編集
        </button>
        <button v-if="isOwner" @click="showInviteModal = true" class="invite-button">
          + 新規招待
        </button>
      </div>
    </div>

    <!-- 로딩 -->
    <div v-if="isLoading" class="loading">読み込み中...</div>

    <!-- 에러 -->
    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <!-- 스태프 목록 -->
    <div v-else class="staff-sections">
      <!-- pending 사용자인 경우: 자신의 초대만 표시 -->
      <template v-if="isCurrentUserPending">
        <section class="staff-section pending">
          <h2>招待承認</h2>
          <div class="staff-list">
            <div v-for="staff in pendingStaff.filter(s => s.email === currentUserEmail)" :key="staff.email" class="staff-card">
              <div class="staff-info">
                <div class="staff-icon">👤</div>
                <div class="staff-details">
                  <div class="staff-email">{{ staff.email }}</div>
                  <div class="staff-meta">{{ getRoleLabel(staff.role) }}として招待されました</div>
                </div>
              </div>

              <div class="staff-actions">
                <button
                  @click="() => handleRespondToInvitation(true)"
                  class="action-btn approve-btn"
                >
                  承認
                </button>
                <button
                  @click="() => handleRespondToInvitation(false)"
                  class="action-btn reject-btn"
                >
                  拒否
                </button>
              </div>
            </div>
          </div>
        </section>
        <div class="permission-notice">
          ℹ️ 招待を承認すると、他のスタッフの情報を確認できるようになります。
        </div>
      </template>

      <!-- active 사용자인 경우: 전체 스태프 목록 표시 -->
      <template v-else>
        <!-- 참여 요청 (storeJoinRequests 컬렉션에서) -->
        <section v-if="isOwner && pendingJoinRequests.length > 0" class="staff-section join-requests">
          <h2>参加リクエスト ({{ pendingJoinRequests.length }})</h2>
          <div class="staff-list">
            <div v-for="request in pendingJoinRequests" :key="request.id" class="staff-card">
              <div class="staff-info">
                <div class="staff-icon">📩</div>
                <div class="staff-details">
                  <div class="staff-name" v-if="request.displayName">{{ request.displayName }}</div>
                  <div class="staff-email-small">{{ request.userEmail }}</div>
                  <div class="staff-meta" v-if="request.message">
                    メッセージ: {{ request.message }}
                  </div>
                  <div class="staff-meta">送信: {{ formatTimestamp(request.createdAt) }}</div>
                </div>
              </div>

              <div class="staff-actions">
                <button
                  @click="() => handleJoinRequest(request.id, true, request.userEmail, request.displayName)"
                  class="action-btn approve-btn"
                >
                  承認
                </button>
                <button
                  @click="() => handleJoinRequest(request.id, false, request.userEmail)"
                  class="action-btn reject-btn"
                >
                  拒否
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 승인 대기 중 (staffList에서) -->
        <section v-if="pendingStaff.length > 0" class="staff-section pending">
          <h2>承認待ち ({{ pendingStaff.length }})</h2>
          <div class="staff-list">
            <div v-for="staff in pendingStaff" :key="staff.email" class="staff-card">
              <div class="staff-info">
                <div class="staff-icon">👤</div>
                <div class="staff-details">
                  <div class="staff-email">{{ staff.email }}</div>
                  <div class="staff-meta">{{ getRoleLabel(staff.role) }}</div>
                </div>
              </div>

              <!-- 본인 초대인 경우에만 액션 버튼 표시 -->
              <div v-if="staff.email === currentUserEmail" class="staff-actions">
                <button
                  @click="() => handleRespondToInvitation(true)"
                  class="action-btn approve-btn"
                >
                  承認
                </button>
                <button
                  @click="() => handleRespondToInvitation(false)"
                  class="action-btn reject-btn"
                >
                  拒否
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 활성 스태프 -->
        <section class="staff-section active">
        <h2>スタッフ ({{ activeStaff.length }})</h2>
        <div v-if="activeStaff.length === 0" class="no-staff">
          現在アクティブなスタッフはいません。
        </div>
        <div v-else class="staff-list">
          <div
            v-for="staff in activeStaff"
            :key="staff.email"
            class="staff-card"
            :class="{ 'is-current-user': staff.email === currentUserEmail }"
          >
            <div class="staff-info">
              <div class="staff-avatar-container">
                <img
                  :src="staff.staffImageUrl || currentUser?.photoURL || '/default-avatar.png'"
                  :alt="staff.displayName || staff.email"
                  class="staff-avatar"
                />
                <div class="staff-role-badge">
                  {{ staff.role === 'owner' ? '👑' : '⚙️' }}
                </div>
              </div>
              <div class="staff-details">
                <div class="staff-name">
                  {{ staff.displayName || staff.email }}
                  <span v-if="staff.email === currentUserEmail" class="you-badge"> (あなた) </span>
                </div>
                <div v-if="staff.displayName" class="staff-email-small">{{ staff.email }}</div>
                <div class="staff-meta-row">
                  <div class="staff-meta">
                    {{ getRoleLabel(staff.role) }}
                  </div>
                  <div class="staff-actions-inline">
                    <!-- 오너가 다른 스태프 제거 -->
                    <button
                      v-if="isOwner && staff.email !== currentUserEmail && staff.role !== 'owner'"
                      @click="() => handleRemoveStaff(staff.email)"
                      class="remove-btn"
                      title="スタッフを削除"
                    >
                      🗑️
                    </button>
                    <!-- 본인이 탈퇴 (오너는 다른 오너가 있을 때만) -->
                    <button
                      v-if="staff.email === currentUserEmail && (staff.role !== 'owner' || canOwnerLeave)"
                      @click="() => handleLeaveStore()"
                      class="leave-btn"
                      title="退店"
                    >
                      🚪
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

        <!-- 권한 안내 -->
        <div v-if="!isOwner" class="permission-notice">ℹ️ スタッフの招待はオーナーのみ可能です。</div>
      </template>
    </div>

    <!-- 초대 모달 -->
    <div v-if="showInviteModal" class="modal-overlay" @click="cancelInvite">
      <div class="modal-content" @click.stop>
        <h2>スタッフを招待</h2>

        <form @submit.prevent="handleInviteStaff" class="invite-form">
          <div class="form-group">
            <label>メールアドレス <span class="required">*</span></label>
            <input
              v-model="inviteForm.email"
              type="email"
              placeholder="example@email.com"
              required
              autofocus
            />
          </div>

          <div class="form-group">
            <label>役割</label>
            <select v-model="inviteForm.role">
              <option value="staff">スタッフ</option>
              <option value="owner">オーナー</option>
            </select>
            <p class="form-hint">
              スタッフ: 順番待ちリストの管理が可能<br />
              オーナー: スタッフの招待・管理も可能
            </p>
          </div>

          <div class="modal-actions">
            <button type="button" @click="cancelInvite" class="cancel-button">キャンセル</button>
            <button type="submit" :disabled="isInviting" class="submit-button">
              {{ isInviting ? '送信中...' : '招待を送信' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 表示名編集モダル -->
    <div v-if="showDisplayNameModal" class="modal-overlay" @click="cancelDisplayName">
      <div class="modal-content" @click.stop>
        <h2>表示名・プロフィール画像編集</h2>

        <form @submit.prevent="handleUpdateDisplayName" class="display-name-form">
          <div class="form-group">
            <label>表示名（任意）</label>
            <input
              v-model="displayNameForm.displayName"
              type="text"
              placeholder="例：山田 太郎"
              autofocus
            />
            <p class="form-hint">
              他のスタッフに表示される名前です。空にするとメールアドレスが表示されます。
            </p>
          </div>

          <div class="form-group">
            <label>プロフィール画像（任意）</label>
            <div class="image-upload-section">
              <div v-if="staffImagePreview" class="image-preview-container">
                <img :src="staffImagePreview" alt="プレビュー" class="image-preview" />
                <button type="button" @click="removeStaffImage" class="remove-image-btn">✕</button>
              </div>
              <label class="image-upload-label">
                <input
                  type="file"
                  accept="image/*"
                  @change="handleStaffImageSelect"
                  class="image-upload-input"
                />
                <span class="upload-button-text">
                  {{ staffImagePreview ? '画像を変更' : '画像を選択' }}
                </span>
              </label>
            </div>
            <p class="form-hint">
              スタッフリストに表示される画像です。未設定の場合は共通プロフィール画像が表示されます。
            </p>
          </div>

          <div class="modal-actions">
            <button type="button" @click="cancelDisplayName" class="cancel-button">キャンセル</button>
            <button type="submit" :disabled="isUpdatingDisplayName" class="submit-button">
              {{ isUpdatingDisplayName ? '更新中...' : '更新' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 招待承認時の表示名入力モダル -->
    <div v-if="showInvitationAcceptModal" class="modal-overlay" @click="showInvitationAcceptModal = false">
      <div class="modal-content" @click.stop>
        <h2>招待を承認</h2>

        <form @submit.prevent="handleAcceptInvitation" class="display-name-form">
          <div class="form-group">
            <label>表示名（任意）</label>
            <input
              v-model="invitationAcceptForm.displayName"
              type="text"
              placeholder="例：山田 太郎"
              autofocus
            />
            <p class="form-hint">
              店舗内で表示される名前です。後で変更できます。
            </p>
          </div>

          <div class="modal-actions">
            <button type="button" @click="showInvitationAcceptModal = false" class="cancel-button">キャンセル</button>
            <button type="submit" :disabled="isAcceptingInvitation" class="submit-button">
              {{ isAcceptingInvitation ? '承認中...' : '承認' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* モバイルファースト: すべてのデバイスで同じUIを表示 */
.staff-management-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
}

/* 헤더 */
.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

h1 {
  font-size: 1.3rem;
  color: #333;
  margin: 0;
  text-align: center;
  width: 100%;
}

.header-buttons {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
}

.display-name-button {
  flex: 1;
  padding: 0.75rem 0.5rem;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background-color 0.3s;
  white-space: nowrap;
}

.display-name-button:active {
  background-color: #1976d2;
  transform: scale(0.98);
}

.invite-button {
  flex: 1;
  padding: 0.75rem 0.5rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background-color 0.3s;
  white-space: nowrap;
}

.invite-button:active {
  background-color: #45a049;
  transform: scale(0.98);
}

/* 로딩 및 에러 */
.loading,
.error {
  text-align: center;
  padding: 3rem;
  font-size: 1.1rem;
}

.error {
  color: #f44336;
}

/* 스태프 섹션 */
.staff-sections {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.staff-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.staff-section h2 {
  margin: 0 0 1rem 0;
  font-size: 1.3rem;
  color: #333;
}

.staff-section.join-requests h2 {
  color: #2196f3;
}

.staff-section.pending h2 {
  color: #ff9800;
}

.no-staff {
  text-align: center;
  padding: 2rem;
  color: #999;
}

/* 스태프 목록 */
.staff-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.staff-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: background 0.3s;
  position: relative;
}

.staff-card:active {
  background: #e9ecef;
}

/* 현재 사용자 강조 */
.staff-card.is-current-user {
  border: 3px solid #4caf50;
  padding-bottom: 1.5rem;
}

.staff-card.is-current-user::after {
  content: 'あなた';
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background: #4caf50;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.staff-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.staff-avatar-container {
  position: relative;
  width: 45px;
  height: 45px;
  min-width: 45px;
  min-height: 45px;
  flex-shrink: 0;
}

.staff-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e0e0e0;
}

.staff-role-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  border: 2px solid #e0e0e0;
}

.staff-icon {
  font-size: 1.75rem;
  width: 45px;
  height: 45px;
  min-width: 45px;
  min-height: 45px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
}

.staff-details {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.staff-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
  word-break: break-word;
  overflow-wrap: break-word;
  font-size: 0.9rem;
}

.staff-email {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
  word-break: break-all;
  overflow-wrap: break-word;
  font-size: 0.9rem;
}

.staff-email-small {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.25rem;
  word-break: break-all;
  overflow-wrap: break-word;
}

/* you-badge는 ::after 의사 요소로 대체하므로 숨김 */
.you-badge {
  display: none;
}

.staff-meta {
  font-size: 0.8rem;
  color: #666;
}

.staff-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.15rem;
}

.staff-actions-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* 스태프 상태 */
.staff-actions-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pending-label {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  background-color: #fff3e0;
  color: #e65100;
}

.remove-btn,
.leave-btn {
  padding: 0.5rem;
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  transition: transform 0.2s;
  opacity: 0.6;
}

.remove-btn:hover,
.leave-btn:hover {
  transform: scale(1.2);
  opacity: 1;
}

/* 스태프 액션 */
.staff-actions {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s;
}

.approve-btn {
  background-color: #4caf50;
  color: white;
}

.approve-btn:active {
  background-color: #45a049;
  transform: scale(0.98);
}

.reject-btn {
  background-color: #f44336;
  color: white;
}

.reject-btn:active {
  background-color: #da190b;
  transform: scale(0.98);
}

/* 권한 안내 */
.permission-notice {
  padding: 1rem;
  background-color: #e3f2fd;
  color: #1565c0;
  border-radius: 8px;
  text-align: center;
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
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 500px;
  width: 95%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content h2 {
  margin: 0 0 1.5rem 0;
  color: #333;
  font-size: 1.3rem;
}

.invite-form,
.display-name-form {
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
.form-group select {
  padding: 0.75rem;
  font-size: 16px; /* iOS のズーム防止 */
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4caf50;
}

.form-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.5;
}

/* 画像アップロード */
.image-upload-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
}

.image-preview-container {
  position: relative;
  width: 120px;
  height: 120px;
}

.image-preview {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid #e0e0e0;
}

.remove-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: #f44336;
  color: white;
  border: 2px solid white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 0.3s;
}

.remove-image-btn:hover {
  background-color: #da190b;
}

.image-upload-label {
  display: inline-block;
  cursor: pointer;
}

.image-upload-input {
  display: none;
}

.upload-button-text {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.upload-button-text:hover {
  background-color: #e0e0e0;
  border-color: #ccc;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: flex-end;
}

.cancel-button,
.submit-button {
  width: 100%;
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

/* モバイルファースト: すべてのデバイスで同じUIを表示 */
</style>
