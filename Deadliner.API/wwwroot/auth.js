
function requireAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

function showUserInfo() {
    const user = requireAuth();
    if (!user) return null;

    const nav = document.getElementById('userInfo');
    if (nav) {
        nav.innerHTML = `
            <span style="font-size:14px; margin-right:12px;">👤 ${user.fio}</span>
            <button class="btn btn-danger" onclick="logout()" style="font-size:13px; padding:6px 12px;">Выйти</button>
        `;
    }
    return user;
}

function applyRoleRules(user) {
    if (!user) return;
    const isWorker = user.rol === 'Сотрудник цеха';
    document.querySelectorAll('.manager-only').forEach(el => {
        if (isWorker) el.style.display = 'none';
    });
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}