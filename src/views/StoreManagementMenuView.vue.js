/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
const route = useRoute();
const storeId = route.params.storeId;
const db = getFirestore();
// 대기 중인 고객 수
const waitingCount = ref(0);
let unsubscribe = null;
// 대기 목록 실시간 구독
onMounted(() => {
    const q = query(collection(db, `stores/${storeId}/waitingList`), where('status', '==', 'waiting'));
    unsubscribe = onSnapshot(q, (snapshot) => {
        waitingCount.value = snapshot.size;
    });
});
// 컴포넌트 언마운트 시 구독 해제
onUnmounted(() => {
    if (unsubscribe) {
        unsubscribe();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['welcome-section']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['qr']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['waiting']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['staff']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-arrow']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "management-menu-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "welcome-section" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "subtitle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-grid" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: (`/store/${__VLS_ctx.storeId}/qr`),
    ...{ class: "menu-card qr" },
}));
const __VLS_2 = __VLS_1({
    to: (`/store/${__VLS_ctx.storeId}/qr`),
    ...{ class: "menu-card qr" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "menu-description" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-arrow" },
});
var __VLS_3;
const __VLS_4 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    to: (`/store/${__VLS_ctx.storeId}/waiting`),
    ...{ class: "menu-card waiting" },
}));
const __VLS_6 = __VLS_5({
    to: (`/store/${__VLS_ctx.storeId}/waiting`),
    ...{ class: "menu-card waiting" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-title-with-badge" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
if (__VLS_ctx.waitingCount > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "waiting-badge" },
    });
    (__VLS_ctx.waitingCount);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "menu-description" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-arrow" },
});
var __VLS_7;
const __VLS_8 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    to: (`/store/${__VLS_ctx.storeId}/staff`),
    ...{ class: "menu-card staff" },
}));
const __VLS_10 = __VLS_9({
    to: (`/store/${__VLS_ctx.storeId}/staff`),
    ...{ class: "menu-card staff" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-icon" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "menu-description" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "menu-arrow" },
});
var __VLS_11;
/** @type {__VLS_StyleScopedClasses['management-menu-container']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-section']} */ ;
/** @type {__VLS_StyleScopedClasses['subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['qr']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-description']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['waiting']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-title-with-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['waiting-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-description']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-card']} */ ;
/** @type {__VLS_StyleScopedClasses['staff']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-description']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-arrow']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            storeId: storeId,
            waitingCount: waitingCount,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
