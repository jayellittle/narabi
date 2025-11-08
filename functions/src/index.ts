import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import fetch from 'node-fetch'
import * as querystring from 'querystring'
import * as logger from 'firebase-functions/logger'

admin.initializeApp()

if (process.env.FUNCTIONS_EMULATOR === 'true') {
  logger.info('로컬 에뮬레이터 환경으로 실행합니다.')
}

const db = admin.firestore()

const runtimeOptsWithSecrets = {
  maxInstances: 10,
  secrets: [
    'LINE_LOGIN_CHANNEL_ID',
    'LINE_LOGIN_CHANNEL_SECRET',
    'MESSAGING_API_CHANNEL_ACCESS_TOKEN',
  ],
}

interface LineTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

interface StoreInfo {
  name: string
  address: string
  phoneNumber: string
  googleMapsUrl?: string
  status?: 'pending' | 'approved' | 'rejected'
  ownerId?: string
  staffList?: StaffMember[]
  qrCodeUrl?: string
}

interface StaffMember {
  email: string
  userId?: string
  role: 'owner' | 'staff'
  status: 'pending' | 'active' | 'rejected'
  invitedAt: admin.firestore.Timestamp
}

// ========================================
// 기존 함수: 대기열 등록
// ========================================
export const registerWaitlist = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data) => {
    const { code, storeId } = data

    const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID
    const LINE_LOGIN_CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET

    const isEmulated = process.env.FUNCTIONS_EMULATOR === 'true'
    const REDIRECT_URI = isEmulated
      ? `http://localhost:5173/wait`
      : `https://narabi-a8765.web.app/wait`

    try {
      const body = querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: LINE_LOGIN_CHANNEL_ID,
        client_secret: LINE_LOGIN_CHANNEL_SECRET,
      })

      const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
      })

      const tokenData: LineTokenResponse = await tokenResponse.json()

      if (!tokenResponse.ok) {
        throw new Error(JSON.stringify(tokenData))
      }

      const accessToken = tokenData.access_token

      const profileResponse = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const lineProfile: LineProfile = await profileResponse.json()

      if (!profileResponse.ok) {
        throw new Error(JSON.stringify(lineProfile))
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const recentRegistrations = await db
        .collection('stores')
        .doc(storeId)
        .collection('waitingList')
        .where('lineUserId', '==', lineProfile.userId)
        .where('createdAt', '>', fiveMinutesAgo)
        .get()

      if (!recentRegistrations.empty) {
        logger.warn('중복 등록 시도:', {
          lineUserId: lineProfile.userId,
          storeId: storeId,
        })
        throw new functions.https.HttpsError('already-exists', '既に登録されています。')
      }

      const existingWaiting = await db
        .collection('stores')
        .doc(storeId)
        .collection('waitingList')
        .where('lineUserId', '==', lineProfile.userId)
        .where('status', '==', 'waiting')
        .get()

      if (!existingWaiting.empty) {
        logger.warn('이미 대기 중인 사용자:', {
          lineUserId: lineProfile.userId,
          storeId: storeId,
        })
        throw new functions.https.HttpsError(
          'already-exists',
          '既に順番待ちリストに登録されています。',
        )
      }

      // 현재 대기 번호 계산
      const currentWaiting = await db
        .collection('stores')
        .doc(storeId)
        .collection('waitingList')
        .where('status', '==', 'waiting')
        .get()

      const queueNumber = currentWaiting.size + 1

      await db.collection('stores').doc(storeId).collection('waitingList').add({
        lineUserId: lineProfile.userId,
        displayName: lineProfile.displayName,
        pictureUrl: lineProfile.pictureUrl,
        status: 'waiting',
        queueNumber: queueNumber,
        createdAt: FieldValue.serverTimestamp(),
      })

      logger.info('대기 등록 완료:', {
        lineUserId: lineProfile.userId,
        displayName: lineProfile.displayName,
        storeId: storeId,
        queueNumber: queueNumber,
      })

      return { success: true, queueNumber: queueNumber }
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('LINE 인증 실패', errorMessage)
      throw new functions.https.HttpsError('internal', 'LINE認証に失敗しました。')
    }
  })

