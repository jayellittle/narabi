/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFirebase, useTimeFormat } from '../composables/useFirebase';
const route = useRoute();
const router = useRouter();
const { subscribeToWaitingList, callCustomer, cancelWaiting, completeEntry, registerManualCustomer, } = useFirebase();
const { formatTimestamp } = useTimeFormat();
const storeId = ref(route.params.storeId);
const waitingList = ref([]);
const isLoading = ref(true);
const error = ref('');
const processingCustomerId = ref(null);
const showManualRegistrationModal = ref(false);
const manualRegistrationForm = ref({
    displayName: '',
    partySize: 1,
    phoneNumber: '',
});
const isSubmittingManualRegistration = ref(false);
let unsubscribe = null;
// 상태별 필터링
const statusFilter = ref('all');
const filteredList = computed(() => {
    if (statusFilter.value === 'all') {
        return waitingList.value;
    }
    return waitingList.value.filter((customer) => customer.status === statusFilter.value);
});
// 통계
const stats = computed(() => {
    return {
        total: waitingList.value.length,
        waiting: waitingList.value.filter((c) => c.status === 'waiting').length,
        called: waitingList.value.filter((c) => c.status === 'called').length,
    };
});
// 상태 라벨
const getStatusLabel = (status) => {
    const labels = {
        waiting: '待機中',
        called: '呼出済',
        cancelled: '取消',
        completed: '完了',
    };
    return labels[status] || status;
};
// 상태 색상 클래스
const getStatusClass = (status) => {
    return `status-${status}`;
};
// 고객 호출
const handleCallCustomer = async (customer) => {
    if (processingCustomerId.value)
        return;
    const confirm = window.confirm(`${customer.displayName}様を呼び出しますか？\nLINEメッセージが送信されます。`);
    if (!confirm)
        return;
    processingCustomerId.value = customer.id;
    try {
        await callCustomer(storeId.value, customer.id);
        // 성공 메시지는 표시하지 않음 (실시간으로 상태 업데이트됨)
    }
    catch (err) {
        console.error('호출 실패:', err);
        const message = err instanceof Error ? err.message : '呼び出しに失敗しました。';
        alert(message);
    }
    finally {
        processingCustomerId.value = null;
    }
};
// 입장 완료
const handleCompleteEntry = async (customer) => {
    if (processingCustomerId.value)
        return;
    const confirm = window.confirm(`${customer.displayName}様の入店を完了しますか？`);
    if (!confirm)
        return;
    processingCustomerId.value = customer.id;
    try {
        await completeEntry(storeId.value, customer.id);
    }
    catch (err) {
        console.error('완료 처리 실패:', err);
        const message = err instanceof Error ? err.message : '完了処理に失敗しました。';
        alert(message);
    }
    finally {
        processingCustomerId.value = null;
    }
};
// 취소
const handleCancelWaiting = async (customer) => {
    if (processingCustomerId.value)
        return;
    const confirm = window.confirm(`${customer.displayName}様の待機をキャンセルしますか？`);
    if (!confirm)
        return;
    processingCustomerId.value = customer.id;
    try {
        await cancelWaiting(storeId.value, customer.id);
    }
    catch (err) {
        console.error('취소 실패:', err);
        const message = err instanceof Error ? err.message : 'キャンセルに失敗しました。';
        alert(message);
    }
    finally {
        processingCustomerId.value = null;
    }
};
// 이력 페이지로 이동
const goToCompletedHistory = () => {
    router.push(`/store/${storeId.value}/completed-history`);
};
const goToCancelledHistory = () => {
    router.push(`/store/${storeId.value}/cancelled-history`);
};
// 수동 등록 모달 열기/닫기
const openManualRegistrationModal = () => {
    showManualRegistrationModal.value = true;
    // 폼 초기화
    manualRegistrationForm.value = {
        displayName: '',
        partySize: 1,
        phoneNumber: '',
    };
};
const closeManualRegistrationModal = () => {
    showManualRegistrationModal.value = false;
};
// 수동 고객 등록
const handleManualRegistration = async () => {
    const { displayName, partySize, phoneNumber } = manualRegistrationForm.value;
    if (!displayName.trim()) {
        alert('お客様のお名前を入力してください。');
        return;
    }
    if (partySize < 1) {
        alert('人数は1人以上を入力してください。');
        return;
    }
    if (!phoneNumber.trim()) {
        alert('電話番号を入力してください。');
        return;
    }
    const confirm = window.confirm(`以下の内容で登録しますか？\n\nお名前: ${displayName}\n人数: ${partySize}名\n電話番号: ${phoneNumber}`);
    if (!confirm)
        return;
    isSubmittingManualRegistration.value = true;
    try {
        await registerManualCustomer(storeId.value, {
            displayName: displayName.trim(),
            partySize,
            phoneNumber: phoneNumber.trim(),
        });
        closeManualRegistrationModal();
        alert('お客様を登録しました。');
    }
    catch (err) {
        console.error('수동 등록 실패:', err);
        const message = err instanceof Error ? err.message : 'お客様の登録に失敗しました。';
        alert(message);
    }
    finally {
        isSubmittingManualRegistration.value = false;
    }
};
// 데이터 로드
const loadData = () => {
    isLoading.value = true;
    error.value = '';
    try {
        unsubscribe = subscribeToWaitingList(storeId.value, (customers) => {
            waitingList.value = customers;
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
/** @type {__VLS_StyleScopedClasses['history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['completed-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancelled-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['manual-registration-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['no-customers']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-card']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['complete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-modal-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-modal-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-modal-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "waiting-list-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "action-buttons" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.goToCompletedHistory) },
    ...{ class: "history-btn completed-btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.goToCancelledHistory) },
    ...{ class: "history-btn cancelled-btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.openManualRegistrationModal) },
    ...{ class: "manual-registration-btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stats" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-card total" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats.total);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-card waiting" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats.waiting);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-card called" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.stats.called);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stat-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "filters" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.statusFilter = 'all';
        } },
    ...{ class: ({ active: __VLS_ctx.statusFilter === 'all' }) },
});
(__VLS_ctx.stats.total);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.statusFilter = 'waiting';
        } },
    ...{ class: ({ active: __VLS_ctx.statusFilter === 'waiting' }) },
});
(__VLS_ctx.stats.waiting);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.statusFilter = 'called';
        } },
    ...{ class: ({ active: __VLS_ctx.statusFilter === 'called' }) },
});
(__VLS_ctx.stats.called);
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
else if (__VLS_ctx.filteredList.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "no-customers" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "no-customers-icon" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "customer-list" },
    });
    for (const [customer] of __VLS_getVForSourceType((__VLS_ctx.filteredList))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (customer.id),
            ...{ class: "customer-card" },
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
            ...{ class: "customer-actions mobile-actions" },
        });
        if (customer.isManualRegistration) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!(customer.isManualRegistration))
                            return;
                        __VLS_ctx.handleCompleteEntry(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn complete-btn" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!(customer.isManualRegistration))
                            return;
                        __VLS_ctx.handleCancelWaiting(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn cancel-btn" },
            });
        }
        else if (customer.status === 'waiting') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!(customer.status === 'waiting'))
                            return;
                        __VLS_ctx.handleCallCustomer(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn call-btn" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!(customer.status === 'waiting'))
                            return;
                        __VLS_ctx.handleCancelWaiting(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn cancel-btn" },
            });
        }
        else if (customer.status === 'called') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!!(customer.status === 'waiting'))
                            return;
                        if (!(customer.status === 'called'))
                            return;
                        __VLS_ctx.handleCompleteEntry(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn complete-btn" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!!(customer.status === 'waiting'))
                            return;
                        if (!(customer.status === 'called'))
                            return;
                        __VLS_ctx.handleCancelWaiting(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn cancel-btn" },
            });
        }
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: (['status-badge', __VLS_ctx.getStatusClass(customer.status)]) },
        });
        (__VLS_ctx.getStatusLabel(customer.status));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "customer-time-status" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "customer-time" },
        });
        (__VLS_ctx.formatTimestamp(customer.createdAt));
        if (customer.calledAt) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "customer-time" },
            });
            (__VLS_ctx.formatTimestamp(customer.calledAt));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "customer-actions desktop-actions" },
        });
        if (customer.isManualRegistration) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!(customer.isManualRegistration))
                            return;
                        __VLS_ctx.handleCompleteEntry(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn complete-btn" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!(customer.isManualRegistration))
                            return;
                        __VLS_ctx.handleCancelWaiting(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn cancel-btn" },
            });
        }
        else if (customer.status === 'waiting') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!(customer.status === 'waiting'))
                            return;
                        __VLS_ctx.handleCallCustomer(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn call-btn" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!(customer.status === 'waiting'))
                            return;
                        __VLS_ctx.handleCancelWaiting(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn cancel-btn" },
            });
        }
        else if (customer.status === 'called') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!!(customer.status === 'waiting'))
                            return;
                        if (!(customer.status === 'called'))
                            return;
                        __VLS_ctx.handleCompleteEntry(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn complete-btn" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.error))
                            return;
                        if (!!(__VLS_ctx.filteredList.length === 0))
                            return;
                        if (!!(customer.isManualRegistration))
                            return;
                        if (!!(customer.status === 'waiting'))
                            return;
                        if (!(customer.status === 'called'))
                            return;
                        __VLS_ctx.handleCancelWaiting(customer);
                    } },
                disabled: (__VLS_ctx.processingCustomerId === customer.id),
                ...{ class: "action-btn cancel-btn" },
            });
        }
    }
}
if (__VLS_ctx.showManualRegistrationModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.closeManualRegistrationModal) },
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.handleManualRegistration) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "displayName",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "displayName",
        value: (__VLS_ctx.manualRegistrationForm.displayName),
        type: "text",
        placeholder: "お客様のお名前",
        required: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "partySize",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "partySize",
        type: "number",
        min: "1",
        placeholder: "人数",
        required: true,
    });
    (__VLS_ctx.manualRegistrationForm.partySize);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "phoneNumber",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "phoneNumber",
        type: "tel",
        placeholder: "電話番号",
        required: true,
    });
    (__VLS_ctx.manualRegistrationForm.phoneNumber);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeManualRegistrationModal) },
        type: "button",
        ...{ class: "cancel-modal-btn" },
        disabled: (__VLS_ctx.isSubmittingManualRegistration),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        ...{ class: "submit-btn" },
        disabled: (__VLS_ctx.isSubmittingManualRegistration),
    });
    (__VLS_ctx.isSubmittingManualRegistration ? '登録中...' : '登録');
}
/** @type {__VLS_StyleScopedClasses['waiting-list-container']} */ ;
/** @type {__VLS_StyleScopedClasses['header']} */ ;
/** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['completed-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancelled-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['manual-registration-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['stats']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['total']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['waiting']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['called']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['no-customers']} */ ;
/** @type {__VLS_StyleScopedClasses['no-customers-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-list']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-card']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-number']} */ ;
/** @type {__VLS_StyleScopedClasses['number']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['complete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['complete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-info']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-avatar-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-details']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-name-row']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-name']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-time-status']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-time']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-time']} */ ;
/** @type {__VLS_StyleScopedClasses['customer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['desktop-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['complete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['complete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-modal-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formatTimestamp: formatTimestamp,
            isLoading: isLoading,
            error: error,
            processingCustomerId: processingCustomerId,
            showManualRegistrationModal: showManualRegistrationModal,
            manualRegistrationForm: manualRegistrationForm,
            isSubmittingManualRegistration: isSubmittingManualRegistration,
            statusFilter: statusFilter,
            filteredList: filteredList,
            stats: stats,
            getStatusLabel: getStatusLabel,
            getStatusClass: getStatusClass,
            handleCallCustomer: handleCallCustomer,
            handleCompleteEntry: handleCompleteEntry,
            handleCancelWaiting: handleCancelWaiting,
            goToCompletedHistory: goToCompletedHistory,
            goToCancelledHistory: goToCancelledHistory,
            openManualRegistrationModal: openManualRegistrationModal,
            closeManualRegistrationModal: closeManualRegistrationModal,
            handleManualRegistration: handleManualRegistration,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
