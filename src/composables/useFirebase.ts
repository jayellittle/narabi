import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'
import type { Store, WaitingCustomer } from '../types'

export function useFirebase() {
  const db = getFirestore()
  const functions = getFunctions()
  const auth = getAuth()

  // ========================================
  // 매장 관련
  // ========================================

  /**
   * 매장 등록 신청
   */
  const requestStoreRegistration = async (storeData: {
    storeName: string
    address: string
    phoneNumber: string
    googleMapsUrl?: string
    message?: string
  }) => {
    const registerStore = httpsCallable(functions, 'requestStoreRegistration')
    return await registerStore(storeData)
  }

  /**
   * 기존 매장에 참여 요청
   */
  const requestJoinStore = async (storeId: string, message?: string) => {
    const joinStore = httpsCallable(functions, 'requestJoinStore')
    return await joinStore({ storeId, message })
  }

  /**
   * 매장 승인 (관리자용)
   */
  const approveStore = async (storeId: string, approved: boolean) => {
    const approveStoreFunc = httpsCallable(functions, 'approveStoreRegistration')
    return await approveStoreFunc({ storeId, approved })
  }

  /**
   * 매장 정보 가져오기
   */
  const getStore = async (storeId: string): Promise<Store | null> => {
    const storeDoc = await getDoc(doc(db, 'stores', storeId))
    if (!storeDoc.exists()) return null
    return { id: storeDoc.id, ...storeDoc.data() } as Store
  }

  /**
   * 모든 매장 목록 가져오기
   */
  const getStores = async (status?: 'pending' | 'approved' | 'rejected'): Promise<Store[]> => {
    let q: Query<DocumentData, DocumentData> = collection(db, 'stores')

    if (status) {
      q = query(collection(db, 'stores'), where('status', '==', status))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Store)
  }

  /**
   * 내 매장 목록 가져오기
   */
  const getMyStores = async (): Promise<Store[]> => {
    const user = auth.currentUser
    if (!user) return []

    const q = query(collection(db, 'stores'), where('ownerId', '==', user.uid))

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Store)
  }

  /**
   * QR 코드 생성
   */
  const generateQRCode = async (storeId: string) => {
    const generateQR = httpsCallable(functions, 'generateStoreQR')
    return await generateQR({ storeId })
  }

  // ========================================
  // 스태프 관련
  // ========================================

  /**
   * 스태프 초대
   */
  const inviteStaff = async (storeId: string, email: string, role: 'owner' | 'staff' = 'staff') => {
    const inviteStaffFunc = httpsCallable(functions, 'inviteStaff')
    return await inviteStaffFunc({ storeId, email, role })
  }

  /**
   * 스태프 초대 응답
   */
  const respondToInvitation = async (storeId: string, accepted: boolean, displayName?: string) => {
    const respondFunc = httpsCallable(functions, 'respondToStaffInvitation')
    return await respondFunc({ storeId, accepted, displayName })
  }

  /**
   * 스태프 표시명 업데이트
   */
  const updateStaffDisplayName = async (storeId: string, displayName: string) => {
    const updateFunc = httpsCallable(functions, 'updateStaffDisplayName')
    return await updateFunc({ storeId, displayName })
  }

  // ========================================
  // 대기열 관련
  // ========================================

  /**
   * 대기열 실시간 구독
   */
  const subscribeToWaitingList = (
    storeId: string,
    callback: (customers: WaitingCustomer[]) => void,
  ) => {
    const q = query(
      collection(db, 'stores', storeId, 'waitingList'),
      where('status', 'in', ['waiting', 'called']),
      orderBy('queueNumber', 'asc'),
    )

    return onSnapshot(q, (snapshot) => {
      const customers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WaitingCustomer[]
      callback(customers)
    })
  }

  /**
   * 来店完了履歴 실시간 구독
   */
  const subscribeToCompletedHistory = (
    storeId: string,
    callback: (customers: WaitingCustomer[]) => void,
  ) => {
    const q = query(
      collection(db, 'stores', storeId, 'waitingList'),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc'),
    )

    return onSnapshot(q, (snapshot) => {
      const customers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WaitingCustomer[]
      callback(customers)
    })
  }

  /**
   * 取消履歴 실시간 구독
   */
  const subscribeToCancelledHistory = (
    storeId: string,
    callback: (customers: WaitingCustomer[]) => void,
  ) => {
    const q = query(
      collection(db, 'stores', storeId, 'waitingList'),
      where('status', '==', 'cancelled'),
      orderBy('cancelledAt', 'desc'),
    )

    return onSnapshot(q, (snapshot) => {
      const customers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WaitingCustomer[]
      callback(customers)
    })
  }

  /**
   * 고객 호출
   */
  const callCustomer = async (storeId: string, customerId: string) => {
    const callFunc = httpsCallable(functions, 'sendCallNotification')
    return await callFunc({ storeId, customerId })
  }

  /**
   * 대기 취소
   */
  const cancelWaiting = async (storeId: string, customerId: string) => {
    const cancelFunc = httpsCallable(functions, 'cancelWaiting')
    return await cancelFunc({ storeId, customerId })
  }

  /**
   * 입장 완료
   */
  const completeEntry = async (storeId: string, customerId: string) => {
    const completeFunc = httpsCallable(functions, 'completeEntry')
    return await completeFunc({ storeId, customerId })
  }

  /**
   * 대기 시간 추정
   */
  const getEstimatedWaitTime = async (storeId: string, queueNumber: number) => {
    const estimateFunc = httpsCallable(functions, 'getEstimatedWaitTime')
    return await estimateFunc({ storeId, queueNumber })
  }

  /**
   * 대기열 등록 (LINE 로그인)
   */
  const registerToWaitlist = async (code: string, storeId: string) => {
    const registerFunc = httpsCallable(functions, 'registerWaitlist')
    return await registerFunc({ code, storeId })
  }

  /**
   * 수동 고객 등록 (스태프용)
   */
  const registerManualCustomer = async (
    storeId: string,
    customerData: {
      displayName: string
      partySize: number
      phoneNumber: string
    },
  ) => {
    const registerFunc = httpsCallable(functions, 'registerManualCustomer')
    return await registerFunc({ storeId, ...customerData })
  }

  return {
    // 매장
    requestStoreRegistration,
    requestJoinStore,
    approveStore,
    getStore,
    getStores,
    getMyStores,
    generateQRCode,

    // 스태프
    inviteStaff,
    respondToInvitation,
    updateStaffDisplayName,

    // 대기열
    subscribeToWaitingList,
    subscribeToCompletedHistory,
    subscribeToCancelledHistory,
    callCustomer,
    cancelWaiting,
    completeEntry,
    getEstimatedWaitTime,
    registerToWaitlist,
    registerManualCustomer,
  }
}

/**
 * 시간 포맷 유틸리티
 */
export function useTimeFormat() {
  const formatTimestamp = (timestamp: Timestamp | Date | number | null | undefined): string => {
    if (!timestamp) return ''

    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp)

    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60) // 분 단위

    if (diff < 1) return '방금 전'
    if (diff < 60) return `${diff}分前`
    if (diff < 1440) return `${Math.floor(diff / 60)}時間前`
    return `${Math.floor(diff / 1440)}日前`
  }

  const formatWaitTime = (minutes: number): string => {
    if (minutes < 60) return `約${minutes}分`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `約${hours}時間${mins}分` : `約${hours}時間`
  }

  return {
    formatTimestamp,
    formatWaitTime,
  }
}