// ========================================
// 기존 함수: 호출 알림 전송
// ========================================
export const sendCallNotification = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data) => {
    if (!data || !data.storeId || !data.customerId) {
      logger.error('필수 파라미터 누락 (storeId 또는 customerId):', { data })
      throw new functions.https.HttpsError('invalid-argument', 'storeIdとcustomerIdは必須です。')
    }
    const { storeId, customerId } = data
    const MESSAGING_API_CHANNEL_ACCESS_TOKEN = process.env.MESSAGING_API_CHANNEL_ACCESS_TOKEN

    try {
      const storeDoc = await db.collection('stores').doc(storeId).get()
      if (!storeDoc.exists) {
        logger.error('점포 문서를 찾을 수 없음:', { storeId })
        throw new functions.https.HttpsError('not-found', '店舗情報が見つかりませんでした。')
      }
      const storeData = storeDoc.data() as StoreInfo

      const customerDoc = await db
        .collection('stores')
        .doc(storeId)
        .collection('waitingList')
        .doc(customerId)
        .get()
      if (!customerDoc.exists) {
        logger.error('고객 문서를 찾을 수 없음:', { storeId, customerId })
        throw new functions.https.HttpsError('not-found', '顧客情報が見つかりませんでした。')
      }
      const lineUserId = customerDoc.data()?.lineUserId
      if (!lineUserId) {
        logger.error('LINE 사용자 ID가 없음:', { customerId })
        throw new functions.https.HttpsError('failed-precondition', '顧客のLINE IDがありません。')
      }

      const messageText = `【${storeData.name}】
🚨お呼び出しの連絡
大変お待たせいたしました。
只今、お客様のお順番になりましたので、店舗の前までお越しください。

📍店舗位置
${storeData.address}${storeData.googleMapsUrl ? `\nGoogle Maps: ${storeData.googleMapsUrl}` : ''}

📞お問い合わせ
TEL: ${storeData.phoneNumber}`

      const body = {
        to: lineUserId,
        messages: [{ type: 'text', text: messageText }],
      }

      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MESSAGING_API_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(JSON.stringify(errorData))
      }

      await customerDoc.ref.update({
        status: 'called',
        calledAt: FieldValue.serverTimestamp(),
      })
      logger.info('알림 전송 완료:', { customerId, lineUserId })

      return { success: true }
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) {
        throw error
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('알림 전송 실패:', errorMessage)
      throw new functions.https.HttpsError('internal', '通知の送信に失敗しました。')
    }
  })

// ========================================
// 신규 함수: 매장 등록 신청
// ========================================
export const requestStoreRegistration = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data, context) => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
    }

    const { storeName, address, phoneNumber, googleMapsUrl, message } = data

    if (!storeName || !address || !phoneNumber) {
      throw new functions.https.HttpsError('invalid-argument', '店舗名、住所、電話番号は必須です。')
    }

    try {
      // 매장 등록 신청 생성
      const storeRef = await db.collection('stores').add({
        name: storeName,
        address,
        phoneNumber,
        googleMapsUrl: googleMapsUrl || '',
        status: 'pending',
        approvalRequestMessage: message || '',
        ownerId: context.auth.uid,
        ownerEmail: context.auth.token.email || '',
        staffList: [
          {
            email: context.auth.token.email || '',
            userId: context.auth.uid,
            role: 'owner',
            status: 'active',
            invitedAt: FieldValue.serverTimestamp(),
          },
        ],
        createdAt: FieldValue.serverTimestamp(),
      })

      logger.info('매장 등록 신청 완료:', {
        storeId: storeRef.id,
        ownerId: context.auth.uid,
        storeName,
      })

      return { success: true, storeId: storeRef.id }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('매장 등록 신청 실패:', errorMessage)
      throw new functions.https.HttpsError('internal', '店舗登録に失敗しました。')
    }
  })

// ========================================
// 신규 함수: 기존 매장에 참여 요청
// ========================================
export const requestJoinStore = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
    }

    const { storeId, message } = data

    if (!storeId) {
      throw new functions.https.HttpsError('invalid-argument', '店舗IDは必須です。')
    }

    try {
      const storeDoc = await db.collection('stores').doc(storeId).get()
      if (!storeDoc.exists) {
        throw new functions.https.HttpsError('not-found', '店舗が見つかりませんでした。')
      }

      // 참여 요청 생성
      await db.collection('storeJoinRequests').add({
        storeId,
        userId: context.auth.uid,
        userEmail: context.auth.token.email || '',
        message: message || '',
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      })

      logger.info('매장 참여 요청 완료:', {
        storeId,
        userId: context.auth.uid,
      })

      return { success: true }
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) {
        throw error
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('매장 참여 요청 실패:', errorMessage)
      throw new functions.https.HttpsError('internal', '参加リクエストに失敗しました。')
    }
  })

