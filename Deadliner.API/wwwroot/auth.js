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
        nav.innerHTML = `
            <div class="user-panel">
                <a href="profile.html" class="user-details" title="Перейти в личный профиль" style="text-decoration:none; color:inherit; display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                    <div class="avatar-box">${initials}</div>
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