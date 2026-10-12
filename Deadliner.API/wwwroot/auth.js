function requireAuth() {
    let user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    if (user.id === 1 && user.rol !== 'Администратор') {
        user.rol = 'Администратор';
        localStorage.setItem('user', JSON.stringify(user));
    }
    return user;
}

function showUserInfo() {
    const user = requireAuth();
    if (!user) return null;

    const nav = document.getElementById('userInfo');
    if (nav) {
        const initials = user.fio ? user.fio.charAt(0).toUpperCase() : 'U';
        const avatarContent = user.foto 
            ? `<img src="${user.foto}" alt="${initials}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`
            : initials;

        nav.innerHTML = `
            <div class="user-panel">
                <a href="profile.html" class="user-details" title="Перейти в личный профиль" style="text-decoration:none; color:inherit; display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                    <div class="avatar-box" style="padding:0; overflow:hidden;">${avatarContent}</div>
                    <div style="overflow:hidden;">
                        <div class="user-text-name">${user.fio}</div>
                        <div class="user-text-role">${user.rol}</div>
                    </div>
                </a>
                <button class="logout-link-btn" title="Выйти из системы" onclick="logout()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                    </svg>
                </button>
            </div>
        `;
    }
    return user;
}

function requireAdmin() {
    const user = requireAuth();
    if (!user) return null;
    if (user.rol !== 'Администратор') {
        alert('Доступ ограничен. Панель администрирования доступна только Администратору.');
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

function applyRoleRules(user) {
    if (!user) return;
    const isAdmin = user.rol === 'Администратор';
    const isManagerOrAdmin = user.rol === 'Администратор' || user.rol === 'Менеджер' || user.rol === 'Начальник производства';

    document.querySelectorAll('.admin-only').forEach(el => {
        if (!isAdmin) el.style.display = 'none';
    });

    document.querySelectorAll('.manager-only').forEach(el => {
        if (!isManagerOrAdmin) el.style.display = 'none';
    });
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

/* ==============================================================================
   ГЛОБАЛЬНАЯ СИСТЕМА УВЕДОМЛЕНИЙ (TOASTS) И ДИАЛОГОВ (CONFIRM)
   ============================================================================== */

function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'success', title = null) {
    const container = getToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let defaultTitle = 'Успешно';
    let iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

    if (type === 'error') {
        defaultTitle = 'Ошибка';
        iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else if (type === 'warning') {
        defaultTitle = 'Внимание';
        iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (type === 'info') {
        defaultTitle = 'Информация';
        iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    const finalTitle = title !== null ? title : defaultTitle;

    toast.innerHTML = `
        ${iconSvg}
        <div class="toast-body">
            ${finalTitle ? `<div class="toast-title">${finalTitle}</div>` : ''}
            <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close-btn" onclick="this.closest('.toast-item').remove()">✕</button>
    `;

    container.appendChild(toast);

    // Автоматическое исчезновение через 3.8 секунды
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 250);
    }, 3800);
}

function showConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
        let overlay = document.getElementById('customConfirmModal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'customConfirmModal';
            overlay.className = 'custom-confirm-overlay';
            document.body.appendChild(overlay);
        }

        const confirmText = options.confirmText || 'Подтвердить';
        const cancelText = options.cancelText || 'Отмена';
        const isDanger = options.isDanger !== false; // по умолчанию красная кнопка
        const isInfo = options.isInfo === true;

        const headerClass = isInfo ? 'custom-confirm-header info' : 'custom-confirm-header';
        const iconSvg = isInfo
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
            : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

        overlay.innerHTML = `
            <div class="custom-confirm-box">
                <div class="${headerClass}">
                    <div class="icon-circle">${iconSvg}</div>
                    <div class="custom-confirm-title">${title}</div>
                </div>
                <div class="custom-confirm-message">${message}</div>
                <div class="custom-confirm-actions">
                    <button type="button" class="btn-modern btn-ghost" id="confirmCancelBtn">${cancelText}</button>
                    <button type="button" class="btn-modern ${isDanger ? 'btn-danger' : 'btn-primary'}" 
                            style="${isDanger ? 'background:var(--status-red); color:#fff;' : ''}" id="confirmAcceptBtn">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        overlay.classList.add('active');

        const cleanUp = (result) => {
            overlay.classList.remove('active');
            resolve(result);
        };

        document.getElementById('confirmCancelBtn').onclick = () => cleanUp(false);
        document.getElementById('confirmAcceptBtn').onclick = () => cleanUp(true);

        overlay.onclick = (e) => {
            if (e.target === overlay) cleanUp(false);
        };
    });
}