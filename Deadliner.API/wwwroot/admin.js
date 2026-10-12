const API = 'http://localhost:5216/api';

let allUsers = [];
let allRoles = [];
let allOrders = [];
let allClients = [];
let allAudit = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Проверка прав главного администратора
    const currentUser = requireAdmin();
    if (!currentUser) return;

    showUserInfo();
    applyRoleRules(currentUser);

    // 2. Первичная загрузка ролей и сводных данных
    await loadRoles();
    await loadAdminDashboard();
});

// Переключение между 4 панелями полного контроля
function switchAdminTab(tabName, tabBtn) {
    document.querySelectorAll('.admin-nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));

    tabBtn.classList.add('active');

    if (tabName === 'users') document.getElementById('sectionUsers').classList.add('active');
    else if (tabName === 'orders') document.getElementById('sectionOrders').classList.add('active');
    else if (tabName === 'clients') document.getElementById('sectionClients').classList.add('active');
    else if (tabName === 'system') document.getElementById('sectionSystem').classList.add('active');
}

// Загрузка всех ролей
async function loadRoles() {
    try {
        const res = await fetch(`${API}/sotrudniki/roli`);
        if (res.ok) {
            allRoles = await res.json();
        }
    } catch (e) {
        console.warn('Fallback списки ролей');
        allRoles = [
            { id: 1, nazvanie: 'Администратор' },
            { id: 2, nazvanie: 'Менеджер' },
            { id: 3, nazvanie: 'Сотрудник цеха' },
            { id: 1002, nazvanie: 'Дизайнер' },
            { id: 1003, nazvanie: 'Конструктор' },
            { id: 1004, nazvanie: 'Бухгалтер' },
            { id: 1005, nazvanie: 'Начальник производства' },
            { id: 1006, nazvanie: 'Логист' }
        ];
    }
    populateRoleDropdown(allRoles);
}

function populateRoleDropdown(roles) {
    const select = document.getElementById('newRole');
    if (!select) return;
    select.innerHTML = '';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.nazvanie;
        select.appendChild(opt);
    });
}

// Глобальная загрузка данных всей системы
async function loadAdminDashboard() {
    try {
        const [usersRes, ordersRes, clientsRes, auditRes] = await Promise.all([
            fetch(`${API}/sotrudniki`),
            fetch(`${API}/zakazy`),
            fetch(`${API}/klienty`),
            fetch(`${API}/zhurnalizmenenii`).catch(() => ({ ok: false }))
        ]);

        if (usersRes.ok) {
            allUsers = await usersRes.json();
            renderUsersTable(allUsers);
            document.getElementById('statUsersCount').textContent = allUsers.length;
        }

        if (ordersRes.ok) {
            allOrders = await ordersRes.json();
            renderAdminOrdersTable(allOrders);
            document.getElementById('statOrdersCount').textContent = allOrders.length;
        }

        if (clientsRes.ok) {
            allClients = await clientsRes.json();
            renderAdminClientsTable(allClients);
            document.getElementById('statClientsCount').textContent = allClients.length;
        }

        if (auditRes.ok) {
            allAudit = await auditRes.json();
            renderAdminAuditTable(allAudit);
        }
    } catch (err) {
        console.error(err);
    }
}

