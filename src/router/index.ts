import { createRouter, createWebHistory } from 'vue-router'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import DashboardView from '../views/DashboardView.vue'

// 현재 사용자 상태를 비동기적으로 확인하는 헬퍼 함수
const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const removeListener = onAuthStateChanged(
      getAuth(),
      (user) => {
        removeListener() // 리스너 정리
        resolve(user)
      },
      reject,
    )
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard', // 최상위 경로는 대시보드로 리디렉션
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/store/:storeId',
      name: 'storeDetail',
      component: () => import('../views/StoreDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      // 1. QR코드를 통해 처음 접속할 때 사용하는 경로
      path: '/wait/:storeId',
      name: 'waiting',
      component: () => import('../views/WaitingView.vue'),
    },
    {
      // 2. LINE 로그인 후 돌아올 때 사용하는 경로
      path: '/wait',
      name: 'waitingCallback',
      component: () => import('../views/WaitingView.vue'),
    },
  ],
})

// 라우팅 가드 설정 (페이지 이동 직전에 매번 실행됨)
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const user = await getCurrentUser()

  if (requiresAuth && !user) {
    // 로그인이 필요한 페이지에 로그인 없이 접근 시, 로그인 페이지로 강제 이동
    next('/login')
  } else if (to.name === 'login' && user) {
    // 이미 로그인한 상태에서 로그인 페이지 접근 시, 대시보드로 강제 이동
    next('/dashboard')
  } else {
    // 그 외의 경우는 정상적으로 이동 허용
    next()
  }
})

export default router
