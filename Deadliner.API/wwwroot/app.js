const API = 'http://localhost:5216/api';

let allOrders = [];
let sortColumn = null; 
let sortAsc = true;      

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    loadOrders();
});

async function loadOrders() {
    try {
        const response = await fetch(`${API}/zakazy`);
        if (!response.ok) throw new Error('Ошибка загрузки заказов');

        const rawOrders = await response.json();
        const thresh = JSON.parse(localStorage.getItem('customThresholds')) || { redDays: 2, yellowFrom: 3, yellowTo: 7 };
        const today = new Date();

        allOrders = rawOrders.map(order => {
            const shipDate = new Date(order.planDataOtgruzki);
            const daysLeft = Math.ceil((shipDate - today) / (1000 * 60 * 60 * 24));

            let colorClass = 'green';
            if (daysLeft <= thresh.redDays) {
                colorClass = 'red';
            } else if (daysLeft >= thresh.yellowFrom && daysLeft <= thresh.yellowTo) {
                colorClass = 'yellow';
            }

            return {
                ...order,
                daysLeft: daysLeft,
                colorClass: colorClass
            };
        });

        applyFilters();
    } catch (err) {
        console.error(err);
        document.getElementById('ordersTable').innerHTML = 
            '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Ошибка соединения с сервером</td></tr>';
    }
}

function applyFilters() {
    const searchVal = document.getElementById('searchInput').value.trim().toLowerCase();
    const statusVal = document.getElementById('statusFilter').value;
    const urgencyVal = document.getElementById('urgencyFilter').value;

    let filtered = allOrders.filter(order => {
        const clientName = (order.klient?.fioNazvanie ?? '').toLowerCase();
        const orderIdStr = order.id.toString();

        const matchesSearch = !searchVal || clientName.includes(searchVal) || orderIdStr.includes(searchVal);
        const matchesStatus = !statusVal || order.status === statusVal;
        const matchesUrgency = !urgencyVal || order.colorClass === urgencyVal;

        return matchesSearch && matchesStatus && matchesUrgency;
    });

    if (sortColumn) {
        filtered.sort((a, b) => {
            let valA, valB;

            if (sortColumn === 'klient') {
                valA = a.klient?.fioNazvanie ?? '';
                valB = b.klient?.fioNazvanie ?? '';
            } else {
                valA = a[sortColumn];
                valB = b[sortColumn];
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    document.getElementById('ordersCount').textContent = `Показано: ${filtered.length} из ${allOrders.length} заказов`;

    renderTable(filtered);
}

function renderTable(orders) {
    const tbody = document.getElementById('ordersTable');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#aab4d0; padding:24px;">Заказов по заданным критериям не найдено</td></tr>';
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');
        row.className = order.colorClass;
        row.innerHTML = `
            <td><strong>#${order.id}</strong></td>
            <td>${order.klient?.fioNazvanie ?? '-'}</td>
            <td>${order.dataPriema}</td>
            <td>${order.planDataOtgruzki}</td>
            <td style="font-weight:bold;">${order.daysLeft} дн.</td>
            <td>${order.status}</td>
            <td style="display:flex; gap:8px;">
                <a class="btn" href="items.html?zakazId=${order.id}">Изделия</a>
                <a class="btn" href="stages.html?zakazId=${order.id}">Этапы</a>
                <a class="btn" href="audit.html?zakazId=${order.id}">История</a>
                <a class="btn" href="print-order.html?zakazId=${order.id}" target="_blank">Наряд</a>
                <button class="btn btn-danger manager-only" onclick="deleteOrder(${order.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const user = JSON.parse(localStorage.getItem('user'));
    applyRoleRules(user);
}

function sortTable(column) {
    if (sortColumn === column) {
        sortAsc = !sortAsc;
    } else {
        sortColumn = column;
        sortAsc = true;
    }
    applyFilters();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('urgencyFilter').value = '';
    sortColumn = null;
    applyFilters();
}

async function deleteOrder(id) {
    if (!confirm('Вы уверены, что хотите удалить заказ?')) return;
    try {
        const res = await fetch(`${API}/zakazy/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadOrders();
        } else {
            alert('Ошибка при удалении заказа');
        }
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}

function openCreate() {
    window.location.href = 'order.html';
}

function exportToCSV() {
    if (!allOrders || allOrders.length === 0) {
        alert('Нет данных для выгрузки');
        return;
    }

    let csvContent = "\uFEFFНомер заказа;Клиент;Дата приёма;Плановая отгрузка;Осталось дней;Статус\r\n";

    allOrders.forEach(o => {
        const client = (o.klient?.fioNazvanie ?? '—').replace(/;/g, ' ');
        csvContent += `${o.id};"${client}";${o.dataPriema};${o.planDataOtgruzki};${o.daysLeft};${o.status}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.download = `Реестр_заказов_Deadliner_${dateStr}.csv`;
    link.click();
}