// ========================================
// 신규 함수: 매장 승인/거절 (관리자용)
// ========================================
export const approveStoreRegistration = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
    }

    // TODO: 관리자 권한 확인 로직 추가
    // const isAdmin = await checkAdminRole(context.auth.uid)
    // if (!isAdmin) {
    //   throw new functions.https.HttpsError('permission-denied', '権限がありません。')
    // }

    const { storeId, approved } = data

    if (!storeId || approved === undefined) {
      throw new functions.https.HttpsError('invalid-argument', '店舗IDと承認状態は必須です。')
    }

    try {
      await db
        .collection('stores')
        .doc(storeId)
        .update({
          status: approved ? 'approved' : 'rejected',
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: context.auth.uid,
        })

      logger.info('매장 승인 처리 완료:', {
        storeId,
        approved,
        approvedBy: context.auth.uid,
      })

      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('매장 승인 처리 실패:', errorMessage)
      throw new functions.https.HttpsError('internal', '承認処理に失敗しました。')
    }
  })

// ========================================
// 신규 함수: 스태프 초대
// ========================================
export const inviteStaff = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
    }

    const { storeId, email, role } = data

    if (!storeId || !email) {
      throw new functions.https.HttpsError('invalid-argument', '店舗IDとメールアドレスは必須です。')
    }

    try {
      const storeDoc = await db.collection('stores').doc(storeId).get()
      if (!storeDoc.exists) {
        throw new functions.https.HttpsError('not-found', '店舗が見つかりませんでした。')
      }

      const storeData = storeDoc.data() as StoreInfo

      // 권한 확인: owner만 초대 가능
      const isOwner = storeData.ownerId === context.auth.uid
      if (!isOwner) {
        throw new functions.https.HttpsError('permission-denied', '権限がありません。')
      }

      // 이미 스태프 목록에 있는지 확인
      const existingStaff = storeData.staffList?.find((staff) => staff.email === email)
      if (existingStaff) {
        throw new functions.https.HttpsError('already-exists', '既に招待されています。')
      }

      // 스태프 추가
      await db
        .collection('stores')
        .doc(storeId)
        .update({
          staffList: FieldValue.arrayUnion({
            email,
            role: role || 'staff',
            status: 'pending',
            invitedAt: new Date(),
          }),
        })

      logger.info('스태프 초대 완료:', {
        storeId,
        email,
        invitedBy: context.auth.uid,
      })

      return { success: true }
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) {
        throw error
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('스태프 초대 실패', { error: errorMessage, storeId, email })
      throw new functions.https.HttpsError('internal', 'スタッフ招待に失敗しました。')
    }
  })

// ========================================
// 신규 함수: 스태프 초대 승인/거절
// ========================================
export const respondToStaffInvitation = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
    }

    const { storeId, accepted } = data

    if (!storeId || accepted === undefined) {
      throw new functions.https.HttpsError('invalid-argument', '店舗IDと応答は必須です。')
    }

    try {
      const storeDoc = await db.collection('stores').doc(storeId).get()
      if (!storeDoc.exists) {
        throw new functions.https.HttpsError('not-found', '店舗が見つかりませんでした。')
      }

      const storeData = storeDoc.data() as StoreInfo
      const userEmail = context.auth.token.email

      // 초대받은 스태프 찾기
      const staffIndex = storeData.staffList?.findIndex(
        (staff) => staff.email === userEmail && staff.status === 'pending',
      )

      if (staffIndex === undefined || staffIndex === -1) {
        throw new functions.https.HttpsError('not-found', '招待が見つかりませんでした。')
      }

      // 스태프 상태 업데이트
      const updatedStaffList = [...(storeData.staffList || [])]
      if (accepted) {
        // 승인시: userId를 설정
        updatedStaffList[staffIndex] = {
          ...updatedStaffList[staffIndex],
          status: 'active',
          userId: context.auth.uid,
        }
      } else {
        // 거절시: userId를 명시적으로 제거
        const { userId, ...staffWithoutUserId } = updatedStaffList[staffIndex]
        updatedStaffList[staffIndex] = {
          ...staffWithoutUserId,
          status: 'rejected',
        }
      }

      await db.collection('stores').doc(storeId).update({
        staffList: updatedStaffList,
      })

      logger.info('스태프 초대 응답 완료:', {
        storeId,
        userEmail,
        accepted,
      })

      return { success: true }
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) {
        throw error
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('스태프 초대 응답 실패:', errorMessage)
      throw new functions.https.HttpsError('internal', '招待への応答に失敗しました。')
    }
  })

