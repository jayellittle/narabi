/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFirebase, useTimeFormat } from '../composables/useFirebase';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, arrayUnion, getDoc, } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
const route = useRoute();
const router = useRouter();
const auth = getAuth();
const db = getFirestore();
const storage = getStorage();
const functions = getFunctions();
const { getStore, inviteStaff, respondToInvitation } = useFirebase();
const { formatTimestamp } = useTimeFormat();
const storeId = ref(route.params.storeId);
const store = ref(null);
const isLoading = ref(true);
const error = ref('');
const joinRequests = ref([]);
// 초대 모달
const showInviteModal = ref(false);
const inviteForm = ref({
    email: '',
    role: 'staff',
});
const isInviting = ref(false);
// 표시명 편집 모달
const showDisplayNameModal = ref(false);
const displayNameForm = ref({
    displayName: '',
});
const staffImageFile = ref(null);
const staffImagePreview = ref(null);
const staffImageToDelete = ref(false);
const isUpdatingDisplayName = ref(false);
// 초대 승인 시 표시명 입력 모달
const showInvitationAcceptModal = ref(false);
const invitationAcceptForm = ref({
    displayName: '',
});
const isAcceptingInvitation = ref(false);
// 현재 사용자 정보
const currentUser = computed(() => auth.currentUser);
const currentUserEmail = computed(() => currentUser.value?.email || '');
// 스태프 필터링
const pendingStaff = computed(() => {
    return store.value?.staffList.filter((s) => s.status === 'pending') || [];
});
const activeStaff = computed(() => {
    return store.value?.staffList.filter((s) => s.status === 'active') || [];
});
// rejectedStaff computed property removed as it was unused
// 대기 중인 참여 요청
const pendingJoinRequests = computed(() => {
    return joinRequests.value.filter((r) => r.status === 'pending');
});
// 현재 사용자가 오너인지 확인
const isOwner = computed(() => {
    return store.value?.ownerId === currentUser.value?.uid;
});
// 현재 사용자가 pending 상태인지 확인
const isCurrentUserPending = computed(() => {
    const myStaffEntry = store.value?.staffList.find((s) => s.email === currentUserEmail.value);
    return myStaffEntry?.status === 'pending';
});
// 현재 사용자가 active 상태인지 확인
const isCurrentUserActive = computed(() => {
    const myStaffEntry = store.value?.staffList.find((s) => s.email === currentUserEmail.value);
    return myStaffEntry?.status === 'active' || isOwner.value;
});
// 오너가 탈퇴 가능한지 확인 (다른 오너가 있는지)
const canOwnerLeave = computed(() => {
    const owners = activeStaff.value.filter((s) => s.role === 'owner');
    return owners.length > 1;
});
// 역할 라벨
const getRoleLabel = (role) => {
    const labels = {
        owner: 'オーナー',
        staff: 'スタッフ',
    };
    return labels[role] || role;
};
// 참여 요청 로드
const loadJoinRequests = async () => {
    try {
        const q = query(collection(db, 'storeJoinRequests'), where('storeId', '==', storeId.value), where('status', '==', 'pending'));
        const snapshot = await getDocs(q);
        joinRequests.value = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    }
    catch (err) {
        console.error('참여 요청 로드 실패:', err);
    }
};
// 매장 정보 로드
const loadStore = async () => {
    isLoading.value = true;
    error.value = '';
    try {
        const storeData = await getStore(storeId.value);
        if (!storeData) {
            error.value = '店舗が見つかりませんでした。';
            return;
        }
        // スタッフリストにユーザー情報を追加
        if (storeData.staffList && storeData.staffList.length > 0) {
            const staffListWithUserInfo = await Promise.all(storeData.staffList.map(async (staff) => {
                // すでに表示名と画像がある場合はそのまま使用
                if (staff.displayName && staff.staffImageUrl) {
                    return staff;
                }
                // users コレクションから情報を取得
                try {
                    const userDoc = await getDoc(doc(db, 'users', staff.userId || staff.email));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        return {
                            ...staff,
                            userDisplayName: userData.displayName || null,
                            userPhotoURL: userData.photoURL || null,
                        };
                    }
                }
                catch (error) {
                    console.error('ユーザー情報の取得に失敗:', error);
                }
                return staff;
            }));
            storeData.staffList = staffListWithUserInfo;
        }
        store.value = storeData;
        // 参여 요청도 함께 로드
        await loadJoinRequests();
    }
    catch (err) {
        console.error('매장 로드 실패:', err);
        error.value = 'データの読み込みに失敗しました。';
    }
    finally {
        isLoading.value = false;
    }
};
// 참여 요청 승인/거절
const handleJoinRequest = async (requestId, approved, userEmail, displayName) => {
    try {
        const requestRef = doc(db, 'storeJoinRequests', requestId);
        const storeRef = doc(db, 'stores', storeId.value);
        if (approved) {
            // 승인: staffList에 추가 (displayName 포함)
            await updateDoc(storeRef, {
                staffList: arrayUnion({
                    email: userEmail,
                    role: 'staff',
                    status: 'active',
                    invitedAt: new Date(),
                    displayName: displayName || null,
                }),
            });
            // 요청 상태를 approved로 업데이트
            await updateDoc(requestRef, {
                status: 'approved',
            });
        }
        else {
            // 거절: 요청 상태만 rejected로 업데이트 (삭제하지 않음)
            await updateDoc(requestRef, {
                status: 'rejected',
            });
        }
        alert(approved ? '参加リクエストを承認しました。' : '参加リクエストを拒否しました。');
        // 데이터 새로고침
        await loadStore();
    }
    catch (err) {
        console.error('참여 요청 처리 실패:', err);
        const message = err instanceof Error ? err.message : 'リクエストの処理に失敗しました。';
        alert(message);
    }
};
// 스태프 초대
const handleInviteStaff = async () => {
    if (!inviteForm.value.email) {
        alert('メールアドレスを入力してください。');
        return;
    }
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.value.email)) {
        alert('有効なメールアドレスを入力してください。');
        return;
    }
    isInviting.value = true;
    try {
        await inviteStaff(storeId.value, inviteForm.value.email, inviteForm.value.role);
        alert('招待を送信しました。');
        // 폼 초기화 및 모달 닫기
        inviteForm.value.email = '';
        inviteForm.value.role = 'staff';
        showInviteModal.value = false;
        // 매장 정보 새로고침
        await loadStore();
    }
    catch (err) {
        console.error('초대 실패:', err);
        // Firebase Functions 에러 메시지 추출
        let errorMessage = '招待に失敗しました。';
        if (typeof err === 'object' && err !== null && 'code' in err) {
            const errorWithCode = err;
            switch (errorWithCode.code) {
                case 'unauthenticated':
                    errorMessage = 'ログインが必要です。';
                    break;
                case 'permission-denied':
                    errorMessage = '権限がありません。オーナーのみスタッフを招待できます。';
                    break;
                case 'not-found':
                    errorMessage = '店舗が見つかりませんでした。';
                    break;
                case 'already-exists':
                    // 이미 초대된 사용자와 이미 소속된 스태프를 구분
                    const staffList = store.value?.staffList || [];
                    const existingStaff = staffList.find((s) => s.email === inviteForm.value.email);
                    if (existingStaff && existingStaff.status === 'active') {
                        errorMessage = 'このメールアドレスは既にこの店舗に所属しています。';
                    }
                    else if (existingStaff && existingStaff.status === 'pending') {
                        errorMessage = '既に招待されたユーザーです。承認をお待ちください。';
                    }
                    else {
                        errorMessage = '既に招待されたユーザーです。';
                    }
                    break;
                case 'invalid-argument':
                    errorMessage = 'メールアドレスが無効です。';
                    break;
                default:
                    errorMessage = errorWithCode.message || '招待に失敗しました。';
            }
        }
        else if (err instanceof Error) {
            errorMessage = err.message;
        }
        alert(errorMessage);
    }
    finally {
        isInviting.value = false;
    }
};
// 초대 취소
const cancelInvite = () => {
    inviteForm.value.email = '';
    inviteForm.value.role = 'staff';
    showInviteModal.value = false;
};
// 스태프 제거
const handleRemoveStaff = async (staffEmail) => {
    if (!confirm(`${staffEmail}をスタッフから削除しますか？`)) {
        return;
    }
    try {
        const storeRef = doc(db, 'stores', storeId.value);
        const storeDoc = await getDoc(storeRef);
        if (storeDoc.exists()) {
            const staffList = storeDoc.data().staffList || [];
            const updatedStaffList = staffList.filter((staff) => staff.email !== staffEmail);
            await updateDoc(storeRef, {
                staffList: updatedStaffList,
            });
            alert('スタッフを削除しました。');
            await loadStore();
        }
    }
    catch (err) {
        console.error('스태프 제거 실패:', err);
        const message = err instanceof Error ? err.message : 'スタッフの削除に失敗しました。';
        alert(message);
    }
};
// 초대 승인 모달 열기
const openInvitationAcceptModal = () => {
    invitationAcceptForm.value.displayName = '';
    showInvitationAcceptModal.value = true;
};
// 초대 승인 처리
const handleAcceptInvitation = async () => {
    isAcceptingInvitation.value = true;
    try {
        const displayNameToSend = invitationAcceptForm.value.displayName.trim() || undefined;
        await respondToInvitation(storeId.value, true, displayNameToSend);
        showInvitationAcceptModal.value = false;
        alert('招待を承認しました。ページを再読み込みします。');
        // Firestoreの更新を確実に反映するため、完全なページリロードを行う
        window.location.href = `/store/${storeId.value}`;
    }
    catch (err) {
        console.error('初대 승인 실패:', err);
        const message = err instanceof Error ? err.message : '招待の承認に失敗しました。';
        alert(message);
    }
    finally {
        isAcceptingInvitation.value = false;
    }
};
// 초대 거절 처리
const handleRejectInvitation = async () => {
    if (!confirm('招待を拒否しますか？')) {
        return;
    }
    try {
        await respondToInvitation(storeId.value, false);
        alert('招待を拒否しました。');
        router.push('/dashboard');
    }
    catch (err) {
        console.error('초대 거절 실패:', err);
        const message = err instanceof Error ? err.message : '招待の拒否に失敗しました。';
        alert(message);
    }
};
// 초대 승인/거절 핸들러 (기존 함수는 사용하지 않음)
const handleRespondToInvitation = async (accepted) => {
    if (accepted) {
        openInvitationAcceptModal();
    }
    else {
        await handleRejectInvitation();
    }
};
// 탈퇴 핸들러
const handleLeaveStore = async () => {
    const myStaffEntry = store.value?.staffList.find((s) => s.email === currentUserEmail.value);
    if (!myStaffEntry)
        return;
    // 오너인 경우 다른 오너가 있는지 확인
    if (myStaffEntry.role === 'owner' && !canOwnerLeave.value) {
        alert('他のオーナーがいないため、退店できません。');
        return;
    }
    if (!confirm('本当に退店しますか？')) {
        return;
    }
    try {
        // Firebase Functionsを使用してスタッフを削除
        const removeStaffSelf = httpsCallable(functions, 'removeStaffSelf');
        await removeStaffSelf({ storeId: storeId.value });
        alert('退店しました。');
        router.push('/dashboard');
    }
    catch (err) {
        console.error('탈퇴 실패:', err);
        const message = err instanceof Error ? err.message : '退店に失敗しました。';
        alert(message);
    }
};
// 이미지 선택
const handleStaffImageSelect = (event) => {
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください。');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('ファイルサイズは5MB以下にしてください。');
            return;
        }
        staffImageFile.value = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            staffImagePreview.value = e.target?.result;
        };
        reader.readAsDataURL(file);
    }
};
// 이미지 제거
const removeStaffImage = () => {
    staffImageFile.value = null;
    staffImagePreview.value = null;
    staffImageToDelete.value = true;
};
// 이미지 업로드 함수
const uploadStaffImage = async () => {
    if (!staffImageFile.value)
        return null;
    try {
        const user = auth.currentUser;
        if (!user)
            return null;
        const fileName = `staff/${storeId.value}/${user.uid}/${Date.now()}_${staffImageFile.value.name}`;
        const imageRef = storageRef(storage, fileName);
        await uploadBytes(imageRef, staffImageFile.value);
        const downloadURL = await getDownloadURL(imageRef);
        return downloadURL;
    }
    catch (error) {
        console.error('画像アップロード失敗:', error);
        return null;
    }
};
// 표시명 편집 모달 열기
const openDisplayNameModal = () => {
    const myStaffEntry = store.value?.staffList.find((s) => s.email === currentUserEmail.value);
    displayNameForm.value.displayName = myStaffEntry?.displayName || '';
    staffImagePreview.value = myStaffEntry?.staffImageUrl || null;
    staffImageFile.value = null;
    staffImageToDelete.value = false;
    showDisplayNameModal.value = true;
};
// 표시명 업데이트
const handleUpdateDisplayName = async () => {
    isUpdatingDisplayName.value = true;
    try {
        // 画像アップロード
        let staffImageUrl = null;
        if (staffImageFile.value) {
            staffImageUrl = await uploadStaffImage();
        }
        // staffList 업데이트
        const storeRef = doc(db, 'stores', storeId.value);
        const storeDoc = await getDoc(storeRef);
        if (storeDoc.exists()) {
            const staffList = storeDoc.data().staffList || [];
            const updatedStaffList = staffList.map((staff) => {
                if (staff.email === currentUserEmail.value) {
                    const updates = {
                        ...staff,
                        displayName: displayNameForm.value.displayName.trim() || undefined,
                    };
                    // 이미지 삭제
                    if (staffImageToDelete.value && !staffImageFile.value) {
                        updates.staffImageUrl = null;
                    }
                    // 새 이미지가 업로드된 경우에만 staffImageUrl 업데이트
                    else if (staffImageUrl) {
                        updates.staffImageUrl = staffImageUrl;
                    }
                    return updates;
                }
                return staff;
            });
            await updateDoc(storeRef, {
                staffList: updatedStaffList,
            });
            alert('表示名とプロフィール画像を更新しました。');
            showDisplayNameModal.value = false;
            staffImageFile.value = null;
            staffImagePreview.value = null;
            await loadStore();
        }
    }
    catch (err) {
        console.error('표시명 업데이트 실패:', err);
        const message = err instanceof Error ? err.message : '表示名の更新に失敗しました。';
        alert(message);
    }
    finally {
        isUpdatingDisplayName.value = false;
    }
};
// 표시명 모달 취소
const cancelDisplayName = () => {
    displayNameForm.value.displayName = '';
    showDisplayNameModal.value = false;
};
onMounted(() => {
    loadStore();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['display-name-button']} */ ;
/** @type {__VLS_StyleScopedClasses['invite-button']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-section']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-section']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-section']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-card']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-card']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-card']} */ ;
/** @type {__VLS_StyleScopedClasses['is-current-user']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['leave-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['approve-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['reject-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-button-text']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "staff-management-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-buttons" },
});
if (__VLS_ctx.isCurrentUserActive) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openDisplayNameModal) },
        ...{ class: "display-name-button" },
    });
}
if (__VLS_ctx.isOwner) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOwner))
                    return;
                __VLS_ctx.showInviteModal = true;
            } },
        ...{ class: "invite-button" },
    });
}
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
        ...{ class: "staff-sections" },
    });
    if (__VLS_ctx.isCurrentUserPending) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "staff-section pending" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "staff-list" },
        });
        for (const [staff] of __VLS_getVForSourceType((__VLS_ctx.pendingStaff.filter((s) => s.email === __VLS_ctx.currentUserEmail)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (staff.email),
                ...{ class: "staff-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-info" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-icon" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-details" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-email" },
            });
            (staff.email);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-meta" },
            });
            (__VLS_ctx.getRoleLabel(staff.role));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-actions" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (() => __VLS_ctx.handleRespondToInvitation(true)) },
                ...{ class: "action-btn approve-btn" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (() => __VLS_ctx.handleRespondToInvitation(false)) },
                ...{ class: "action-btn reject-btn" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "permission-notice" },
        });
    }
    else {
        if (__VLS_ctx.isOwner && __VLS_ctx.pendingJoinRequests.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
                ...{ class: "staff-section join-requests" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
            (__VLS_ctx.pendingJoinRequests.length);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-list" },
            });
            for (const [request] of __VLS_getVForSourceType((__VLS_ctx.pendingJoinRequests))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (request.id),
                    ...{ class: "staff-card" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-info" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-icon" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-details" },
                });
                if (request.displayName) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "staff-name" },
                    });
                    (request.displayName);
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-email-small" },
                });
                (request.userEmail);
                if (request.message) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "staff-meta" },
                    });
                    (request.message);
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-meta" },
                });
                (__VLS_ctx.formatTimestamp(request.createdAt));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-actions" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (() => __VLS_ctx.handleJoinRequest(request.id, true, request.userEmail, request.displayName)) },
                    ...{ class: "action-btn approve-btn" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (() => __VLS_ctx.handleJoinRequest(request.id, false, request.userEmail)) },
                    ...{ class: "action-btn reject-btn" },
                });
            }
        }
        if (__VLS_ctx.pendingStaff.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
                ...{ class: "staff-section pending" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
            (__VLS_ctx.pendingStaff.length);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-list" },
            });
            for (const [staff] of __VLS_getVForSourceType((__VLS_ctx.pendingStaff))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (staff.email),
                    ...{ class: "staff-card" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-info" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-icon" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-details" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-email" },
                });
                (staff.email);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-meta" },
                });
                (__VLS_ctx.getRoleLabel(staff.role));
                if (staff.email === __VLS_ctx.currentUserEmail) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "staff-actions" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                        ...{ onClick: (() => __VLS_ctx.handleRespondToInvitation(true)) },
                        ...{ class: "action-btn approve-btn" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                        ...{ onClick: (() => __VLS_ctx.handleRespondToInvitation(false)) },
                        ...{ class: "action-btn reject-btn" },
                    });
                }
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "staff-section active" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.activeStaff.length);
        if (__VLS_ctx.activeStaff.length === 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "no-staff" },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "staff-list" },
            });
            for (const [staff] of __VLS_getVForSourceType((__VLS_ctx.activeStaff))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (staff.email),
                    ...{ class: "staff-card" },
                    ...{ class: ({ 'is-current-user': staff.email === __VLS_ctx.currentUserEmail }) },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-info" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-avatar-container" },
                });
                if (staff.staffImageUrl ||
                    staff.userPhotoURL ||
                    (staff.email === __VLS_ctx.currentUserEmail && __VLS_ctx.currentUser?.photoURL)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                        src: (staff.staffImageUrl ||
                            staff.userPhotoURL ||
                            (staff.email === __VLS_ctx.currentUserEmail ? __VLS_ctx.currentUser?.photoURL : '')),
                        alt: (staff.displayName || staff.userDisplayName || staff.email),
                        ...{ class: "staff-avatar" },
                    });
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "staff-avatar staff-avatar-default" },
                    });
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-role-badge" },
                });
                (staff.role === 'owner' ? '👑' : '⚙️');
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-details" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-name" },
                });
                (staff.displayName ||
                    staff.userDisplayName ||
                    (staff.email === __VLS_ctx.currentUserEmail ? __VLS_ctx.currentUser?.displayName : null) ||
                    staff.email);
                if (staff.email === __VLS_ctx.currentUserEmail) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: "you-badge" },
                    });
                }
                if (staff.displayName ||
                    staff.userDisplayName ||
                    (staff.email === __VLS_ctx.currentUserEmail && __VLS_ctx.currentUser?.displayName)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "staff-email-small" },
                    });
                    (staff.email);
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-meta-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-meta" },
                });
                (__VLS_ctx.getRoleLabel(staff.role));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "staff-actions-inline" },
                });
                if (__VLS_ctx.isOwner && staff.email !== __VLS_ctx.currentUserEmail && staff.role !== 'owner') {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                        ...{ onClick: (() => __VLS_ctx.handleRemoveStaff(staff.email)) },
                        ...{ class: "remove-btn" },
                        title: "スタッフを削除",
                    });
                }
                if (staff.email === __VLS_ctx.currentUserEmail &&
                    (staff.role !== 'owner' || __VLS_ctx.canOwnerLeave)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                        ...{ onClick: (() => __VLS_ctx.handleLeaveStore()) },
                        ...{ class: "leave-btn" },
                        title: "退店",
                    });
                }
            }
        }
        if (!__VLS_ctx.isOwner) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "permission-notice" },
            });
        }
    }
}
if (__VLS_ctx.showInviteModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.cancelInvite) },
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.handleInviteStaff) },
        ...{ class: "invite-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "required" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "email",
        placeholder: "example@email.com",
        required: true,
        autofocus: true,
    });
    (__VLS_ctx.inviteForm.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.inviteForm.role),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "staff",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "owner",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "form-hint" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelInvite) },
        type: "button",
        ...{ class: "cancel-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        disabled: (__VLS_ctx.isInviting),
        ...{ class: "submit-button" },
    });
    (__VLS_ctx.isInviting ? '送信中...' : '招待を送信');
}
if (__VLS_ctx.showDisplayNameModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.cancelDisplayName) },
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.handleUpdateDisplayName) },
        ...{ class: "display-name-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.displayNameForm.displayName),
        type: "text",
        placeholder: "例：山田 太郎",
        autofocus: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "form-hint" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "image-upload-section" },
    });
    if (__VLS_ctx.staffImagePreview) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "image-preview-container" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.staffImagePreview),
            alt: "プレビュー",
            ...{ class: "image-preview" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.removeStaffImage) },
            type: "button",
            ...{ class: "remove-image-btn" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "image-upload-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.handleStaffImageSelect) },
        type: "file",
        accept: "image/*",
        ...{ class: "image-upload-input" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "upload-button-text" },
    });
    (__VLS_ctx.staffImagePreview ? '画像を変更' : '画像を選択');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "form-hint" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelDisplayName) },
        type: "button",
        ...{ class: "cancel-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        disabled: (__VLS_ctx.isUpdatingDisplayName),
        ...{ class: "submit-button" },
    });
    (__VLS_ctx.isUpdatingDisplayName ? '更新中...' : '更新');
}
if (__VLS_ctx.showInvitationAcceptModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showInvitationAcceptModal))
                    return;
                __VLS_ctx.showInvitationAcceptModal = false;
            } },
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.handleAcceptInvitation) },
        ...{ class: "display-name-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.invitationAcceptForm.displayName),
        type: "text",
        placeholder: "例：山田 太郎",
        autofocus: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "form-hint" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showInvitationAcceptModal))
                    return;
                __VLS_ctx.showInvitationAcceptModal = false;
            } },
        type: "button",
        ...{ class: "cancel-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        disabled: (__VLS_ctx.isAcceptingInvitation),
        ...{ class: "submit-button" },
    });
    (__VLS_ctx.isAcceptingInvitation ? '承認中...' : '承認');
}
/** @type {__VLS_StyleScopedClasses['staff-management-container']} */ ;
/** @type {__VLS_StyleScopedClasses['header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['display-name-button']} */ ;
/** @type {__VLS_StyleScopedClasses['invite-button']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-sections']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-section']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-list']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-card']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-info']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-details']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-email']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['approve-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['reject-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['permission-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-section']} */ ;
/** @type {__VLS_StyleScopedClasses['join-requests']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-list']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-card']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-info']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-details']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-name']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-email-small']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['approve-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['reject-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-section']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-list']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-card']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-info']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-details']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-email']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['approve-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['reject-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-section']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['no-staff']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-list']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-card']} */ ;
/** @type {__VLS_StyleScopedClasses['is-current-user']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-info']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-avatar-container']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-avatar-default']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-role-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-details']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-name']} */ ;
/** @type {__VLS_StyleScopedClasses['you-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-email-small']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-meta-row']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['staff-actions-inline']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['leave-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['permission-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['invite-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['display-name-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['image-upload-section']} */ ;
/** @type {__VLS_StyleScopedClasses['image-preview-container']} */ ;
/** @type {__VLS_StyleScopedClasses['image-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['image-upload-label']} */ ;
/** @type {__VLS_StyleScopedClasses['image-upload-input']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-button-text']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['display-name-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formatTimestamp: formatTimestamp,
            isLoading: isLoading,
            error: error,
            showInviteModal: showInviteModal,
            inviteForm: inviteForm,
            isInviting: isInviting,
            showDisplayNameModal: showDisplayNameModal,
            displayNameForm: displayNameForm,
            staffImagePreview: staffImagePreview,
            isUpdatingDisplayName: isUpdatingDisplayName,
            showInvitationAcceptModal: showInvitationAcceptModal,
            invitationAcceptForm: invitationAcceptForm,
            isAcceptingInvitation: isAcceptingInvitation,
            currentUser: currentUser,
            currentUserEmail: currentUserEmail,
            pendingStaff: pendingStaff,
            activeStaff: activeStaff,
            pendingJoinRequests: pendingJoinRequests,
            isOwner: isOwner,
            isCurrentUserPending: isCurrentUserPending,
            isCurrentUserActive: isCurrentUserActive,
            canOwnerLeave: canOwnerLeave,
            getRoleLabel: getRoleLabel,
            handleJoinRequest: handleJoinRequest,
            handleInviteStaff: handleInviteStaff,
            cancelInvite: cancelInvite,
            handleRemoveStaff: handleRemoveStaff,
            handleAcceptInvitation: handleAcceptInvitation,
            handleRespondToInvitation: handleRespondToInvitation,
            handleLeaveStore: handleLeaveStore,
            handleStaffImageSelect: handleStaffImageSelect,
            removeStaffImage: removeStaffImage,
            openDisplayNameModal: openDisplayNameModal,
            handleUpdateDisplayName: handleUpdateDisplayName,
            cancelDisplayName: cancelDisplayName,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
