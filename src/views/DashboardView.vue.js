/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, computed, watch } from 'vue';
import { signOut } from 'firebase/auth';
import { useRouter, useRoute } from 'vue-router';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc, } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../firebase';
const router = useRouter();
const route = useRoute();
const db = getFirestore();
const storage = getStorage();
const myStores = ref([]);
const isLoading = ref(true);
const selectedStoreId = ref(null);
// 사용자 프로필
const userProfile = ref(null);
const isLoadingProfile = ref(true);
// 프로필 수정
const showProfileModal = ref(false);
const editableProfile = ref({
    displayName: '',
    email: '',
});
const profileImageFile = ref(null);
const profileImagePreview = ref(null);
const profileImageToDelete = ref(false);
const isUpdatingProfile = ref(false);
// 현재 선택된 매장 (computed removed as it was unused)
// 승인된 매장만 필터링
const approvedStores = computed(() => {
    return myStores.value.filter((s) => s.status === 'approved' || !s.status);
});
// 승인 대기 중인 매장 (오너가 등록한 매장이 관리자 승인 대기 중)
const pendingStores = computed(() => {
    return myStores.value.filter((s) => s.status === 'pending');
});
// 초대 대기 중인 매장 (내가 스태프로 초대받아서 승인 대기 중)
const invitationPendingStores = computed(() => {
    return myStores.value.filter((s) => s.status === 'invitation-pending');
});
// 사용자 프로필 로드
const loadUserProfile = async () => {
    isLoadingProfile.value = true;
    try {
        const user = auth.currentUser;
        if (!user) {
            router.push('/login');
            return;
        }
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            userProfile.value = userDoc.data();
        }
        else {
            // 기본값
            userProfile.value = {
                email: user.email || '',
                displayName: user.displayName || 'ユーザー',
                profileImageUrl: '',
            };
        }
    }
    catch (error) {
        console.error('プロフィール読み込み失敗:', error);
    }
    finally {
        isLoadingProfile.value = false;
    }
};
// 매장 로드 - 오너 + 스태프로 등록된 매장 모두 가져오기
const loadStores = async () => {
    isLoading.value = true;
    try {
        const user = auth.currentUser;
        if (!user) {
            router.push('/login');
            return;
        }
        // 1. 내가 오너인 매장
        const ownerQuery = query(collection(db, 'stores'), where('ownerId', '==', user.uid));
        const ownerSnapshot = await getDocs(ownerQuery);
        // 2. 모든 매장을 가져와서 staffList에 내 이메일이 있는지 확인
        const allStoresQuery = query(collection(db, 'stores'));
        const allStoresSnapshot = await getDocs(allStoresQuery);
        const storesMap = new Map();
        // 오너인 매장 추가
        ownerSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            storesMap.set(doc.id, {
                id: doc.id,
                name: data.name,
                address: data.address,
                imageUrl: data.imageUrl,
                status: data.status || 'approved',
            });
        });
        // 스태프로 등록된 매장 추가 (active 또는 pending)
        allStoresSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const staffList = data.staffList || [];
            // staffList에서 내 이메일이 있는지 확인 (active 또는 pending)
            const myStaffEntry = staffList.find((staff) => staff.email === user.email && (staff.status === 'active' || staff.status === 'pending'));
            if (myStaffEntry && !storesMap.has(doc.id)) {
                storesMap.set(doc.id, {
                    id: doc.id,
                    name: data.name,
                    address: data.address,
                    imageUrl: data.imageUrl,
                    status: myStaffEntry.status === 'pending'
                        ? 'invitation-pending'
                        : data.status || 'approved',
                });
            }
        });
        myStores.value = Array.from(storesMap.values());
        // URL에 storeId가 있으면 자동 선택
        if (route.params.storeId) {
            selectedStoreId.value = route.params.storeId;
        }
        else if (approvedStores.value.length > 0) {
            // 첫 번째 승인된 매장 자동 선택
            selectedStoreId.value = approvedStores.value[0].id;
        }
    }
    catch (error) {
        console.error('店舗読み込み失敗:', error);
    }
    finally {
        isLoading.value = false;
    }
};
// 매장 선택
const selectStore = (storeId) => {
    selectedStoreId.value = storeId;
    // 초대 대기 중인 매장은 스태프 관리 페이지로 직접 이동
    const store = myStores.value.find((s) => s.id === storeId);
    if (store?.status === 'invitation-pending') {
        router.push(`/store/${storeId}/staff`);
    }
    else {
        router.push(`/store/${storeId}`);
    }
};
// 로그아웃
const handleSignOut = async () => {
    try {
        await signOut(auth);
        router.push('/login');
    }
    catch (error) {
        console.error('ログアウト失敗:', error);
    }
};
// 매장 등록 페이지로 이동
const goToRegisterStore = () => {
    router.push('/register-store');
};
// 프로필 모달 열기
const openProfileModal = () => {
    if (userProfile.value) {
        editableProfile.value = {
            displayName: userProfile.value.displayName,
            email: userProfile.value.email,
        };
    }
    profileImagePreview.value = null;
    profileImageFile.value = null;
    profileImageToDelete.value = false;
    showProfileModal.value = true;
};
// 프로필 모달 닫기
const closeProfileModal = () => {
    showProfileModal.value = false;
    profileImagePreview.value = null;
    profileImageFile.value = null;
    profileImageToDelete.value = false;
};
// 프로필 이미지 선택
const handleProfileImageSelect = (event) => {
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
        profileImageFile.value = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            profileImagePreview.value = e.target?.result;
        };
        reader.readAsDataURL(file);
    }
};
// 프로필 이미지 제거
const removeProfileImage = () => {
    profileImageFile.value = null;
    profileImagePreview.value = null;
    profileImageToDelete.value = true;
    // 기존 프로필 이미지도 UI에서 즉시 제거
    if (userProfile.value) {
        userProfile.value.profileImageUrl = '';
    }
};
// 프로필 업데이트
const handleProfileUpdate = async () => {
    const user = auth.currentUser;
    if (!user) {
        alert('ログインが必要です。');
        return;
    }
    isUpdatingProfile.value = true;
    try {
        const updates = {
            displayName: editableProfile.value.displayName,
        };
        // 이미지 삭제
        if (profileImageToDelete.value && !profileImageFile.value) {
            updates.profileImageUrl = '';
        }
        // 새 이미지 업로드
        else if (profileImageFile.value) {
            const fileName = `users/${user.uid}/profile/${Date.now()}_${profileImageFile.value.name}`;
            const imageRef = storageRef(storage, fileName);
            await uploadBytes(imageRef, profileImageFile.value);
            const downloadURL = await getDownloadURL(imageRef);
            updates.profileImageUrl = downloadURL;
        }
        // Firestore 업데이트
        await updateDoc(doc(db, 'users', user.uid), updates);
        // 로컬 상태 업데이트
        if (userProfile.value) {
            userProfile.value.displayName = editableProfile.value.displayName;
            if ('profileImageUrl' in updates) {
                userProfile.value.profileImageUrl = updates.profileImageUrl;
            }
        }
        alert('プロフィールを更新しました。');
        closeProfileModal();
    }
    catch (error) {
        console.error('プロフィール更新失敗:', error);
        alert('プロフィールの更新に失敗しました。');
    }
    finally {
        isUpdatingProfile.value = false;
    }
};
onMounted(() => {
    loadUserProfile();
    loadStores();
});
// route가 변경될 때 점포 목록 새로고침
watch(() => route.path, (newPath, oldPath) => {
    // dashboard 페이지로 돌아왔을 때만 새로고침
    if (newPath === '/dashboard' && oldPath !== '/dashboard') {
        loadStores();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['profile-header']} */ ;
/** @type {__VLS_StyleScopedClasses['logout-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-card']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-info']} */ ;
/** @type {__VLS_StyleScopedClasses['stores-header']} */ ;
/** @type {__VLS_StyleScopedClasses['add-store-header-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['no-stores']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['approved']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['invitation-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['store-status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['store-status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-placeholder-small']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dashboard-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "profile-sidebar" },
});
if (__VLS_ctx.isLoading || __VLS_ctx.isLoadingProfile) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "profile-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "profile-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleSignOut) },
        ...{ class: "logout-btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.openProfileModal) },
        ...{ class: "profile-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "profile-image-container" },
    });
    if (__VLS_ctx.userProfile?.profileImageUrl) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.userProfile.profileImageUrl),
            alt: "プロフィール画像",
            ...{ class: "profile-image" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "profile-image-placeholder" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "profile-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (__VLS_ctx.userProfile?.displayName || __VLS_ctx.userProfile?.email || 'ユーザー');
    if (__VLS_ctx.userProfile?.displayName) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "profile-email" },
        });
        (__VLS_ctx.userProfile?.email || '');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "edit-hint" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "stores-content" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stores-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.goToRegisterStore) },
    ...{ class: "add-store-header-btn" },
});
if (__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    if (__VLS_ctx.approvedStores.length === 0 &&
        __VLS_ctx.pendingStores.length === 0 &&
        __VLS_ctx.invitationPendingStores.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "no-stores" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "no-stores-icon" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stores-grid" },
        });
        for (const [store] of __VLS_getVForSourceType((__VLS_ctx.invitationPendingStores))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.approvedStores.length === 0 &&
                            __VLS_ctx.pendingStores.length === 0 &&
                            __VLS_ctx.invitationPendingStores.length === 0))
                            return;
                        __VLS_ctx.selectStore(store.id);
                    } },
                key: (store.id),
                ...{ class: "store-card invitation-pending" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-header" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-image-container" },
            });
            if (store.imageUrl) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                    src: (store.imageUrl),
                    alt: "店舗画像",
                    ...{ class: "store-image" },
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "store-image-placeholder" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-body" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            (store.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "store-address" },
            });
            (store.address);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-status-badge invitation" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-arrow" },
            });
        }
        for (const [store] of __VLS_getVForSourceType((__VLS_ctx.approvedStores))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.isLoading))
                            return;
                        if (!!(__VLS_ctx.approvedStores.length === 0 &&
                            __VLS_ctx.pendingStores.length === 0 &&
                            __VLS_ctx.invitationPendingStores.length === 0))
                            return;
                        __VLS_ctx.selectStore(store.id);
                    } },
                key: (store.id),
                ...{ class: "store-card approved" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-header" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-image-container" },
            });
            if (store.imageUrl) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                    src: (store.imageUrl),
                    alt: "店舗画像",
                    ...{ class: "store-image" },
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "store-image-placeholder" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-body" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            (store.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "store-address" },
            });
            (store.address);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-arrow" },
            });
        }
        for (const [store] of __VLS_getVForSourceType((__VLS_ctx.pendingStores))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (store.id),
                ...{ class: "store-card pending" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-header" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-image-container" },
            });
            if (store.imageUrl) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                    src: (store.imageUrl),
                    alt: "店舗画像",
                    ...{ class: "store-image" },
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "store-image-placeholder" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-card-body" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
            (store.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "store-address" },
            });
            (store.address);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "store-status-badge pending-badge" },
            });
        }
    }
}
if (__VLS_ctx.showProfileModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.closeProfileModal) },
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: () => { } },
        ...{ class: "modal-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.handleProfileUpdate) },
        ...{ class: "profile-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "profile-image-upload" },
    });
    if (__VLS_ctx.profileImagePreview || __VLS_ctx.userProfile?.profileImageUrl) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "profile-preview" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.profileImagePreview || __VLS_ctx.userProfile?.profileImageUrl),
            alt: "プロフィール",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.removeProfileImage) },
            type: "button",
            ...{ class: "remove-image-btn" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "profile-upload-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: (__VLS_ctx.handleProfileImageSelect) },
            type: "file",
            accept: "image/*",
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "upload-placeholder-small" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "upload-icon" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.editableProfile.displayName),
        type: "text",
        placeholder: "表示名を入力",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "email",
        disabled: true,
        ...{ class: "disabled-input" },
    });
    (__VLS_ctx.editableProfile.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "form-hint" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeProfileModal) },
        type: "button",
        ...{ class: "cancel-button" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        disabled: (__VLS_ctx.isUpdatingProfile),
        ...{ class: "submit-button" },
    });
    (__VLS_ctx.isUpdatingProfile ? '更新中...' : '更新');
}
/** @type {__VLS_StyleScopedClasses['dashboard-container']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-section']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-header']} */ ;
/** @type {__VLS_StyleScopedClasses['logout-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-card']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-image-container']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-image']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-image-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-info']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-email']} */ ;
/** @type {__VLS_StyleScopedClasses['edit-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['stores-content']} */ ;
/** @type {__VLS_StyleScopedClasses['stores-header']} */ ;
/** @type {__VLS_StyleScopedClasses['add-store-header-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['no-stores']} */ ;
/** @type {__VLS_StyleScopedClasses['no-stores-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stores-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['invitation-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image-container']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['store-address']} */ ;
/** @type {__VLS_StyleScopedClasses['store-status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['invitation']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['approved']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image-container']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['store-address']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card']} */ ;
/** @type {__VLS_StyleScopedClasses['pending']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-header']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image-container']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image']} */ ;
/** @type {__VLS_StyleScopedClasses['store-image-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['store-card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['store-address']} */ ;
/** @type {__VLS_StyleScopedClasses['store-status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['pending-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-image-upload']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-upload-label']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-placeholder-small']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled-input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['submit-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            isLoading: isLoading,
            userProfile: userProfile,
            isLoadingProfile: isLoadingProfile,
            showProfileModal: showProfileModal,
            editableProfile: editableProfile,
            profileImagePreview: profileImagePreview,
            isUpdatingProfile: isUpdatingProfile,
            approvedStores: approvedStores,
            pendingStores: pendingStores,
            invitationPendingStores: invitationPendingStores,
            selectStore: selectStore,
            handleSignOut: handleSignOut,
            goToRegisterStore: goToRegisterStore,
            openProfileModal: openProfileModal,
            closeProfileModal: closeProfileModal,
            handleProfileImageSelect: handleProfileImageSelect,
            removeProfileImage: removeProfileImage,
            handleProfileUpdate: handleProfileUpdate,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
