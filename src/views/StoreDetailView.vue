<template>
  <div>
    <div v-if="store">
      <h1>{{ store.name }}</h1>
      <h2>管理画面</h2>

      <div class="qrcode-section">
        <h3>順番待ち登録用のQRコード</h3>
        <qrcode-vue :value="waitingUrl" :size="250" level="H" />
      </div>

      <div class="waitlist-section">
        <h3>現在の順番待ちリスト</h3>
        <ul class="customer-list">
          <li v-for="(customer, index) in waitingList" :key="customer.id" class="customer-item">
            <div class="customer-info">
              <div class="customer-number">{{ index + 1 }}</div>
              <div class="customer-profile">
                <img
                  :src="customer.pictureUrl"
                  class="customer-avatar"
                  alt="Customer Avatar"
                />
                <div class="party-size">{{ customer.partySize || 1 }}名</div>
              </div>
              <div class="customer-details">
                <div class="customer-name">{{ customer.displayName }} 様</div>
                <div v-if="customer.phoneNumber" class="customer-phone">📞 {{ customer.phoneNumber }}</div>
              </div>
            </div>
            <div class="customer-actions">
              <button @click="callCustomer(customer.id)" class="btn-call">呼び出す</button>
              <button @click="openEditModal(customer)" class="btn-edit">編集</button>
              <button @click="removeCustomer(customer.id)" class="btn-remove">削除</button>
            </div>
          </li>
        </ul>
        <p v-if="waitingList.length === 0" class="empty-message">現在順番待ち中のお客様がいらっしゃいません。</p>
      </div>

      <!-- 編集モーダル -->
      <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
        <div class="modal-content" @click.stop>
          <h3>お客様情報編集</h3>
          <form @submit.prevent="saveCustomerEdit">
            <div class="form-group">
              <label for="editName">お名前 <span class="required">*</span></label>
              <input
                type="text"
                id="editName"
                v-model="editingCustomer.displayName"
                required
                maxlength="50"
              />
            </div>
            <div class="form-group">
              <label for="editPartySize">人数 <span class="required">*</span></label>
              <input
                type="number"
                id="editPartySize"
                v-model.number="editingCustomer.partySize"
                min="1"
                max="20"
                required
              />
            </div>
            <div class="form-group">
              <label for="editPhone">電話番号</label>
              <input
                type="tel"
                id="editPhone"
                v-model="editingCustomer.phoneNumber"
                maxlength="20"
              />
            </div>
            <div class="modal-actions">
              <button type="button" @click="closeEditModal" class="btn-cancel">キャンセル</button>
              <button type="submit" class="btn-save">保存</button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <div v-else>
      <p>店舗情報を呼び出し中です...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import QrcodeVue from 'qrcode.vue'

interface Customer {
  id: string
  displayName: string
  pictureUrl: string
  partySize?: number
  phoneNumber?: string
  lineUserId?: string
}

const db = getFirestore()
const route = useRoute()
const router = useRouter()
const storeId = route.params.storeId as string

const store = ref<{ name: string } | null>(null)
const waitingUrl = ref('')
const waitingList = ref<Customer[]>([])
const showEditModal = ref(false)
const editingCustomer = ref<Customer>({
  id: '',
  displayName: '',
  pictureUrl: '',
  partySize: 1,
  phoneNumber: ''
})

onMounted(async () => {
  if (storeId) {
    // 1. 가게 기본 정보(이름 등) 불러오기
    const storeDocRef = doc(db, 'stores', storeId)
    const storeDoc = await getDoc(storeDocRef)
    if (storeDoc.exists()) {
      store.value = { name: storeDoc.data().name }
    } else {
      console.error('Store not found!')
      router.push('/dashboard')
    }

    // 2. QR코드에 담을 URL 생성 (실제 배포 주소로 변경 필요)
    waitingUrl.value = `https://narabi-a8765.web.app/wait/${storeId}`

    // 3. 이 가게의 대기 목록을 실시간으로 감시 시작
    setupWaitingListListener(storeId)
  }
})

