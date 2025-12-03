/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
const db = getFirestore();
const auth = getAuth();
const route = useRoute();
const router = useRouter();
const storeId = route.params.storeId;
const store = ref(null);
const userProfile = ref(null);
// 現在のユーザー
const currentUser = computed(() => auth.currentUser);
// 現在のページがメニューページかどうか
const isMenuPage = computed(() => {
    return route.name === 'StoreManagementMenu';
});
// 現在のスタッフメンバー情報
const currentStaffMember = computed(() => {
    if (!store.value || !currentUser.value)
        return null;
    return store.value.staffList?.find((s) => s.email === currentUser.value?.email);
});
// プロフィール画像を取得 (優先順位: スタッフ画像 > ユーザー画像)
const currentProfileImage = computed(() => {
    if (currentStaffMember.value?.staffImageUrl) {
        return currentStaffMember.value.staffImageUrl;
    }
    if (userProfile.value?.profileImageUrl) {
        return userProfile.value.profileImageUrl;
    }
    return '/default-avatar.png';
});
// 表示名を取得 (優先順位: スタッフ表示名 > ユーザー表示名 > メール)
const currentDisplayName = computed(() => {
    if (currentStaffMember.value?.displayName) {
        return currentStaffMember.value.displayName;
    }
    if (userProfile.value?.displayName) {
        return userProfile.value.displayName;
    }
    return currentUser.value?.email || '';
});
// 現在のユーザーがpending状態かどうか
const isCurrentUserPending = computed(() => {
    return currentStaffMember.value?.status === 'pending';
});
// ユーザープロフィールをロード
const loadUserProfile = async () => {
    if (!currentUser.value)
        return;
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.value.uid));
        if (userDoc.exists()) {
            userProfile.value = userDoc.data();
        }
    }
    catch (error) {
        console.error('ユーザープロフィール読み込み失敗:', error);
    }
};
onMounted(async () => {
    if (storeId) {
        try {
            const storeDocRef = doc(db, 'stores', storeId);
            const storeDoc = await getDoc(storeDocRef);
            if (storeDoc.exists()) {
                store.value = {
                    id: storeDoc.id,
                    ...storeDoc.data(),
                };
                // ユーザープロフィールもロード
                await loadUserProfile();
            }
            else {
                console.error('Store not found!');
                alert('店舗情報が見つかりませんでした。');
                router.push('/dashboard');
            }
        }
        catch (error) {
            console.error('Error loading store:', error);
            alert('店舗情報の読み込みに失敗しました。');
            router.push('/dashboard');
        }
    }
});
// pending ユーザーがアクセスできないページへの遷移を防ぐ
watch(() => [route.path, isCurrentUserPending.value], ([currentPath, isPending]) => {
    if (isPending && store.value) {
        const restrictedPaths = [
            `/store/${storeId}`,
            `/store/${storeId}/qr`,
            `/store/${storeId}/waiting`,
        ];
        if (restrictedPaths.includes(currentPath)) {
            alert('招待を承認すると全てのメニューにアクセスできます。');
            router.replace(`/store/${storeId}/staff`);
        }
    }
}, { immediate: true });
const goBack = () => {
    router.push('/dashboard');
};
const goToMenu = () => {
    // pending ユーザーは店舗一覧に戻る
    if (isCurrentUserPending.value) {
        router.push('/dashboard');
        return;
    }
    router.push(`/store/${storeId}`);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pc-store-header']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-back-btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-back-btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['store-detail-container']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['main-content']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-header']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "store-detail-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "sidebar" },
    ...{ class: ({ 'hide-on-mobile': !__VLS_ctx.isMenuPage }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.goBack) },
    ...{ class: "back-btn" },
});
if (__VLS_ctx.store) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "store-info-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
        ...{ class: "nav-menu" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    if (__VLS_ctx.isCurrentUserPending) {
        const __VLS_0 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            to: (`/store/${__VLS_ctx.storeId}/staff`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }));
        const __VLS_2 = __VLS_1({
            to: (`/store/${__VLS_ctx.storeId}/staff`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        __VLS_3.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "nav-icon" },
        });
        var __VLS_3;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "menu-notice" },
        });
    }
    else {
        const __VLS_4 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
            to: (`/store/${__VLS_ctx.storeId}`),
            ...{ class: "nav-item" },
            ...{ class: ({ active: __VLS_ctx.isMenuPage }) },
            exact: true,
        }));
        const __VLS_6 = __VLS_5({
            to: (`/store/${__VLS_ctx.storeId}`),
            ...{ class: "nav-item" },
            ...{ class: ({ active: __VLS_ctx.isMenuPage }) },
            exact: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_5));
        __VLS_7.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "nav-icon" },
        });
        var __VLS_7;
        const __VLS_8 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
            to: (`/store/${__VLS_ctx.storeId}/qr`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }));
        const __VLS_10 = __VLS_9({
            to: (`/store/${__VLS_ctx.storeId}/qr`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }, ...__VLS_functionalComponentArgsRest(__VLS_9));
        __VLS_11.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "nav-icon" },
        });
        var __VLS_11;
        const __VLS_12 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            to: (`/store/${__VLS_ctx.storeId}/waiting`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }));
        const __VLS_14 = __VLS_13({
            to: (`/store/${__VLS_ctx.storeId}/waiting`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        __VLS_15.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "nav-icon" },
        });
        var __VLS_15;
        const __VLS_16 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            to: (`/store/${__VLS_ctx.storeId}/staff`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }));
        const __VLS_18 = __VLS_17({
            to: (`/store/${__VLS_ctx.storeId}/staff`),
            ...{ class: "nav-item" },
            activeClass: "active",
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
        __VLS_19.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "nav-icon" },
        });
        var __VLS_19;
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "main-content" },
});
if (__VLS_ctx.store) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mobile-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mobile-header-top" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store))
                    return;
                __VLS_ctx.isMenuPage ? __VLS_ctx.goBack() : __VLS_ctx.goToMenu();
            } },
        ...{ class: "mobile-back-btn-icon" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mobile-user-info" },
    });
    if (__VLS_ctx.currentProfileImage && __VLS_ctx.currentProfileImage !== '/default-avatar.png') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.currentProfileImage),
            alt: "プロフィール画像",
            ...{ class: "mobile-user-avatar" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mobile-user-avatar-placeholder" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "mobile-user-name" },
    });
    (__VLS_ctx.currentDisplayName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mobile-store-name" },
    });
    (__VLS_ctx.store.name);
}
if (__VLS_ctx.store && __VLS_ctx.isMenuPage) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "pc-store-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "store-header-card" },
    });
    if (__VLS_ctx.store.imageUrl) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.store.imageUrl),
            alt: "店舗画像",
            ...{ class: "store-header-image" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "store-icon" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "store-header-details" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "store-header-name" },
    });
    (__VLS_ctx.store.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "store-header-address" },
    });
    (__VLS_ctx.store.address);
}
if (__VLS_ctx.store) {
    const __VLS_20 = {}.RouterView;
    /** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
    const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
/** @type {__VLS_StyleScopedClasses['store-detail-container']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['hide-on-mobile']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['store-info-section']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-item']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['main-content']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-header']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-header-top']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-back-btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-user-info']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-user-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-user-avatar-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-user-name']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-store-name']} */ ;
/** @type {__VLS_StyleScopedClasses['pc-store-header']} */ ;
/** @type {__VLS_StyleScopedClasses['store-header-card']} */ ;
/** @type {__VLS_StyleScopedClasses['store-header-image']} */ ;
/** @type {__VLS_StyleScopedClasses['store-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['store-header-details']} */ ;
/** @type {__VLS_StyleScopedClasses['store-header-name']} */ ;
/** @type {__VLS_StyleScopedClasses['store-header-address']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-content']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            storeId: storeId,
            store: store,
            isMenuPage: isMenuPage,
            currentProfileImage: currentProfileImage,
            currentDisplayName: currentDisplayName,
            isCurrentUserPending: isCurrentUserPending,
            goBack: goBack,
            goToMenu: goToMenu,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
