import { vi } from 'vitest'

// src/firebase.ts 모듈 전체를 가짜로 대체
vi.mock('../firebase', () => {
  return {
    // 필요한 객체들을 빈 껍데기로 만듭니다.
    auth: {},
    db: {},
    storage: {},
    functions: {},
    analytics: {},
    // 만약 앱에서 특정 함수를 쓴다면 여기 추가해야 함 (예: getAuth 등)
  }
})

// 혹시 '@/' 경로 별칭을 쓴다면 이것도 추가
vi.mock('@/firebase', () => {
  return {
    auth: {},
    db: {},
    storage: {},
    functions: {},
    analytics: {},
  }
})
