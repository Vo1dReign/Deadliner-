const API = 'http://localhost:5216/api';

const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    const user = showUserInfo();
    applyRoleRules(user);

    await loadClient();
    await loadManager();

    if (editId) {
        initEditMode(editId);
    }
});

async function loadClient() {
    const response = await fetch(`${API}/klienty`);
    const clients = await response.json();

    const select = document.getElementById('clientId');
    clients.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.fioNazvanie;
        select.appendChild(option);
    });

    const preselected = urlParams.get('clientId');
    if (preselected && !editId) {
        select.value = preselected;
    }
}

async function loadManager() {
    const response = await fetch(`${API}/sotrudniki`);
    const staff = await response.json();

    const select = document.getElementById('managerId');
    staff.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.fio;
        select.appendChild(option);
    });

    if (!editId) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.id) {
            select.value = user.id;
        }
    }
}

async function initEditMode(id) {
    document.title = `DeadLiner — Редактирование заказа #${id}`;
    document.getElementById('breadcrumbAction').textContent = `Редактирование заказа #${id}`;
    document.getElementById('pageHeading').textContent = `Редактирование заказа #${id}`;
    document.getElementById('pageSubheading').textContent = 'Корректировка параметров наряда, дедлайна отгрузки и статуса';
    document.getElementById('submitOrderBtn').textContent = 'Сохранить изменения в заказе';

    document.getElementById('statusGroup').style.display = 'block';
    document.getElementById('noteGroup').style.display = 'block';

    try {
        const res = await fetch(`${API}/zakazy/${id}`);
        if (!res.ok) throw new Error('Заказ не найден');

        const order = await res.json();
        document.getElementById('clientId').value = order.idKlienta;
        document.getElementById('managerId').value = order.idMenedzhera;
        document.getElementById('prepayment').value = order.summaPredoplaty ?? 0;
        document.getElementById('shipDate').value = order.planDataOtgruzki;
        document.getElementById('orderStatus').value = order.status;
    } catch (err) {
        showToast('Не удалось загрузить данные заказа для редактирования', 'error');
    }
}

async function saveOrder() {
    if (editId) {
        await updateOrder(editId);
    } else {
        await createOrder();
    }
}

async function createOrder() {
    const clientId = document.getElementById('clientId').value;
    const managerId = document.getElementById('managerId').value;
    const prepayment = document.getElementById('prepayment').value;
    const shipDate = document.getElementById('shipDate').value;

    if (!clientId || !managerId || !shipDate) {
        showToast('Заполните все обязательные поля!', 'warning');
        return;
    }

    const order = {
        idKlienta: parseInt(clientId),
        idMenedzhera: parseInt(managerId),
        summaPredoplaty: parseFloat(prepayment) || 0,
        planDataOtgruzki: shipDate,
        status: 'в работе'
    };

    try {
        const response = await fetch(`${API}/zakazy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });

        if (response.ok) {
            const created = await response.json();
            showToast('Заказ успешно оформлен и запущен в производство!', 'success');
            setTimeout(() => {
                window.location.href = `items.html?zakazId=${created.id}`;
            }, 1000);
        } else {
            showToast('Ошибка при создании заказа', 'error');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
}

async function updateOrder(id) {
    const clientId = document.getElementById('clientId').value;
    const managerId = document.getElementById('managerId').value;
    const prepayment = document.getElementById('prepayment').value;
    const shipDate = document.getElementById('shipDate').value;
    const status = document.getElementById('orderStatus').value;
    const note = document.getElementById('auditNote').value.trim();

    if (!clientId || !managerId || !shipDate) {
        showToast('Заполните все обязательные поля!', 'warning');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    const payload = {
        idKlienta: parseInt(clientId),
        idMenedzhera: parseInt(managerId),
        summaPredoplaty: parseFloat(prepayment) || 0,
        planDataOtgruzki: shipDate,
        status: status,
        sotrudnikId: user?.id ?? 1,
        note: note
    };

    try {
        const response = await fetch(`${API}/zakazy/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(`Заказ #${id} успешно обновлён`, 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            showToast('Ошибка при сохранении изменений заказа', 'error');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
}