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
}

export const registerWaitlist = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data) => {
    const { code, storeId, partySize, customName, phoneNumber } = data

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

      // customName이 있으면 사용, 없으면 LINE 프로필 이름 사용
      const finalDisplayName = customName?.trim() || lineProfile.displayName

      await db.collection('stores').doc(storeId).collection('waitingList').add({
        lineUserId: lineProfile.userId,
        displayName: finalDisplayName,
        pictureUrl: lineProfile.pictureUrl,
        partySize: partySize || 1,
        phoneNumber: phoneNumber || '',
        status: 'waiting',
        createdAt: FieldValue.serverTimestamp(),
      })

      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('LINE 인증 실패', errorMessage)
      throw new functions.https.HttpsError('internal', 'LINE認証に失敗しました。')
    }
  })

export const sendCallNotification = functions
  .runWith(runtimeOptsWithSecrets)
  .https.onCall(async (data) => {
    if (!data || !data.storeId || !data.customerId) {
      logger.error('필수 파라미터 누락 (storeId 또는 customerId):', { data })
      throw new functions.https.HttpsError('invalid-argument', 'storeId와 customerId는 필수입니다.')
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
        throw new functions.https.HttpsError('failed-precondition', '고객의 LINE ID가 없습니다.')
      }

      const messageText = `【${storeData.name}】
🚨お呼び出しの連絡
大変お待たせいたしました。
只今、お客様のお順番になりましたので、店舗の前までお越しください。

📍店鋪位置
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

      await customerDoc.ref.update({ status: 'called' })
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
