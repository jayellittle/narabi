<template>
  <div>
    <h2>店舗管理</h2>

    <ul>
      <li v-for="store in myStores" :key="store.id">
        <router-link :to="`/store/${store.id}`">
          {{ store.name }}
        </router-link>
      </li>
    </ul>
    <p v-if="myStores.length === 0">登録された店舗がありません。</p>

    <hr />

    <h3>新しい店舗を追加</h3>
    <div>「*」は必須項目です。</div>
    <div class="store-form">
      <div class="form-group">
        <label>店舗名 *</label>
        <input v-model="newStore.name" type="text" placeholder="新しい店舗名" required />
      </div>

      <div class="form-group">
        <label>住所 *</label>
        <input v-model="newStore.address" type="text" placeholder="店舗の住所" required />
      </div>

      <div class="form-group">
        <label>電話番号 *</label>
        <input
          v-model="newStore.phoneNumber"
          type="tel"
          placeholder="店舗の電話番号"
          required
          :class="{ 'input-error': phoneError }"
          @blur="validatePhoneNumberBlur"
        />
        <span v-if="phoneError" class="error-text">{{ phoneError }}</span>
      </div>

      <div class="form-group">
        <label>Google Maps URL (任意)</label>
        <input
          v-model="newStore.googleMapsUrl"
          type="url"
          placeholder="例： https://maps.google.com/..."
          :class="{ 'input-error': urlError }"
          @blur="validateUrlBlur"
        />
        <span v-if="urlError" class="error-text">{{ urlError }}</span>
      </div>

      <button @click="createStore" :disabled="!canCreateStore">追加</button>
    </div>

    <button @click="handleSignOut">ログアウト</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { getFirestore, collection, addDoc, query, where, onSnapshot } from 'firebase/firestore'
import { getAuth, signOut } from 'firebase/auth'
import { useRouter } from 'vue-router'

interface Store {
  id: string
  name: string
}

interface NewStore {
  name: string
  address: string
  phoneNumber: string
  googleMapsUrl: string
}

const db = getFirestore()
const auth = getAuth()
const router = useRouter()

const myStores = ref<Store[]>([])
const newStore = ref<NewStore>({
  name: '',
  address: '',
  phoneNumber: '',
  googleMapsUrl: '',
})

const phoneError = ref('')
const urlError = ref('')

const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[0-9]{2,4}-[0-9]{2,4}-[0-9]{4}$/
  return phoneRegex.test(phone)
}

const validateUrl = (url: string): boolean => {
  if (!url) return true
  try {
    new URL(url)
    return url.startsWith('http://') || url.startsWith('https://')
  } catch {
    return false
  }
}

const validatePhoneNumberBlur = () => {
  if (!newStore.value.phoneNumber) {
    phoneError.value = ''
    return
  }
  if (!validatePhoneNumber(newStore.value.phoneNumber)) {
    phoneError.value = '電話番号の形式が正しくありません。（例：03-1234-5678）'
  } else {
    phoneError.value = ''
  }
}

const validateUrlBlur = () => {
  if (!newStore.value.googleMapsUrl) {
    urlError.value = ''
    return
  }
  if (!validateUrl(newStore.value.googleMapsUrl)) {
    urlError.value = '有効なURLを入力してください。'
  } else {
    urlError.value = ''
  }
}

const canCreateStore = computed(() => {
  const hasRequiredFields =
    newStore.value.name.trim() && newStore.value.address.trim() && newStore.value.phoneNumber.trim()

  if (!hasRequiredFields) return false

  if (!validatePhoneNumber(newStore.value.phoneNumber)) {
    return false
  }

  if (newStore.value.googleMapsUrl && !validateUrl(newStore.value.googleMapsUrl)) {
    return false
  }

  return true
})

watch(
  () => newStore.value.phoneNumber,
  () => {
    if (phoneError.value) {
      phoneError.value = ''
    }
  },
)

watch(
  () => newStore.value.googleMapsUrl,
  () => {
    if (urlError.value) {
      urlError.value = ''
    }
  },
)

onMounted(() => {
  const user = auth.currentUser
  if (user) {
    const q = query(collection(db, 'stores'), where('ownerId', '==', user.uid))

    onSnapshot(q, (snapshot) => {
      myStores.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name as string,
      }))
    })
  }
})

const createStore = async () => {
  const user = auth.currentUser
  if (user && canCreateStore.value) {
    try {
      const storeData = {
        name: newStore.value.name.trim(),
        address: newStore.value.address.trim(),
        phoneNumber: newStore.value.phoneNumber.trim(),
        googleMapsUrl: newStore.value.googleMapsUrl.trim(),
        ownerId: user.uid,
        createdAt: new Date(),
      }

      if (newStore.value.googleMapsUrl.trim()) {
        storeData.googleMapsUrl = newStore.value.googleMapsUrl.trim()
      }

      const docRef = await addDoc(collection(db, 'stores'), storeData)

      newStore.value = {
        name: '',
        address: '',
        phoneNumber: '',
        googleMapsUrl: '',
      }

      router.push(`/store/${docRef.id}`)
    } catch (error) {
      console.error('점포 작성 에러:', error)
      alert('店舗の作成に失敗しました。')
    }
  }
}

const handleSignOut = async () => {
  try {
    await signOut(auth)
    router.push('/login') // 로그아웃 성공 시 로그인 페이지로 이동
  } catch (error) {
    console.error('로그아웃 실패:', error)
  }
}
</script>

<style scoped>
.store-form {
  max-width: 400px;
  margin: 20px 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.input-error {
  border-color: #ff4444 !important;
}

.error-text {
  display: block;
  color: #ff4444;
  font-size: 12px;
  margin-top: 4px;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style>
