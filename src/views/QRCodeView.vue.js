/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import QrcodeVue from 'qrcode.vue';
import { useFirebase } from '../composables/useFirebase';
const route = useRoute();
const { subscribeToWaitingList, generateQRCode, getStore } = useFirebase();
const storeId = ref(route.params.storeId);
const storeName = ref('');
const qrCodeUrl = ref('');
const waitingList = ref([]);
const isLoading = ref(true);
const error = ref('');
let unsubscribe = null;
// 매장 정보 및 대기열 로드
const loadData = async () => {
    isLoading.value = true;
    error.value = '';
    try {
        // 매장 정보 가져오기
        const store = await getStore(storeId.value);
        if (store) {
            storeName.value = store.name;
        }
        // QR 코드 URL 생성
        const baseUrl = window.location.origin;
        qrCodeUrl.value = `${baseUrl}/wait?store=${storeId.value}`;
        // 백엔드에도 QR URL 저장
        await generateQRCode(storeId.value);
        // 대기열 실시간 구독
        unsubscribe = subscribeToWaitingList(storeId.value, (customers) => {
            waitingList.value = customers;
        });
    }
    catch (err) {
        console.error('데이터 로드 실패:', err);
        error.value = 'データの読み込みに失敗しました。';
    }
    finally {
        isLoading.value = false;
    }
};
// QR 코드 다운로드
const downloadQR = () => {
    // QR 코드 SVG를 캔버스로 변환 후 다운로드
    const qrElement = document.querySelector('.qr-image-wrapper canvas');
    if (qrElement) {
        const link = document.createElement('a');
        link.download = `qr-code-${storeName.value || 'store'}.png`;
        link.href = qrElement.toDataURL('image/png');
        link.click();
    }
};
// QR 코드 인쇄
const printQR = () => {
    const qrElement = document.querySelector('.qr-image-wrapper canvas');
    if (qrElement) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>QRコード - ${storeName.value}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                font-family: sans-serif;
              }
              h1 {
                margin-bottom: 1rem;
              }
              img {
                border: 2px solid #000;
                padding: 1rem;
              }
              p {
                margin-top: 1rem;
                font-size: 1.2rem;
              }
            </style>
          </head>
          <body>
            <h1>${storeName.value}</h1>
            <h2>順番待ちQRコード</h2>
            <img src="${qrElement.toDataURL('image/png')}" alt="QR Code" />
            <p>このQRコードをスキャンして順番待ちリストに登録してください。</p>
          </body>
        </html>
      `);
            printWindow.document.close();
            printWindow.print();
        }
    }
};
onMounted(() => {
    loadData();
});
// 컴포넌트 언마운트 시 구독 해제
watch(() => route.params.storeId, (newId) => {
    if (newId && newId !== storeId.value) {
        if (unsubscribe)
            unsubscribe();
        storeId.value = newId;
        loadData();
    }
});
// 컴포넌트 언마운트
onMounted(() => {
    return () => {
        if (unsubscribe)
            unsubscribe();
    };
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-image-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['download']} */ ;
/** @type {__VLS_StyleScopedClasses['action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['print']} */ ;
/** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['waiting-info']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "qr-code-container" },
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
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "qr-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "qr-display" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "qr-store-name" },
    });
    (__VLS_ctx.storeName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "qr-image-wrapper" },
    });
    /** @type {[typeof QrcodeVue, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(QrcodeVue, new QrcodeVue({
        value: (__VLS_ctx.qrCodeUrl),
        size: (240),
        level: "H",
        renderAs: "canvas",
    }));
    const __VLS_1 = __VLS_0({
        value: (__VLS_ctx.qrCodeUrl),
        size: (240),
        level: "H",
        renderAs: "canvas",
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "qr-instruction" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "waiting-info" },
    });
    const __VLS_3 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(__VLS_3, new __VLS_3({
        to: (`/store/${__VLS_ctx.storeId}/waiting`),
        ...{ class: "info-card" },
    }));
    const __VLS_5 = __VLS_4({
        to: (`/store/${__VLS_ctx.storeId}/waiting`),
        ...{ class: "info-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    __VLS_6.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-icon" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info-value" },
    });
    (__VLS_ctx.waitingList.length);
    var __VLS_6;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "action-buttons" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.downloadQR) },
        ...{ class: "action-button download" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.printQR) },
        ...{ class: "action-button print" },
    });
}
/** @type {__VLS_StyleScopedClasses['qr-code-container']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-content']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-display']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-store-name']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-image-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-instruction']} */ ;
/** @type {__VLS_StyleScopedClasses['waiting-info']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['info-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['info-content']} */ ;
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['download']} */ ;
/** @type {__VLS_StyleScopedClasses['action-button']} */ ;
/** @type {__VLS_StyleScopedClasses['print']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            QrcodeVue: QrcodeVue,
            storeId: storeId,
            storeName: storeName,
            qrCodeUrl: qrCodeUrl,
            waitingList: waitingList,
            isLoading: isLoading,
            error: error,
            downloadQR: downloadQR,
            printQR: printQR,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
