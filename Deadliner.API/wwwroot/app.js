const API = 'http://localhost:5216/api';

let allOrders = [];       // Все загруженные заказы
let sortColumn = null;    // Текущая колонка сортировки
let sortAsc = true;       // Направление сортировки

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    loadOrders();
});

// Загрузка всех заказов с сервера
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

        // Обновляем виджеты оперативной статистики
        updateMetrics(allOrders);

        applyFilters();
    } catch (err) {
        console.error(err);
        document.getElementById('ordersTable').innerHTML = 
            '<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:32px;">Ошибка соединения с сервером базы данных</td></tr>';
    }
}

// Расчет оперативных показателей в карточках
function updateMetrics(orders) {
    const statTotal = document.getElementById('statTotal');
    const statGreen = document.getElementById('statGreen');
    const statYellow = document.getElementById('statYellow');
    const statRed = document.getElementById('statRed');

    if (!statTotal) return;

    statTotal.textContent = orders.length;
    statGreen.textContent = orders.filter(o => o.colorClass === 'green' && o.status !== 'завершён').length;
    statYellow.textContent = orders.filter(o => o.colorClass === 'yellow' && o.status !== 'завершён').length;
    statRed.textContent = orders.filter(o => o.colorClass === 'red' || o.status === 'просрочен').length;
}

// Быстрое переключение по вкладкам (Все / В работе / Просроченные / Завершённые)
function setQuickTab(status, tabBtn) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.value = status === 'all' ? '' : status;
    }
    applyFilters();
}

// Применение фильтрации, поиска и сортировки
function applyFilters() {
    const searchVal = document.getElementById('searchInput').value.trim().toLowerCase();
    const statusVal = document.getElementById('statusFilter')?.value ?? '';
    const urgencyVal = document.getElementById('urgencyFilter')?.value ?? '';

    // 1. Фильтрация
    let filtered = allOrders.filter(order => {
        const clientName = (order.klient?.fioNazvanie ?? '').toLowerCase();
        const orderIdStr = order.id.toString();

        const matchesSearch = !searchVal || clientName.includes(searchVal) || orderIdStr.includes(searchVal);
        const matchesStatus = !statusVal || order.status === statusVal;
        const matchesUrgency = !urgencyVal || order.colorClass === urgencyVal;

        return matchesSearch && matchesStatus && matchesUrgency;
    });

    // 2. Сортировка
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

    // 3. Отрисовка таблицы
    renderTable(filtered);
}

// Отрисовка строк в таблице
function renderTable(orders) {
    const tbody = document.getElementById('ordersTable');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary); padding:40px; font-weight:500;">Заказов по заданным критериям не найдено</td></tr>';
        return;
    }

    orders.forEach(order => {
        const daysText = order.daysLeft < 0 
            ? `Просрочен на ${Math.abs(order.daysLeft)} дн.` 
            : `${order.daysLeft} дн.`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:600; color:var(--text-main);">#${order.id}</td>
            <td style="font-weight:600;">${order.klient?.fioNazvanie ?? '—'}</td>
            <td class="mono" style="color:var(--text-secondary); font-size:13px;">${order.dataPriema}</td>
            <td class="mono" style="font-weight:600; font-size:13px;">${order.planDataOtgruzki}</td>
            <td>
                <span class="urgency-indicator urgency-${order.colorClass}">
                    <span class="dot"></span>
                    <span>${daysText}</span>
                </span>
            </td>
            <td>
                <span style="font-size:13px; font-weight:500; color:var(--text-secondary);">${order.status}</span>
            </td>
            <td>
                <div class="action-row">
                    <a class="btn-table-action action-purple" href="items.html?zakazId=${order.id}">Изделия</a>
                    <a class="btn-table-action action-blue" href="stages.html?zakazId=${order.id}">Маршрут</a>
                    <a class="btn-table-action action-slate" href="audit.html?zakazId=${order.id}">Аудит</a>
                    <a class="btn-table-action action-emerald" href="print-order.html?zakazId=${order.id}" target="_blank">Бланк</a>
                    <button class="btn-table-action action-rose manager-only" onclick="deleteOrder(${order.id})">Удалить</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    const user = JSON.parse(localStorage.getItem('user'));
    applyRoleRules(user);
}

// Сортировка по столбцам
function sortTable(column) {
    if (sortColumn === column) {
        sortAsc = !sortAsc;
    } else {
        sortColumn = column;
        sortAsc = true;
    }
    applyFilters();
}

// Удаление заказа
async function deleteOrder(id) {
    if (!confirm('Вы действительно хотите удалить данный заказ?')) return;
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

// Экспорт в CSV без эмодзи
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
    link.download = `DeadLiner_Orders_${dateStr}.csv`;
    link.click();
}