// ========================================
// 신규 함수: QR 코드 생성
// ========================================
export const generateStoreQR = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
  }

  const { storeId } = data

  if (!storeId) {
    throw new functions.https.HttpsError('invalid-argument', '店舗IDは必須です。')
  }

  try {
    const storeDoc = await db.collection('stores').doc(storeId).get()
    if (!storeDoc.exists) {
      throw new functions.https.HttpsError('not-found', '店舗が見つかりませんでした。')
    }

    // QR 코드 URL 생성
    const isEmulated = process.env.FUNCTIONS_EMULATOR === 'true'
    const baseUrl = isEmulated ? 'http://localhost:5173' : 'https://narabi-a8765.web.app'
    const qrUrl = `${baseUrl}/wait?store=${storeId}`

    await db.collection('stores').doc(storeId).update({
      qrCodeUrl: qrUrl,
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info('QR 코드 생성 완료:', { storeId, qrUrl })

    return { success: true, qrUrl }
  } catch (error: unknown) {
    if (error instanceof functions.https.HttpsError) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('QR 코드 생성 실패:', errorMessage)
    throw new functions.https.HttpsError('internal', 'QRコード生成に失敗しました。')
  }
})

// ========================================
// 신규 함수: 대기자 취소
// ========================================
export const cancelWaiting = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
  }

  const { storeId, customerId } = data

  if (!storeId || !customerId) {
    throw new functions.https.HttpsError('invalid-argument', '店舗IDと顧客IDは必須です。')
  }

  try {
    await db.collection('stores').doc(storeId).collection('waitingList').doc(customerId).update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
    })

    logger.info('대기자 취소 완료:', { storeId, customerId })

    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('대기자 취소 실패:', errorMessage)
    throw new functions.https.HttpsError('internal', 'キャンセルに失敗しました。')
  }
})

// ========================================
// 신규 함수: 입장 완료 처리
// ========================================
export const completeEntry = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'ログインが必要です。')
  }

  const { storeId, customerId } = data

  if (!storeId || !customerId) {
    throw new functions.https.HttpsError('invalid-argument', '店舗IDと顧客IDは必須です。')
  }

  try {
    await db.collection('stores').doc(storeId).collection('waitingList').doc(customerId).update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
    })

    logger.info('입장 완료 처리:', { storeId, customerId })

    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('입장 완료 처리 실패:', errorMessage)
    throw new functions.https.HttpsError('internal', '完了処理に失敗しました。')
  }
})

// ========================================
// 신규 함수: 대기 시간 추정
// ========================================
export const getEstimatedWaitTime = functions.https.onCall(async (data) => {
  const { storeId, queueNumber } = data

  if (!storeId || !queueNumber) {
    throw new functions.https.HttpsError('invalid-argument', '店舗IDと待ち番号は必須です。')
  }

  try {
    // 평균 처리 시간 계산 (최근 10명의 평균)
    const completedCustomers = await db
      .collection('stores')
      .doc(storeId)
      .collection('waitingList')
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(10)
      .get()

    let avgProcessingTime = 15 // 기본값: 15분

    if (!completedCustomers.empty) {
      let totalTime = 0
      let count = 0

      completedCustomers.forEach((doc) => {
        const data = doc.data()
        if (data.createdAt && data.completedAt) {
          const createdAt = data.createdAt.toDate()
          const completedAt = data.completedAt.toDate()
          const processingTime = (completedAt.getTime() - createdAt.getTime()) / (1000 * 60) // 분 단위
          totalTime += processingTime
          count++
        }
      })

      if (count > 0) {
        avgProcessingTime = Math.round(totalTime / count)
      }
    }

    // 현재 대기 중인 사람 수 계산
    const currentWaiting = await db
      .collection('stores')
      .doc(storeId)
      .collection('waitingList')
      .where('status', '==', 'waiting')
      .where('queueNumber', '<', queueNumber)
      .get()

    const peopleAhead = currentWaiting.size
    const estimatedWaitTime = peopleAhead * avgProcessingTime

    return {
      success: true,
      estimatedWaitTime,
      peopleAhead,
      avgProcessingTime,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('대기 시간 추정 실패:', errorMessage)
    throw new functions.https.HttpsError('internal', '待ち時間の推定に失敗しました。')
  }
})
