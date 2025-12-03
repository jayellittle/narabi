/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
const status = ref('initial');
const errorMessage = ref('');
const route = useRoute();
const router = useRouter();
// query parameter에서 storeId 읽기
const currentStoreId = ref(route.query.store || '');
const loginWithLine = () => {
    localStorage.setItem('storeIdForLogin', currentStoreId.value);
    const LINE_LOGIN_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID;
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const REDIRECT_URI = `${baseUrl}/wait`;
    const STATE = '12345abcde'; // 任意値
    const lineLoginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    lineLoginUrl.searchParams.set('response_type', 'code');
    lineLoginUrl.searchParams.set('client_id', LINE_LOGIN_CHANNEL_ID);
    lineLoginUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    lineLoginUrl.searchParams.set('state', STATE);
    lineLoginUrl.searchParams.set('scope', 'profile openid');
    window.location.href = lineLoginUrl.toString();
};
const goBack = () => {
    router.replace({ path: '/wait', query: { store: currentStoreId.value } });
    status.value = 'initial';
};
onMounted(async () => {
    const code = new URL(window.location.href).searchParams.get('code');
    // CASE 1: LINEから戻ってきた場合 (code有り・localStorageにstoreIdを保持中)
    const savedStoreId = localStorage.getItem('storeIdForLogin');
    if (code && savedStoreId) {
        localStorage.removeItem('storeIdForLogin');
        status.value = 'loading';
        try {
            const functions = getFunctions();
            const registerWaitlist = httpsCallable(functions, 'registerWaitlist');
            const result = await registerWaitlist({ code: code, storeId: savedStoreId });
            if (result.data.success) {
                status.value = 'success';
            }
            else {
                throw new Error('Registration failed.');
            }
        }
        catch (error) {
            console.error('등록 처리 중 에러:', error);
            errorMessage.value = '登録中に問題が発生しました。もう一度お試しください。';
            status.value = 'error';
        }
    }
    // CASE 2: QRコードで初めて接続した場合 (code無し・URLにstoreIdが有り)
    else if (route.query.store) {
        currentStoreId.value = route.query.store;
    }
    // CASE 3: 不正なアクセスの場合
    else {
        errorMessage.value = '不正なアクセスです。もう一度QRコードをスキャンしてください。';
        status.value = 'error';
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['line-login-button']} */ ;
/** @type {__VLS_StyleScopedClasses['line-login-button']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "waiting-container" },
});
if (__VLS_ctx.status === 'loading') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
else if (__VLS_ctx.status === 'success') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
else if (__VLS_ctx.status === 'error') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.errorMessage);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.goBack) },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loginWithLine) },
        ...{ class: "line-login-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: "/line-icon.png",
        alt: "LINE Icon",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({});
}
/** @type {__VLS_StyleScopedClasses['waiting-container']} */ ;
/** @type {__VLS_StyleScopedClasses['line-login-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            status: status,
            errorMessage: errorMessage,
            loginWithLine: loginWithLine,
            goBack: goBack,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
