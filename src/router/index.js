// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import { getAuth } from 'firebase/auth';
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            redirect: '/dashboard',
        },
        {
            path: '/login',
            name: 'Login',
            component: () => import('../views/LoginView.vue'),
        },
        {
            path: '/wait',
            name: 'Wait',
            component: () => import('../views/WaitingView.vue'),
        },
        {
            path: '/register-store',
            name: 'StoreRegistration',
            component: () => import('../views/StoreRegistrationView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/dashboard',
            name: 'Dashboard',
            component: () => import('../views/DashboardView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/store/:storeId',
            name: 'StoreDetail',
            component: () => import('../views/StoreDetailView.vue'),
            meta: { requiresAuth: true },
            children: [
                {
                    path: '',
                    name: 'StoreManagementMenu',
                    component: () => import('../views/StoreManagementMenuView.vue'),
                    meta: { requiresAuth: true },
                },
                {
                    path: 'qr',
                    name: 'QRCode',
                    component: () => import('../views/QRCodeView.vue'),
                    meta: { requiresAuth: true },
                },
                {
                    path: 'waiting',
                    name: 'WaitingList',
                    component: () => import('../views/WaitingListManagementView.vue'),
                    meta: { requiresAuth: true },
                },
                {
                    path: 'staff',
                    name: 'Staff',
                    component: () => import('../views/StaffManagementView.vue'),
                    meta: { requiresAuth: true },
                },
                {
                    path: 'completed-history',
                    name: 'CompletedHistory',
                    component: () => import('../views/CompletedHistoryView.vue'),
                    meta: { requiresAuth: true },
                },
                {
                    path: 'cancelled-history',
                    name: 'CancelledHistory',
                    component: () => import('../views/CancelledHistoryView.vue'),
                    meta: { requiresAuth: true },
                },
            ],
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/dashboard',
        },
    ],
});
// 네비게이션 가드: 인증 필요한 라우트 보호
router.beforeEach(async (to, from, next) => {
    const auth = getAuth();
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
    if (requiresAuth) {
        // 인증 상태 확인
        const user = await new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
        });
        if (!user) {
            // 로그인되지 않은 경우 로그인 페이지로
            next({
                path: '/login',
                query: { redirect: to.fullPath },
            });
        }
        else {
            next();
        }
    }
    else {
        next();
    }
});
export default router;
