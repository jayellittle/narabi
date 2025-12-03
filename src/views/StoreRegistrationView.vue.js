/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, query, where, serverTimestamp, updateDoc, } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
const router = useRouter();
const db = getFirestore();
const auth = getAuth();
const storage = getStorage();
// 모드: 기존 매장 등록 vs 새 매장 생성
const mode = ref('new');
const stores = ref([]);
const storeSearch = ref('');
const isLoadingStores = ref(false);
// 새 매장 정보
const newStore = ref({
    storeName: '',
    address: '',
    phoneNumber: '',
    googleMapsUrl: '',
});
const requestMessage = ref('');
const displayName = ref('');
// 이미지 업로드
const storeImageFile = ref(null);
const storeImagePreview = ref(null);
// 제출 상태
const isSubmitting = ref(false);
const errorMessage = ref('');
// 리퀘스트 모달
const showRequestModal = ref(false);
const selectedStoreId = ref('');
const selectedStoreName = ref('');
// 검색된 매장 목록
const filteredStores = computed(() => {
    if (!storeSearch.value.trim())
        return [];
    const search = storeSearch.value.toLowerCase();
    return stores.value.filter((store) => store.name.toLowerCase().includes(search) || store.address.toLowerCase().includes(search));
});
// 매장 목록 로드
const loadStores = async () => {
    isLoadingStores.value = true;
    try {
        const user = auth.currentUser;
        if (!user) {
            return;
        }
        const q = query(collection(db, 'stores'), where('status', '==', 'approved'));
        const snapshot = await getDocs(q);
        // 현재 사용자의 모든 pending 요청 조회
        const pendingRequestsQuery = query(collection(db, 'storeJoinRequests'), where('userId', '==', user.uid), where('status', '==', 'pending'));
        const pendingRequestsSnapshot = await getDocs(pendingRequestsQuery);
        const pendingStoreIds = new Set(pendingRequestsSnapshot.docs.map((doc) => doc.data().storeId));
        stores.value = snapshot.docs.map((doc) => {
            const data = doc.data();
            const staffList = data.staffList || [];
            // 이미 스태프 목록에 active 상태로 등록되어 있는지 확인
            const isAlreadyMember = staffList.some((staff) => staff.email === user.email && staff.status === 'active');
            return {
                id: doc.id,
                ...data,
                hasPendingRequest: pendingStoreIds.has(doc.id),
                isAlreadyMember,
            };
        });
    }
    catch (error) {
        console.error('매장 목록 로드 실패:', error);
        errorMessage.value = '店舗リストの読み込みに失敗しました。';
    }
    finally {
        isLoadingStores.value = false;
    }
};
// 모달 열기
const openRequestModal = (storeId, storeName) => {
    selectedStoreId.value = storeId;
    selectedStoreName.value = storeName;
    displayName.value = '';
    requestMessage.value = '';
    showRequestModal.value = true;
};
// 모달 닫기
const closeRequestModal = () => {
    showRequestModal.value = false;
    selectedStoreId.value = '';
    selectedStoreName.value = '';
    displayName.value = '';
    requestMessage.value = '';
};
// 이미지 선택
const handleImageSelect = (event) => {
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください。');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            // 5MB 제한
            alert('ファイルサイズは5MB以下にしてください。');
            return;
        }
        storeImageFile.value = file;
        // 미리보기 생성
        const reader = new FileReader();
        reader.onload = (e) => {
            storeImagePreview.value = e.target?.result;
        };
        reader.readAsDataURL(file);
    }
};
// 이미지 제거
const removeImage = () => {
    storeImageFile.value = null;
    storeImagePreview.value = null;
};
// 이미지 업로드 함수
const uploadStoreImage = async (storeId) => {
    if (!storeImageFile.value)
        return null;
    try {
        const fileName = `stores/${storeId}/${Date.now()}_${storeImageFile.value.name}`;
        const imageRef = storageRef(storage, fileName);
        await uploadBytes(imageRef, storeImageFile.value);
        const downloadURL = await getDownloadURL(imageRef);
        return downloadURL;
    }
    catch (error) {
        console.error('画像アップロード失敗:', error);
        return null;
    }
};
// 기존 매장 참여 요청 제출
const submitJoinRequest = async () => {
    if (!displayName.value.trim()) {
        alert('表示名を入力してください。');
        return;
    }
    const user = auth.currentUser;
    if (!user) {
        alert('ログインが必要です。');
        router.push('/login');
        return;
    }
    isSubmitting.value = true;
    errorMessage.value = '';
    try {
        const storeId = selectedStoreId.value;
        // 1. 이미 스태프로 등록되어 있는지 확인
        const storeRef = doc(db, 'stores', storeId);
        const storeDoc = await getDoc(storeRef);
        if (storeDoc.exists()) {
            const staffList = storeDoc.data().staffList || [];
            const isAlreadyStaff = staffList.some((staff) => staff.email === user.email && staff.status === 'active');
            if (isAlreadyStaff) {
                alert('既にこの店舗のスタッフとして登録されています。');
                closeRequestModal();
                router.push('/dashboard');
                return;
            }
            const isPending = staffList.some((staff) => staff.email === user.email && staff.status === 'pending');
            if (isPending) {
                alert('既に招待を受けています。スタッフ管理ページで承認してください。');
                closeRequestModal();
                router.push('/dashboard');
                return;
            }
        }
        // 2. 기존 리퀘스트 확인 (pending + rejected 모두)
        const existingRequestQuery = query(collection(db, 'storeJoinRequests'), where('storeId', '==', storeId), where('userId', '==', user.uid));
        const existingRequests = await getDocs(existingRequestQuery);
        // pending 리퀘스트가 있는지 확인
        const pendingRequest = existingRequests.docs.find((doc) => doc.data().status === 'pending');
        if (pendingRequest) {
            alert('既に参加リクエストを送信しています。承認をお待ちください。');
            closeRequestModal();
            router.push('/dashboard');
            return;
        }
        // rejected 리퀘스트가 있으면 pending으로 업데이트
        const rejectedRequest = existingRequests.docs.find((doc) => doc.data().status === 'rejected');
        if (rejectedRequest) {
            await updateDoc(doc(db, 'storeJoinRequests', rejectedRequest.id), {
                status: 'pending',
                userId: user.uid,
                displayName: displayName.value.trim() || null,
                message: requestMessage.value,
                createdAt: serverTimestamp(),
            });
            alert('参加リクエストを送信しました。承認をお待ちください。');
            closeRequestModal();
            router.push('/dashboard');
            return;
        }
        // 3. 새 리퀘스트 작성
        await addDoc(collection(db, 'storeJoinRequests'), {
            storeId,
            userId: user.uid,
            userEmail: user.email || '',
            displayName: displayName.value.trim() || null,
            message: requestMessage.value,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        alert('参加リクエストを送信しました。承認をお待ちください。');
        closeRequestModal();
        router.push('/dashboard');
    }
    catch (error) {
        console.error('참여 요청 실패:', error);
        const message = error instanceof Error ? error.message : '参加リクエストに失敗しました。';
        errorMessage.value = message;
        // 에러가 발생해도 대시보드로 돌아가지 않고 여기에 남음
        alert(`エラーが発生しました: ${message}`);
    }
    finally {
        isSubmitting.value = false;
    }
};
// 새 매장 등록 신청 (직접 Firestore에 작성)
const handleCreateStore = async () => {
    // 유효성 검사
    if (!newStore.value.storeName || !newStore.value.address || !newStore.value.phoneNumber) {
        errorMessage.value = '店舗名、住所、電話番号は必須です。';
        return;
    }
    const user = auth.currentUser;
    if (!user) {
        alert('ログインが必要です。');
        router.push('/login');
        return;
    }
    isSubmitting.value = true;
    errorMessage.value = '';
    try {
        // ✅ 현재 시간을 Date 객체로
        const now = new Date();
        // Firestore에 직접 작성
        const docRef = await addDoc(collection(db, 'stores'), {
            name: newStore.value.storeName,
            address: newStore.value.address,
            phoneNumber: newStore.value.phoneNumber,
            googleMapsUrl: newStore.value.googleMapsUrl || '',
            status: 'approved',
            approvalRequestMessage: requestMessage.value,
            ownerId: user.uid,
            ownerEmail: user.email || '',
            staffList: [
                {
                    email: user.email || '',
                    userId: user.uid,
                    role: 'owner',
                    status: 'active',
                    invitedAt: now, // ✅ 여기만 변경
                },
            ],
            createdAt: serverTimestamp(),
        });
        // 이미지 업로드 및 URL 저장
        if (storeImageFile.value) {
            const imageUrl = await uploadStoreImage(docRef.id);
            if (imageUrl) {
                await updateDoc(doc(db, 'stores', docRef.id), {
                    imageUrl,
                });
            }
        }
        alert('店舗を作成しました！');
        router.push('/dashboard');
    }
    catch (error) {
        console.error('매장 등록 실패:', error);
        const message = error instanceof Error ? error.message : '店舗登録に失敗しました。';
        errorMessage.value = message;
    }
    finally {
        isSubmitting.value = false;
    }
};
// 탭 변경 시 매장 목록 로드
const handleModeChange = (newMode) => {
    mode.value = newMode;
    errorMessage.value = '';
    if (newMode === 'existing' && stores.value.length === 0) {
        loadStores();
    }
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-info']} */ ;
/** @type {__VLS_StyleScopedClasses['join-button']} */ ;
/** @type {__VLS_StyleScopedClasses['join-button']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['message-box']} */ ;
/** @type {__VLS_StyleScopedClasses['message-box']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['image-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['back-link']} */ ;
/** @type {__VLS_StyleScopedClasses['back-link']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "store-registration-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tabs" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.handleModeChange('existing');
        } },
    ...{ class: ({ active: __VLS_ctx.mode === 'existing' }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.handleModeChange('new');
        } },
    ...{ class: ({ active: __VLS_ctx.mode === 'new' }) },
});
if (__VLS_ctx.errorMessage) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error-message" },
    });
    (__VLS_ctx.errorMessage);
}
if (__VLS_ctx.mode === 'existing') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "existing-store-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "search-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.storeSearch),
        type: "text",
        placeholder: "店舗名検索",
        ...{ class: "search-input" },
    });
    if (__VLS_ctx.isLoadingStores) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "loading" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "store-list" },
        });
        for (const [store] of __VLS_getVForSourceType((__VLS_ctx.filteredStores))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (store.id),
                ...{ class: "store-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-info" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            (store.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "address" },
            });
            (store.address);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "phone" },
            });
            (store.phoneNumber);
            if (store.isAlreadyMember) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "already-member" },
                });
            }
            if (!store.isAlreadyMember) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.mode === 'existing'))
                                return;
                            if (!!(__VLS_ctx.isLoadingStores))
                                return;
                            if (!(!store.isAlreadyMember))
                                return;
                            __VLS_ctx.openRequestModal(store.id, store.name);
                        } },
                    disabled: (store.hasPendingRequest),
                    ...{ class: "join-button" },
                });
                (store.hasPendingRequest ? 'リクエスト済み' : '登録リクエストを送る');
            }
        }
        if (__VLS_ctx.filteredStores.length === 0 && __VLS_ctx.storeSearch.trim()) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "no-results" },
            });
        }
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "new-store-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.handleCreateStore) },
        ...{ class: "store-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "required" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.newStore.storeName),
        type: "text",
        placeholder: "例：タイホーム 大阪店",
        required: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "required" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.newStore.address),
        type: "text",
        placeholder: "例：大阪府大阪市北区梅田1-1-7",
        required: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "required" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "tel",
        placeholder: "例：06-1234-5678",
        required: true,
    });
    (__VLS_ctx.newStore.phoneNumber);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "url",
        placeholder: "https://maps.google.com/...",
    });
    (__VLS_ctx.newStore.googleMapsUrl);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "image-upload-container" },
    });
    if (__VLS_ctx.storeImagePreview) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "image-preview" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.storeImagePreview),
            alt: "店舗画像プレビュー",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.removeImage) },
            type: "button",
            ...{ class: "remove-image-btn" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "image-upload-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: (__VLS_ctx.handleImageSelect) },
            type: "file",
            accept: "image/*",
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "upload-placeholder" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "upload-icon" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        disabled: (__VLS_ctx.isSubmitting),
        ...{ class: "submit-button" },
    });
    (__VLS_ctx.isSubmitting ? '送信中...' : '生成');
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "back-link" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/dashboard",
}));
const __VLS_2 = __VLS_1({
    to: "/dashboard",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
var __VLS_3;
if (__VLS_ctx.showRequestModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.closeRequestModal) },
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "modal-store-name" },
    });
    (__VLS_ctx.selectedStoreName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.submitJoinRequest) },
        ...{ class: "request-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "required" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.displayName),
        type: "text",
        placeholder: "例：山田 太郎",
        required: true,
        autofocus: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "form-hint" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.requestMessage),
        placeholder: "店舗オーナーへのメッセージを入力してください",
        rows: "3",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeRequestModal) },
        type: "button",
        ...{ class: "cancel-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        disabled: (__VLS_ctx.isSubmitting),
        ...{ class: "submit-button" },
    });
    (__VLS_ctx.isSubmitting ? '送信中...' : 'リクエストを送る');
}
/** @type {__VLS_StyleScopedClasses['store-registration-container']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['existing-store-section']} */ ;
/** @type {__VLS_StyleScopedClasses['search-box']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['store-list']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-info']} */ ;
/** @type {__VLS_StyleScopedClasses['address']} */ ;
/** @type {__VLS_StyleScopedClasses['phone']} */ ;
/** @type {__VLS_StyleScopedClasses['already-member']} */ ;
/** @type {__VLS_StyleScopedClasses['join-button']} */ ;
/** @type {__VLS_StyleScopedClasses['no-results']} */ ;
/** @type {__VLS_StyleScopedClasses['new-store-section']} */ ;
/** @type {__VLS_StyleScopedClasses['store-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['image-upload-container']} */ ;
/** @type {__VLS_StyleScopedClasses['image-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['image-upload-label']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['back-link']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-store-name']} */ ;
/** @type {__VLS_StyleScopedClasses['request-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            mode: mode,
            storeSearch: storeSearch,
            isLoadingStores: isLoadingStores,
            newStore: newStore,
            requestMessage: requestMessage,
            displayName: displayName,
            storeImagePreview: storeImagePreview,
            isSubmitting: isSubmitting,
            errorMessage: errorMessage,
            showRequestModal: showRequestModal,
            selectedStoreName: selectedStoreName,
            filteredStores: filteredStores,
            openRequestModal: openRequestModal,
            closeRequestModal: closeRequestModal,
            handleImageSelect: handleImageSelect,
            removeImage: removeImage,
            submitJoinRequest: submitJoinRequest,
            handleCreateStore: handleCreateStore,
            handleModeChange: handleModeChange,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