// 고객 호출 함수
const callCustomer = async (customerId: string) => {
  if (!storeId) return

  try {
    const functions = getFunctions()
    const sendCallNotification = httpsCallable(functions, 'sendCallNotification')
    await sendCallNotification({
      storeId: storeId,
      customerId: customerId,
    })
    alert('呼び出し通知を送信しました。')
  } catch (error) {
    console.error('通知の送信に失敗しました：', error)
    alert('通知の送信に失敗しました。')
  }
}

// 고객 삭제 함수
const removeCustomer = async (customerId: string) => {
  if (!storeId) return

  if (!confirm('本当にこのお客様を削除しますか？')) {
    return
  }

  try {
    const customerDocRef = doc(db, `stores/${storeId}/waitingList`, customerId)
    await import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(customerDocRef))
    alert('お客様を削除しました。')
  } catch (error) {
    console.error('削除に失敗しました：', error)
    alert('削除に失敗しました。')
  }
}

// 편집 모달 열기
const openEditModal = (customer: Customer) => {
  editingCustomer.value = {
    ...customer,
    partySize: customer.partySize || 1,
    phoneNumber: customer.phoneNumber || ''
  }
  showEditModal.value = true
}

// 편집 모달 닫기
const closeEditModal = () => {
  showEditModal.value = false
}

// 고객 정보 저장
const saveCustomerEdit = async () => {
  if (!storeId || !editingCustomer.value.id) return

  try {
    const customerDocRef = doc(db, `stores/${storeId}/waitingList`, editingCustomer.value.id)
    const { updateDoc } = await import('firebase/firestore')
    await updateDoc(customerDocRef, {
      displayName: editingCustomer.value.displayName,
      partySize: editingCustomer.value.partySize,
      phoneNumber: editingCustomer.value.phoneNumber || ''
    })
    alert('お客様情報を更新しました。')
    closeEditModal()
  } catch (error) {
    console.error('更新に失敗しました：', error)
    alert('更新に失敗しました。')
  }
}

// 실시간 대기 목록 감시 설정 함수
const setupWaitingListListener = (currentStoreId: string) => {
  const q = query(
    collection(db, `stores/${currentStoreId}/waitingList`),
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'asc'),
  )

  onSnapshot(q, (querySnapshot) => {
    const list: Customer[] = []
    querySnapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as Customer)
    })
    waitingList.value = list
  })
}
</script>

<style scoped>
.qrcode-section {
  margin: 30px 0;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
  text-align: center;
}

.waitlist-section {
  margin: 30px 0;
}

.waitlist-section h3 {
  margin-bottom: 20px;
  font-size: 20px;
  color: #333;
}

.customer-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.customer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  transition: box-shadow 0.2s;
}

.customer-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.customer-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.customer-number {
  font-size: 24px;
  font-weight: bold;
  color: #666;
  min-width: 30px;
}

.customer-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.customer-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.party-size {
  font-size: 12px;
  font-weight: bold;
  color: #00c300;
  background: #e8f5e9;
  padding: 2px 8px;
  border-radius: 12px;
}

.customer-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customer-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.customer-phone {
  font-size: 13px;
  color: #666;
}

.customer-actions {
  display: flex;
  gap: 8px;
}

.customer-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-call {
  background-color: #00c300;
  color: white;
}

.btn-call:hover {
  background-color: #00a300;
}

.btn-edit {
  background-color: #2196f3;
  color: white;
}

.btn-edit:hover {
  background-color: #1976d2;
}

.btn-remove {
  background-color: #f44336;
  color: white;
}

.btn-remove:hover {
  background-color: #d32f2f;
}

.empty-message {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 16px;
}

/* モーダルスタイル */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  margin-bottom: 20px;
  font-size: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.form-group .required {
  color: #e74c3c;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #2196f3;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-cancel {
  padding: 10px 24px;
  background-color: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-cancel:hover {
  background-color: #e8e8e8;
}

.btn-save {
  padding: 10px 24px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-save:hover {
  background-color: #1976d2;
}

@media (max-width: 768px) {
  .customer-item {
    flex-direction: column;
    gap: 12px;
  }

  .customer-info {
    width: 100%;
  }

  .customer-actions {
    width: 100%;
    justify-content: stretch;
  }

  .customer-actions button {
    flex: 1;
  }
}
</style>
