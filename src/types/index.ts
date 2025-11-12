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
  createdAt: any
  approvedAt?: any
}

export interface StaffMember {
  email: string
  userId?: string
  role: 'owner' | 'staff'
  status: 'pending' | 'active' | 'rejected'
  invitedAt: any
  displayName?: string
}

export interface WaitingCustomer {
  id: string
  lineUserId: string
  displayName: string
  pictureUrl?: string
  status: 'waiting' | 'called' | 'cancelled' | 'completed'
  queueNumber: number
  createdAt: any
  calledAt?: any
  cancelledAt?: any
  completedAt?: any
}

export interface StoreJoinRequest {
  id: string
  storeId: string
  userId: string
  userEmail: string
  displayName?: string
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: any
}

export interface EstimatedWaitTime {
  estimatedWaitTime: number
  peopleAhead: number
  avgProcessingTime: number
}
