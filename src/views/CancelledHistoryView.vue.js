/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFirebase, useTimeFormat } from '../composables/useFirebase';
import { Timestamp } from 'firebase/firestore';
const route = useRoute();
const router = useRouter();
const { subscribeToCancelledHistory } = useFirebase();
const { formatTimestamp } = useTimeFormat();
const storeId = ref(route.params.storeId);
const cancelledList = ref([]);
const isLoading = ref(true);
const error = ref('');
let unsubscribe = null;
// 뒤로가기
const goBack = () => {
    router.push(`/store/${storeId.value}/waiting`);
};
// 대기 시간 계산 (분 단위)
// 대기 시간 계산 (분 단위)
const calculateWaitingTime = (customer) => {
    if (!customer.createdAt || !customer.cancelledAt)
        return '-';
    let createdDate;
    if (customer.createdAt instanceof Timestamp) {
        createdDate = customer.createdAt.toDate();
    }
    else if (customer.createdAt instanceof Date) {
        createdDate = customer.createdAt;
    }
    else if (typeof customer.createdAt === 'object' &&
        'seconds' in customer.createdAt &&
        'nanoseconds' in customer.createdAt) {
        createdDate = new Timestamp(customer.createdAt.seconds, customer.createdAt.nanoseconds).toDate();
    }
    else {
        createdDate = new Date(customer.createdAt);
    }
    let cancelledDate;
    if (customer.cancelledAt instanceof Timestamp) {
        cancelledDate = customer.cancelledAt.toDate();
    }
    else if (customer.cancelledAt instanceof Date) {
        cancelledDate = customer.cancelledAt;
    }
    else if (typeof customer.cancelledAt === 'object' &&
        'seconds' in customer.cancelledAt &&
        'nanoseconds' in customer.cancelledAt) {
        cancelledDate = new Timestamp(customer.cancelledAt.seconds, customer.cancelledAt.nanoseconds).toDate();
    }
    else {
        cancelledDate = new Date(customer.cancelledAt);
    }
    const diffMinutes = Math.floor((cancelledDate.getTime() - createdDate.getTime()) / 1000 / 60);
    if (diffMinutes < 60)
        return `${diffMinutes}分`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
};
// 데이터 로드
const loadData = () => {
    isLoading.value = true;
    error.value = '';
    try {
        unsubscribe = subscribeToCancelledHistory(storeId.value, (customers) => {
            cancelledList.value = customers;
            isLoading.value = false;
        });
    }
    catch (err) {
        console.error('데이터 로드 실패:', err);
        error.value = 'データの読み込みに失敗しました。';
        isLoading.value = false;
    }
};
onMounted(() => {
    loadData();
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
        if (unsubscribe)
            unsubscribe();
    };
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['no-history']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "history-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.goBack) },
    ...{ class: "back-btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
if (__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading" },
    });
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error" },
    });
    (__VLS_ctx.error);
}
else if (__VLS_ctx.cancelledList.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "no-history" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "no-history-icon" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "history-list" },
    });
    for (const [customer] of __VLS_getVForSourceType((__VLS_ctx.cancelledList))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (customer.id),
            ...{ class: "history-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "queue-number" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "number" },
        });
        (customer.queueNumber);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "customer-info" },
        });
        if (customer.pictureUrl) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                src: (customer.pictureUrl),
                alt: (customer.displayName),
                ...{ class: "customer-avatar" },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "customer-avatar-placeholder" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "customer-details" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "customer-name-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
            ...{ class: "customer-name" },
        });
        (customer.displayName);
        if (customer.isManualRegistration) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "manual-badge" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "customer-info-details" },
        });
        if (customer.partySize) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "info-text" },
            });
            (customer.partySize);
        }
        if (customer.phoneNumber) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "info-text" },
            });
            (customer.phoneNumber);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "customer-time-status" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "customer-time" },
        });
        (__VLS_ctx.formatTimestamp(customer.createdAt));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "customer-time" },
        });
        (__VLS_ctx.formatTimestamp(customer.cancelledAt));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "waiting-time" },
        });
        (__VLS_ctx.calculateWaitingTime(customer));
    }
}
/** @type {__VLS_StyleScopedClasses['history-container']} */ ;
/** @type {__VLS_StyleScopedClasses['header']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['no-history']} */ ;
/** @type {__VLS_StyleScopedClasses['no-history-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['history-list']} */ ;
/** @type {__VLS_StyleScopedClasses['history-card']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
/** @type {__VLS_StyleScopedClasses['number']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-info']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-avatar-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-details']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-name-row']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-name']} */ ;
/** @type {__VLS_StyleScopedClasses['manual-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-info-details']} */ ;
/** @type {__VLS_StyleScopedClasses['info-text']} */ ;
/** @type {__VLS_StyleScopedClasses['info-text']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-time-status']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-time']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-time']} */ ;
/** @type {__VLS_StyleScopedClasses['waiting-time']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formatTimestamp: formatTimestamp,
            cancelledList: cancelledList,
            isLoading: isLoading,
            error: error,
            goBack: goBack,
            calculateWaitingTime: calculateWaitingTime,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