/* ==============================================================================
   РАЗДЕЛ 1: ПОЛЬЗОВАТЕЛИ И РОЛИ
   ============================================================================== */
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTable');
    const currentLoggedUser = JSON.parse(localStorage.getItem('user'));
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px;">Пользователи не найдены</td></tr>';
        return;
    }

    users.forEach(u => {
        const isSelf = currentLoggedUser && currentLoggedUser.id === u.id;
        const currentRoleId = u.idRoli || (u.rol ? u.rol.id : 1);

        let roleOptionsHtml = '';
        allRoles.forEach(r => {
            const selected = r.id === currentRoleId ? 'selected' : '';
            roleOptionsHtml += `<option value="${r.id}" ${selected}>${r.nazvanie}</option>`;
        });

        const initials = u.fio ? u.fio.charAt(0).toUpperCase() : 'U';
        const userAvatar = u.foto
            ? `<img src="${u.foto}" style="width:28px; height:28px; border-radius:6px; object-fit:cover; margin-right:8px; vertical-align:middle;">`
            : `<span class="avatar-box" style="width:28px; height:28px; font-size:11px; display:inline-flex; margin-right:8px; vertical-align:middle;">${initials}</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700; color:var(--brand-primary);">#${u.id}</td>
            <td style="font-weight:700;">
                <div style="display:flex; align-items:center;">
                    ${userAvatar}
                    <span>${u.fio}</span>
                    ${isSelf ? '<span class="btn-table-action action-blue" style="font-size:10px; margin-left:6px;">Вы (Суперадмин)</span>' : ''}
                </div>
            </td>
            <td class="mono" style="color:var(--text-secondary);">${u.login}</td>
            <td class="mono">${u.telefon || '—'}</td>
            <td>
                <select class="form-control" style="padding:4px 8px; font-size:12.5px; font-weight:600; width:190px;" 
                        onchange="changeUserRole(${u.id}, this.value, '${u.fio}')">
                    ${roleOptionsHtml}
                </select>
            </td>
            <td>
                <div class="action-row">
                    <button class="btn-table-action action-blue" onclick="openEditUserModal(${u.id})">Изменить</button>
                    ${!isSelf ? `<button class="btn-table-action action-rose" onclick="deleteUser(${u.id}, '${u.fio}')">Удалить</button>` : '<span style="color:var(--text-muted); font-size:12px; margin-left:6px;">Защищён</span>'}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function changeUserRole(userId, newRoleId, userName) {
    const userObj = allUsers.find(u => u.id === userId);
    if (!userObj) return;

    const payload = {
        id: userId,
        fio: userObj.fio,
        telefon: userObj.telefon,
        login: userObj.login,
        parol: userObj.parol || 'admin123',
        idRoli: parseInt(newRoleId)
    };

    try {
        const res = await fetch(`${API}/sotrudniki/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            loadAdminDashboard();
        } else {
            alert('Не удалось изменить роль');
        }
    } catch (e) {
        alert('Ошибка связи с сервером');
    }
}

function filterUsers() {
    const q = document.getElementById('userSearch').value.trim().toLowerCase();
    const filtered = allUsers.filter(u => 
        (u.fio || '').toLowerCase().includes(q) || 
        (u.login || '').toLowerCase().includes(q) || 
        (u.rol?.nazvanie || '').toLowerCase().includes(q)
    );
    renderUsersTable(filtered);
}

function openUserModal() {
    document.getElementById('userModal').classList.add('active');
    document.getElementById('newFio').focus();
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
    document.getElementById('newFio').value = '';
    document.getElementById('newPhone').value = '';
    document.getElementById('newLogin').value = '';
    document.getElementById('newPassword').value = '';
}

async function saveUser(event) {
    event.preventDefault();
    const fio = document.getElementById('newFio').value.trim();
    const phone = document.getElementById('newPhone').value.trim();
    const roleId = parseInt(document.getElementById('newRole').value);
    const login = document.getElementById('newLogin').value.trim();
    const password = document.getElementById('newPassword').value.trim();

    try {
        const res = await fetch(`${API}/sotrudniki`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fio, telefon: phone || null, idRoli: roleId, login, parol: password })
        });
        if (res.ok) {
            closeUserModal();
            loadAdminDashboard();
        } else {
            alert('Ошибка при создании пользователя');
        }
    } catch (e) {
        alert('Ошибка связи с сервером');
    }
}

async function deleteUser(id, fio) {
    if (!confirm(`Удалить сотрудника "${fio}"?`)) return;
    try {
        const res = await fetch(`${API}/sotrudniki/${id}`, { method: 'DELETE' });
        if (res.ok) loadAdminDashboard();
        else alert('Не удалось удалить пользователя');
    } catch (e) {
        alert('Ошибка связи');
    }
}

function openEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editFio').value = user.fio || '';
    document.getElementById('editPhone').value = user.telefon || '';
    document.getElementById('editLogin').value = user.login || '';
    document.getElementById('editPassword').value = '';

    const roleSelect = document.getElementById('editRole');
    roleSelect.innerHTML = '';
    const currentRoleId = user.idRoli || (user.rol ? user.rol.id : 1);
    allRoles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.nazvanie;
        if (r.id === currentRoleId) opt.selected = true;
        roleSelect.appendChild(opt);
    });

    document.getElementById('editUserModal').classList.add('active');
    document.getElementById('editFio').focus();
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('active');
}

async function updateUser(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editUserId').value);
    const fio = document.getElementById('editFio').value.trim();
    const telefon = document.getElementById('editPhone').value.trim();
    const idRoli = parseInt(document.getElementById('editRole').value);
    const login = document.getElementById('editLogin').value.trim();
    const parol = document.getElementById('editPassword').value.trim();

    if (!fio || !login) {
        alert('Заполните ФИО и логин!');
        return;
    }

    const payload = {
        id,
        fio,
        telefon: telefon || null,
        idRoli,
        login,
        parol: parol || null
    };

    try {
        const res = await fetch(`${API}/sotrudniki/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const loggedIn = JSON.parse(localStorage.getItem('user'));
            if (loggedIn && loggedIn.id === id) {
                loggedIn.fio = fio;
                loggedIn.login = login;
                loggedIn.idRoli = idRoli;
                const matchedRole = allRoles.find(r => r.id === idRoli);
                if (matchedRole) loggedIn.rol = matchedRole;
                localStorage.setItem('user', JSON.stringify(loggedIn));
                showUserInfo();
            }

            closeEditUserModal();
            loadAdminDashboard();
        } else {
            alert('Не удалось сохранить изменения профиля сотрудника');
        }
    } catch (e) {
        alert('Ошибка связи с сервером');
    }
}

/* ==============================================================================
   РАЗДЕЛ 2: ГЛОБАЛЬНЫЙ КОНТРОЛЬ ЗАКАЗОВ
   ============================================================================== */
function renderAdminOrdersTable(orders) {
    const tbody = document.getElementById('adminOrdersTable');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px;">Заказов нет</td></tr>';
        return;
    }

    orders.forEach(o => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700;">#${o.id}</td>
            <td style="font-weight:700;">${o.klient?.fioNazvanie ?? '—'}</td>
            <td class="mono" style="font-size:13px;">${o.dataPriema}</td>
            <td class="mono" style="font-weight:700; font-size:13px;">${o.planDataOtgruzki}</td>
            <td>
                <select class="form-control" style="padding:4px 8px; font-size:12px; font-weight:700;" 
                        onchange="changeOrderStatus(${o.id}, this.value)">
                    <option value="в работе" ${o.status === 'в работе' ? 'selected' : ''}>В работе</option>
                    <option value="просрочен" ${o.status === 'просрочен' ? 'selected' : ''}>Просрочен</option>
                    <option value="завершён" ${o.status === 'завершён' ? 'selected' : ''}>Завершён</option>
                </select>
            </td>
            <td>
                <div class="action-row">
                    <a class="btn-table-action action-purple" href="items.html?zakazId=${o.id}">Изделия</a>
                    <a class="btn-table-action action-blue" href="stages.html?zakazId=${o.id}">Маршрут</a>
                    <a class="btn-table-action action-emerald" href="print-order.html?zakazId=${o.id}" target="_blank">Бланк</a>
                    <button class="btn-table-action action-rose" onclick="deleteAdminOrder(${o.id})">Удалить</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function changeOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API}/zakazy/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) alert('Не удалось обновить статус заказа');
    } catch (e) {
        console.error(e);
    }
}

async function deleteAdminOrder(id) {
    if (!confirm(`Административное удаление заказа #${id}. Подтвердить?`)) return;
    try {
        const res = await fetch(`${API}/zakazy/${id}`, { method: 'DELETE' });
        if (res.ok) loadAdminDashboard();
        else alert('Не удалось удалить заказ');
    } catch (e) {
        alert('Ошибка связи');
    }
}

function filterAdminOrders() {
    const q = document.getElementById('adminOrderSearch').value.trim().toLowerCase();
    const filtered = allOrders.filter(o => 
        o.id.toString().includes(q) || 
        (o.klient?.fioNazvanie || '').toLowerCase().includes(q)
    );
    renderAdminOrdersTable(filtered);
}

/* ==============================================================================
   РАЗДЕЛ 3: ВСЕ ЗАКАЗЧИКИ
   ============================================================================== */
function renderAdminClientsTable(clients) {
    const tbody = document.getElementById('adminClientsTable');
    tbody.innerHTML = '';

    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px;">Клиентов нет</td></tr>';
        return;
    }

    clients.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700; color:var(--brand-primary);">#${c.id}</td>
            <td style="font-weight:700;">${c.fioNazvanie}</td>
            <td class="mono">${c.telefon || '—'}</td>
            <td>${c.adresObekta || '—'}</td>
            <td>
                <div class="action-row">
                    <a class="btn-table-action action-emerald" href="order.html?clientId=${c.id}">Заказ</a>
                    <button class="btn-table-action action-blue" onclick="openEditClientModal(${c.id})">Изменить</button>
                    <button class="btn-table-action action-rose" onclick="deleteAdminClient(${c.id})">Удалить</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openEditClientModal(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('editClientId').value = client.id;
    document.getElementById('editClientName').value = client.fioNazvanie || '';
    document.getElementById('editClientPhone').value = client.telefon || '';
    document.getElementById('editClientAddress').value = client.adresObekta || '';

    document.getElementById('editClientModal').classList.add('active');
    document.getElementById('editClientName').focus();
}

function closeEditClientModal() {
    document.getElementById('editClientModal').classList.remove('active');
}

async function updateAdminClient(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editClientId').value);
    const fioNazvanie = document.getElementById('editClientName').value.trim();
    const telefon = document.getElementById('editClientPhone').value.trim();
    const adresObekta = document.getElementById('editClientAddress').value.trim();

    if (!fioNazvanie) {
        alert('Заполните ФИО заказчика или название компании!');
        return;
    }

    const payload = {
        id,
        fioNazvanie,
        telefon: telefon || null,
        adresObekta: adresObekta || null
    };

    try {
        const res = await fetch(`${API}/klienty/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeEditClientModal();
            loadAdminDashboard();
        } else {
            alert('Не удалось обновить данные заказчика');
        }
    } catch (e) {
        alert('Ошибка связи с сервером');
    }
}

async function deleteAdminClient(id) {
    if (!confirm(`Удалить заказчика #${id}?`)) return;
    try {
        const res = await fetch(`${API}/klienty/${id}`, { method: 'DELETE' });
        if (res.ok) loadAdminDashboard();
        else alert('Не удалось удалить заказчика');
    } catch (e) {
        alert('Ошибка связи');
    }
}

function filterAdminClients() {
    const q = document.getElementById('adminClientSearch').value.trim().toLowerCase();
    const filtered = allClients.filter(c => 
        (c.fioNazvanie || '').toLowerCase().includes(q) || 
        (c.telefon || '').toLowerCase().includes(q) || 
        (c.adresObekta || '').toLowerCase().includes(q)
    );
    renderAdminClientsTable(filtered);
}

/* ==============================================================================
   РАЗДЕЛ 4: СИСТЕМНЫЙ АУДИТ
   ============================================================================== */
function renderAdminAuditTable(logs) {
    const tbody = document.getElementById('adminAuditTable');
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:32px;">Записей системного аудита нет</td></tr>';
        return;
    }

    logs.forEach(l => {
        const d = new Date(l.dataIzmenenia);
        const dateStr = d.toLocaleString('ru-RU');
        const author = l.sotrudnik?.fio ?? `Сотрудник #${l.idSotrudnika}`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700;">#${l.idZakaza}</td>
            <td class="mono" style="font-size:12.5px; color:var(--text-secondary);">${dateStr}</td>
            <td style="font-weight:600; color:var(--brand-primary);">${author}</td>
            <td style="font-size:13.5px;">${l.opisanieIzmenenia}</td>
        `;
        tbody.appendChild(row);
    });
}