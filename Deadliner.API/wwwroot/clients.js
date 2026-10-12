const API = 'http://localhost:5216/api';

let allClients = [];

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    loadClients();
});

// Загрузка всех клиентов с сервера
async function loadClients() {
    try {
        const response = await fetch(`${API}/klienty`);
        if (!response.ok) throw new Error('Ошибка загрузки клиентов');

        allClients = await response.json();
        renderClients(allClients);
    } catch (err) {
        console.error(err);
        document.getElementById('clientsTable').innerHTML = 
            '<tr><td colspan="5" style="text-align:center; color:var(--status-red-text); padding:32px;">Ошибка соединения с сервером базы данных</td></tr>';
    }
}

// Отрисовка таблицы заказчиков
function renderClients(clients) {
    const tbody = document.getElementById('clientsTable');
    const countEl = document.getElementById('clientsCount');
    tbody.innerHTML = '';

    countEl.textContent = `Всего заказчиков: ${clients.length}`;

    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); padding:32px;">Заказчиков по заданному запросу не найдено</td></tr>';
        return;
    }

    clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700; color:var(--brand-primary);">#${client.id}</td>
            <td style="font-weight:700; font-size:14px;">${client.fioNazvanie}</td>
            <td class="mono" style="color:var(--text-secondary); font-size:13px;">${client.telefon || '—'}</td>
            <td style="color:var(--text-secondary); font-size:13.5px;">${client.adresObekta || '—'}</td>
            <td>
                <div class="action-row">
                    <a class="btn-table-action action-emerald" href="order.html?clientId=${client.id}">Создать заказ</a>
                    <button class="btn-table-action action-blue manager-only" onclick="openEditModal(${client.id})">Изменить</button>
                    <button class="btn-table-action action-rose manager-only" onclick="deleteClient(${client.id})">Удалить</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    const user = JSON.parse(localStorage.getItem('user'));
    applyRoleRules(user);
}

// Живая фильтрация при вводе в поле поиска
function filterClients() {
    const query = document.getElementById('clientSearch').value.trim().toLowerCase();

    const filtered = allClients.filter(c => {
        const name = (c.fioNazvanie || '').toLowerCase();
        const phone = (c.telefon || '').toLowerCase();
        const address = (c.adresObekta || '').toLowerCase();
        const idStr = c.id.toString();

        return name.includes(query) || phone.includes(query) || address.includes(query) || idStr.includes(query);
    });

    renderClients(filtered);
}

// Управление модальным окном
function openClientModal() {
    document.getElementById('clientModal').classList.add('active');
    document.getElementById('clientName').focus();
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('active');
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientAddress').value = '';
}

// Управление модальным окном редактирования
function openEditModal(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('editClientId').value = client.id;
    document.getElementById('editClientName').value = client.fioNazvanie || '';
    document.getElementById('editClientPhone').value = client.telefon || '';
    document.getElementById('editClientAddress').value = client.adresObekta || '';

    document.getElementById('editClientModal').classList.add('active');
    document.getElementById('editClientName').focus();
}

function closeEditModal() {
    document.getElementById('editClientModal').classList.remove('active');
}

async function updateClient(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editClientId').value);
    const fioNazvanie = document.getElementById('editClientName').value.trim();
    const telefon = document.getElementById('editClientPhone').value.trim();
    const adresObekta = document.getElementById('editClientAddress').value.trim();

    if (!fioNazvanie) {
        showToast('Заполните ФИО заказчика или название компании!', 'warning');
        return;
    }

    const payload = {
        id,
        fioNazvanie,
        telefon: telefon || null,
        adresObekta: adresObekta || null
    };

    try {
        const response = await fetch(`${API}/klienty/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('Данные заказчика успешно обновлены', 'success');
            closeEditModal();
            loadClients();
        } else {
            showToast('Не удалось обновить данные заказчика', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Ошибка связи с сервером', 'error');
    }
}

// Сохранение нового клиента на сервере
async function saveClient(event) {
    event.preventDefault();

    const fioNazvanie = document.getElementById('clientName').value.trim();
    const telefon = document.getElementById('clientPhone').value.trim();
    const adresObekta = document.getElementById('clientAddress').value.trim();

    if (!fioNazvanie) {
        showToast('Укажите ФИО или название компании!', 'warning');
        return;
    }

    const payload = {
        fioNazvanie: fioNazvanie,
        telefon: telefon || null,
        adresObekta: adresObekta || null
    };

    try {
        const response = await fetch(`${API}/klienty`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('Заказчик успешно добавлен в систему!', 'success');
            closeClientModal();
            loadClients();
        } else {
            showToast('Не удалось сохранить заказчика', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Ошибка связи с сервером', 'error');
    }
}

// Удаление клиента
async function deleteClient(id) {
    const confirmed = await showConfirm(
        'Удаление заказчика',
        `Вы действительно хотите удалить заказчика #${id}? Связанные с ним заказы могут быть затронуты.`
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`${API}/klienty/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast(`Заказчик #${id} успешно удалён`, 'success');
            loadClients();
        } else {
            showToast('Не удалось удалить заказчика (возможно, к нему уже привязаны действующие заказы)', 'error');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
}