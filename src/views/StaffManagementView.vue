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
import type { Store, StaffMember } from '../types'

const route = useRoute()
const router = useRouter()
const auth = getAuth()
const db = getFirestore()
const { getStore, inviteStaff, respondToInvitation } = useFirebase()
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
const handleJoinRequest = async (requestId: string, approved: boolean, userEmail: string) => {
  try {
    const requestRef = doc(db, 'storeJoinRequests', requestId)
    const storeRef = doc(db, 'stores', storeId.value)

    if (approved) {
      // 승인: staffList에 추가
      await updateDoc(storeRef, {
        staffList: arrayUnion({
          email: userEmail,
          role: 'staff',
          status: 'active',
          invitedAt: new Date(),
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
          errorMessage = 'このメールアドレスは既に招待されています。'
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

// 초대 승인/거절 핸들러
const handleRespondToInvitation = async (accepted: boolean) => {
  try {
    await respondToInvitation(storeId.value, accepted)

    if (accepted) {
      alert('招待を承認しました。ページを再読み込みします。')
      // Dashboard로 리디렉션 후 다시 해당 스토어로 이동
      router.push('/dashboard')
      setTimeout(() => {
        router.push(`/store/${storeId.value}`)
      }, 100)
    } else {
      alert('招待を拒否しました。')
      router.push('/dashboard')
    }
  } catch (err: any) {
    console.error('초대 응답 실패:', err)
    alert(err.message || '招待への応答に失敗しました。')
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
    await handleRemoveStaff(currentUserEmail.value)
    alert('退店しました。')
    router.push('/dashboard')
  } catch (err: any) {
    console.error('탈퇴 실패:', err)
    alert(err.message || '退店に失敗しました。')
  }
}

onMounted(() => {
  loadStore()
})
</script>

<template>
  <div class="staff-management-container">
    <div class="header">
      <h1>スタッフ管理</h1>
      <button v-if="isOwner" @click="showInviteModal = true" class="invite-button">
        + 新規招待
      </button>
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
                  <div class="staff-email">{{ request.userEmail }}</div>
                  <div class="staff-meta" v-if="request.message">
                    メッセージ: {{ request.message }}
                  </div>
                  <div class="staff-meta">送信: {{ formatTimestamp(request.createdAt) }}</div>
                </div>
              </div>

              <div class="staff-actions">
                <button
                  @click="() => handleJoinRequest(request.id, true, request.userEmail)"
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
              <div class="staff-icon">
                {{ staff.role === 'owner' ? '👑' : '👤' }}
              </div>
              <div class="staff-details">
                <div class="staff-email">
                  {{ staff.email }}
                  <span v-if="staff.email === currentUserEmail" class="you-badge"> (あなた) </span>
                </div>
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
  </div>
</template>

<style scoped>
.staff-management-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

/* 헤더 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

h1 {
  font-size: 2rem;
  color: #333;
  margin: 0;
}

.invite-button {
  padding: 0.75rem 1.5rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background-color 0.3s;
}

.invite-button:hover {
  background-color: #45a049;
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
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: background 0.3s;
  position: relative;
}

.staff-card:hover {
  background: #e9ecef;
}

/* PC에서도 현재 사용자 강조 */
.staff-card.is-current-user {
  border: 3px solid #4caf50;
  padding-bottom: 2.5rem;
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
  gap: 1rem;
  flex: 1;
}

.staff-icon {
  font-size: 2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
}

.staff-details {
  flex: 1;
}

.staff-email {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

/* you-badge는 ::after 의사 요소로 대체하므로 숨김 */
.you-badge {
  display: none;
}

.staff-meta {
  font-size: 0.85rem;
  color: #666;
}

.staff-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
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
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s;
}

.approve-btn {
  background-color: #4caf50;
  color: white;
}

.approve-btn:hover {
  background-color: #45a049;
}

.reject-btn {
  background-color: #f44336;
  color: white;
}

.reject-btn:hover {
  background-color: #da190b;
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
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-content h2 {
  margin: 0 0 1.5rem 0;
  color: #333;
}

.invite-form {
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
  font-size: 1rem;
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

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
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

/* モバイル対応 */
@media (max-width: 768px) {
  .staff-management-container {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  h1 {
    font-size: 1.5rem;
  }

  .invite-button {
    width: 100%;
    padding: 1rem;
    font-size: 1rem;
  }

  .staff-section {
    padding: 1.25rem;
  }

  .staff-section h2 {
    font-size: 1.2rem;
  }

  .staff-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
    position: relative;
  }

  /* 모바일에서 현재 사용자 카드의 하단 패딩 조정 */
  .staff-card.is-current-user {
    padding-bottom: 2rem;
  }

  .staff-info {
    width: 100%;
  }

  .staff-icon {
    width: 60px;
    height: 60px;
    font-size: 2.5rem;
  }

  .staff-email {
    font-size: 1rem;
  }

  .staff-actions {
    width: 100%;
    flex-direction: row;
    gap: 0.5rem;
  }

  .action-btn {
    flex: 1;
    padding: 0.75rem;
    font-size: 1rem;
  }

  .staff-actions-row {
    width: 100%;
    justify-content: space-between;
  }

  .modal-content {
    width: 95%;
    padding: 1.5rem;
  }

  .modal-content h2 {
    font-size: 1.3rem;
  }

  .form-group input,
  .form-group select {
    font-size: 16px; /* iOS のズーム防止 */
  }

  .modal-actions {
    flex-direction: column;
  }

  .cancel-button,
  .submit-button {
    width: 100%;
  }
}

/* 小さいモバイル画面 */
@media (max-width: 480px) {
  h1 {
    font-size: 1.3rem;
  }

  .staff-section h2 {
    font-size: 1.1rem;
  }

  .staff-icon {
    width: 50px;
    height: 50px;
    font-size: 2rem;
  }
}
</style>
