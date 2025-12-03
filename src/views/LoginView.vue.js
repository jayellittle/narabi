/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
const router = useRouter();
const email = ref('');
const password = ref('');
const passwordConfirm = ref('');
const displayName = ref('');
const profileImage = ref(null);
const profileImagePreview = ref('');
const errorMessage = ref('');
const isSignUp = ref(false);
const loading = ref(false);
const verificationSent = ref(false);
const showPasswordReset = ref(false);
const resetEmail = ref('');
const resetMessage = ref('');
const resetSuccess = ref(false);
// パスワードの強度チェック
const validatePassword = (password) => {
    // 最小8文字
    if (password.length < 8) {
        return { valid: false, message: 'パスワードは8文字以上で設定してください。' };
    }
    // 英文字が含まれているか
    if (!/[a-zA-Z]/.test(password)) {
        return { valid: false, message: 'パスワードには英文字を含めてください。' };
    }
    // 数字が含まれているか
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'パスワードには数字を含めてください。' };
    }
    // 連続する同じ文字をチェック (例: aaa, 111)
    if (/(.)\1{2,}/.test(password)) {
        return { valid: false, message: 'パスワードに同じ文字を3回以上連続して使用できません。' };
    }
    // 連続する文字列をチェック (例: abc, 123)
    for (let i = 0; i < password.length - 2; i++) {
        const char1 = password.charCodeAt(i);
        const char2 = password.charCodeAt(i + 1);
        const char3 = password.charCodeAt(i + 2);
        // 昇順の連続 (abc, 123)
        if (char2 === char1 + 1 && char3 === char2 + 1) {
            return {
                valid: false,
                message: 'パスワードに連続する文字列を使用できません。（例：abc、123）',
            };
        }
        // 降順の連続 (cba, 321)
        if (char2 === char1 - 1 && char3 === char2 - 1) {
            return {
                valid: false,
                message: 'パスワードに連続する文字列を使用できません。（例：cba、321）',
            };
        }
    }
    return { valid: true, message: '' };
};
const handleFileSelect = (event) => {
    const target = event.target;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        // ファイルサイズチェック (5MB)
        if (file.size > 5 * 1024 * 1024) {
            errorMessage.value = 'ファイルサイズは5MB以下にしてください。';
            return;
        }
        // 画像形式チェック
        if (!file.type.startsWith('image/')) {
            errorMessage.value = '画像ファイルを選択してください。';
            return;
        }
        profileImage.value = file;
        errorMessage.value = '';
        // プレビュー画像を生成
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                profileImagePreview.value = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    }
};
const removeProfileImage = () => {
    profileImage.value = null;
    profileImagePreview.value = '';
    // ファイル入力をリセット
    const fileInput = document.querySelector('.file-input');
    if (fileInput) {
        fileInput.value = '';
    }
};
const backToLogin = () => {
    verificationSent.value = false;
    isSignUp.value = false;
    email.value = '';
    password.value = '';
    passwordConfirm.value = '';
    displayName.value = '';
    errorMessage.value = '';
};
const handleSignUp = async () => {
    errorMessage.value = '';
    loading.value = true;
    try {
        // バリデーション
        if (!email.value) {
            errorMessage.value = 'メールアドレスを入力してください。';
            loading.value = false;
            return;
        }
        if (!password.value) {
            errorMessage.value = 'パスワードを入力してください。';
            loading.value = false;
            return;
        }
        if (!passwordConfirm.value) {
            errorMessage.value = 'パスワード確認を入力してください。';
            loading.value = false;
            return;
        }
        // パスワード強度チェック
        const passwordValidation = validatePassword(password.value);
        if (!passwordValidation.valid) {
            errorMessage.value = passwordValidation.message;
            loading.value = false;
            return;
        }
        if (password.value !== passwordConfirm.value) {
            errorMessage.value = 'パスワードが一致しません。';
            loading.value = false;
            return;
        }
        // ユーザー作成
        const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
        const user = userCredential.user;
        // プロフィール画像をアップロード（選択されている場合）
        let profileImageUrl = '';
        if (profileImage.value) {
            const imageRef = storageRef(storage, `profile_images/${user.uid}/${profileImage.value.name}`);
            await uploadBytes(imageRef, profileImage.value);
            profileImageUrl = await getDownloadURL(imageRef);
        }
        // Firestoreにユーザー情報を保存
        await setDoc(doc(db, 'users', user.uid), {
            email: email.value,
            displayName: displayName.value || '',
            profileImageUrl: profileImageUrl,
            emailVerified: false,
            createdAt: new Date(),
        });
        // 認証メールを送信
        await sendEmailVerification(user);
        // 一旦ログアウト（メール認証が完了するまでログインさせない）
        await signOut(auth);
        // 成功メッセージを表示
        verificationSent.value = true;
        loading.value = false;
        // フォームをリセット
        profileImage.value = null;
        profileImagePreview.value = '';
    }
    catch (error) {
        const authError = error;
        console.error('会員登録エラー:', authError);
        errorMessage.value = getErrorMessage(authError.code);
        loading.value = false;
    }
};
const handleSignIn = async () => {
    errorMessage.value = '';
    loading.value = true;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
        const user = userCredential.user;
        // メール認証チェック
        if (!user.emailVerified) {
            // 認証されていない場合
            const resend = confirm(`このアカウントはまだ有効化されていません。\nメールを確認して、認証リンクをクリックしてください。\n\n${email.value}に認証メールを再送信しますか？`);
            if (resend) {
                await sendEmailVerification(user);
                alert('認証メールを再送信しました。メールを確認してください。');
            }
            // ログアウトさせる
            await signOut(auth);
            loading.value = false;
            return;
        }
        // 認証済みの場合、ダッシュボードへ
        router.push('/dashboard');
    }
    catch (error) {
        const authError = error;
        console.error('ログインエラー:', authError);
        errorMessage.value = getErrorMessage(authError.code);
        loading.value = false;
    }
};
const handlePasswordReset = async () => {
    resetMessage.value = '';
    resetSuccess.value = false;
    loading.value = true;
    try {
        if (!resetEmail.value) {
            resetMessage.value = 'メールアドレスを入力してください。';
            resetSuccess.value = false;
            loading.value = false;
            return;
        }
        await sendPasswordResetEmail(auth, resetEmail.value);
        resetMessage.value = `${resetEmail.value}にパスワードリセットのメールを送信しました。`;
        resetSuccess.value = true;
        loading.value = false;
        // 3秒後にモーダルを閉じる
        setTimeout(() => {
            showPasswordReset.value = false;
            resetEmail.value = '';
            resetMessage.value = '';
        }, 3000);
    }
    catch (error) {
        const authError = error;
        console.error('パスワードリセットエラー:', authError);
        resetMessage.value = getErrorMessage(authError.code);
        resetSuccess.value = false;
        loading.value = false;
    }
};
const cancelPasswordReset = () => {
    showPasswordReset.value = false;
    resetEmail.value = '';
    resetMessage.value = '';
    resetSuccess.value = false;
};
const getErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'メールアドレスの形式が正しくありません。';
        case 'auth/user-disabled':
            return 'このアカウントは無効化されています。';
        case 'auth/user-not-found':
            return '登録されていないメールアドレスです。';
        case 'auth/wrong-password':
            return 'パスワードが間違っています。';
        case 'auth/email-already-in-use':
            return 'このメールアドレスは既に登録されています。';
        case 'auth/weak-password':
            return 'パスワードは6文字以上で設定してください。';
        case 'auth/invalid-credential':
            return '登録されていないメールアドレスです。';
        default:
            return 'エラーが発生しました。もう一度お試しください。';
    }
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['file-upload-button']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-button']} */ ;
/** @type {__VLS_StyleScopedClasses['success-message']} */ ;
/** @type {__VLS_StyleScopedClasses['back-to-login-button']} */ ;
/** @type {__VLS_StyleScopedClasses['main-button']} */ ;
/** @type {__VLS_StyleScopedClasses['main-button']} */ ;
/** @type {__VLS_StyleScopedClasses['forgot-password-link']} */ ;
/** @type {__VLS_StyleScopedClasses['password-reset-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "logo-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
    src: "/logo-rect.png",
    alt: "App Logo",
    ...{ class: "app-logo" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "logo-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "login-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "login-title" },
});
(__VLS_ctx.isSignUp ? '会員登録' : 'ログイン');
if (__VLS_ctx.verificationSent) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "success-message" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ style: {} },
    });
    (__VLS_ctx.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.backToLogin) },
        ...{ class: "back-to-login-button" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "email",
        placeholder: "メールアドレス",
    });
    (__VLS_ctx.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onKeyup: (...[$event]) => {
                if (!!(__VLS_ctx.verificationSent))
                    return;
                __VLS_ctx.isSignUp ? __VLS_ctx.handleSignUp() : __VLS_ctx.handleSignIn();
            } },
        type: "password",
        placeholder: "パスワード",
    });
    (__VLS_ctx.password);
    if (__VLS_ctx.isSignUp) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onKeyup: (...[$event]) => {
                    if (!!(__VLS_ctx.verificationSent))
                        return;
                    if (!(__VLS_ctx.isSignUp))
                        return;
                    __VLS_ctx.handleSignUp();
                } },
            type: "password",
            placeholder: "パスワード確認",
        });
        (__VLS_ctx.passwordConfirm);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "text",
            value: (__VLS_ctx.displayName),
            placeholder: "ニックネーム（任意）",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "file-upload-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: (__VLS_ctx.handleFileSelect) },
            type: "file",
            accept: "image/*",
            ...{ class: "file-input" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "file-upload-button" },
        });
        (__VLS_ctx.profileImage ? __VLS_ctx.profileImage.name : 'プロフィール画像を選択（任意）');
        if (__VLS_ctx.profileImagePreview) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "image-preview-container" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                src: (__VLS_ctx.profileImagePreview),
                alt: "プロフィール画像プレビュー",
                ...{ class: "image-preview" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.removeProfileImage) },
                type: "button",
                ...{ class: "remove-image-button" },
            });
        }
    }
    if (__VLS_ctx.errorMessage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "error-message" },
        });
        (__VLS_ctx.errorMessage);
    }
    if (__VLS_ctx.isSignUp) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.handleSignUp) },
            ...{ class: "main-button" },
            disabled: (__VLS_ctx.loading),
        });
        (__VLS_ctx.loading ? '登録中...' : '会員登録');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.verificationSent))
                        return;
                    if (!(__VLS_ctx.isSignUp))
                        return;
                    __VLS_ctx.isSignUp = false;
                } },
            href: "#",
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.handleSignIn) },
            ...{ class: "main-button" },
            disabled: (__VLS_ctx.loading),
        });
        (__VLS_ctx.loading ? 'ログイン中...' : 'ログイン');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.verificationSent))
                        return;
                    if (!!(__VLS_ctx.isSignUp))
                        return;
                    __VLS_ctx.isSignUp = true;
                } },
            href: "#",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "forgot-password-text" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.verificationSent))
                        return;
                    if (!!(__VLS_ctx.isSignUp))
                        return;
                    __VLS_ctx.showPasswordReset = true;
                } },
            ...{ class: "forgot-password-link" },
        });
    }
    if (__VLS_ctx.showPasswordReset) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.verificationSent))
                        return;
                    if (!(__VLS_ctx.showPasswordReset))
                        return;
                    __VLS_ctx.showPasswordReset = false;
                } },
            ...{ class: "password-reset-overlay" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "password-reset-modal" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "reset-description" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "email",
            placeholder: "メールアドレス",
        });
        (__VLS_ctx.resetEmail);
        if (__VLS_ctx.resetMessage) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: (__VLS_ctx.resetSuccess ? 'success-message' : 'error-message') },
            });
            (__VLS_ctx.resetMessage);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "modal-buttons" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.handlePasswordReset) },
            ...{ class: "main-button" },
            disabled: (__VLS_ctx.loading),
        });
        (__VLS_ctx.loading ? '送信中...' : 'リセットリンクを送信');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.cancelPasswordReset) },
            ...{ class: "cancel-button" },
        });
    }
}
/** @type {__VLS_StyleScopedClasses['logo-container']} */ ;
/** @type {__VLS_StyleScopedClasses['app-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-text']} */ ;
/** @type {__VLS_StyleScopedClasses['login-container']} */ ;
/** @type {__VLS_StyleScopedClasses['login-title']} */ ;
/** @type {__VLS_StyleScopedClasses['success-message']} */ ;
/** @type {__VLS_StyleScopedClasses['back-to-login-button']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['file-upload-label']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['file-upload-button']} */ ;
/** @type {__VLS_StyleScopedClasses['image-preview-container']} */ ;
/** @type {__VLS_StyleScopedClasses['image-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['remove-image-button']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['main-button']} */ ;
/** @type {__VLS_StyleScopedClasses['main-button']} */ ;
/** @type {__VLS_StyleScopedClasses['forgot-password-text']} */ ;
/** @type {__VLS_StyleScopedClasses['forgot-password-link']} */ ;
/** @type {__VLS_StyleScopedClasses['password-reset-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['password-reset-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['reset-description']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['main-button']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            email: email,
            password: password,
            passwordConfirm: passwordConfirm,
            displayName: displayName,
            profileImage: profileImage,
            profileImagePreview: profileImagePreview,
            errorMessage: errorMessage,
            isSignUp: isSignUp,
            loading: loading,
            verificationSent: verificationSent,
            showPasswordReset: showPasswordReset,
            resetEmail: resetEmail,
            resetMessage: resetMessage,
            resetSuccess: resetSuccess,
            handleFileSelect: handleFileSelect,
            removeProfileImage: removeProfileImage,
            backToLogin: backToLogin,
            handleSignUp: handleSignUp,
            handleSignIn: handleSignIn,
            handlePasswordReset: handlePasswordReset,
            cancelPasswordReset: cancelPasswordReset,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
