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
        <ul>
          <li v-for="customer in waitingList" :key="customer.id">
            <img
              :src="customer.pictureUrl"
              width="30"
              style="border-radius: 50%; vertical-align: middle; margin-right: 8px"
            />
            {{ customer.displayName }} 様
            <button @click="callCustomer(customer.id)">呼び出す</button>
          </li>
        </ul>
        <p v-if="waitingList.length === 0">現在順番待ち中のお客様がいらっしゃいません。</p>
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

interface Store {
  name: string
  address: string
  phoneNumber: string
  googleMapsUrl?: string
  ownerId: string
  createdAt: Date
}

interface Customer {
  id: string
  displayName: string
  pictureUrl: string
}

const db = getFirestore()
const route = useRoute()
const router = useRouter()
const storeId = route.params.storeId as string

const store = ref<Store | null>(null)
const waitingUrl = ref('')
const waitingList = ref<Customer[]>([])

onMounted(async () => {
  if (storeId) {
    // 1. 가게 기본 정보(이름 등) 불러오기
    const storeDocRef = doc(db, 'stores', storeId)
    const storeDoc = await getDoc(storeDocRef)

    if (storeDoc.exists()) {
      const data = storeDoc.data()
      store.value = {
        name: data.name,
        address: data.address,
        phoneNumber: data.phoneNumber,
        googleMapsUrl: data.googleMapsUrl,
        ownerId: data.ownerId,
        createdAt: data.createdAt?.toDate() || new Date(),
      }
    } else {
      console.error('Store not found!')
      alert('店舗情報が見つかりませんでした。')
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
