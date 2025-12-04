import type { Timestamp } from 'firebase/firestore'

export interface Store {
  id: string
  name: string
  address: string
  phoneNumber: string
  googleMapsUrl?: string
  imageUrl?: string
  status: 'pending' | 'approved' | 'rejected'
  ownerId: string
  ownerEmail: string
  staffList: StaffMember[]
  qrCodeUrl?: string
  approvalRequestMessage?: string
  createdAt: Timestamp | Date | { seconds: number; nanoseconds: number }
  approvedAt?: Timestamp | Date | { seconds: number; nanoseconds: number }
}

export interface StaffMember {
  email: string
  userId?: string
  role: 'owner' | 'staff'
  status: 'pending' | 'active' | 'rejected'
  invitedAt: Timestamp | Date | { seconds: number; nanoseconds: number }
  displayName?: string
  staffImageUrl?: string
  userDisplayName?: string
  userPhotoURL?: string
}

export interface WaitingCustomer {
  id: string
  lineUserId?: string // 수동 등록 시에는 없을 수 있음
  displayName: string
  pictureUrl?: string
  phoneNumber?: string // 수동 등록 시 전화번호
  partySize?: number // 수동 등록 시 고객 수
  isManualRegistration?: boolean // 수동 등록 여부
  status: 'waiting' | 'called' | 'cancelled' | 'completed'
  queueNumber: number
  createdAt: Timestamp | Date | { seconds: number; nanoseconds: number }
  calledAt?: Timestamp | Date | { seconds: number; nanoseconds: number }
  cancelledAt?: Timestamp | Date | { seconds: number; nanoseconds: number }
  completedAt?: Timestamp | Date | { seconds: number; nanoseconds: number }
}

export interface StoreJoinRequest {
  id: string
  storeId: string
  userId: string
  userEmail: string
  displayName?: string
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Timestamp | Date | { seconds: number; nanoseconds: number }
}

export interface EstimatedWaitTime {
  estimatedWaitTime: number
  peopleAhead: number
  avgProcessingTime: number
}
