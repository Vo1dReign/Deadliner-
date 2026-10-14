const API = 'http://localhost:5216/api';

let activeOrdersData = [];
let archiveOrdersData = [];
let currentReportTab = 'active';

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);

    loadReportStats();
    loadActiveOrders();
});

// Загрузка сравнительной аналитики (текущий vs прошлый месяц)
async function loadReportStats() {
    try {
        const res = await fetch(`${API}/zakazy/stats`);
        if (!res.ok) throw new Error('Ошибка загрузки статистики');

        const stats = await res.json();

        // Верхние карточки
        document.getElementById('totalCount').textContent = stats.totalOrders;
        document.getElementById('doneCount').textContent = stats.shippedOrders;
        document.getElementById('overdueCount').textContent = stats.overdueOrders;

        // Текущий месяц
        if (stats.currentMonth) {
            document.getElementById('curMonthTitle').textContent = `Текущий: ${stats.currentMonth.name}`;
            const curRateEl = document.getElementById('curAdherenceRate');
            curRateEl.textContent = `${stats.currentMonth.adherenceRate}%`;
            curRateEl.className = `kpi-adherence-rate ${getRateClass(stats.currentMonth.adherenceRate)}`;

            document.getElementById('curTotal').textContent = stats.currentMonth.total;
            document.getElementById('curOnTime').textContent = stats.currentMonth.onTime;
            document.getElementById('curOverdue').textContent = stats.currentMonth.overdue;
        }

        // Предыдущий месяц
        if (stats.prevMonth) {
            document.getElementById('prevMonthTitle').textContent = `Прошлый: ${stats.prevMonth.name}`;
            const prevRateEl = document.getElementById('prevAdherenceRate');
            prevRateEl.textContent = `${stats.prevMonth.adherenceRate}%`;
            prevRateEl.className = `kpi-adherence-rate ${getRateClass(stats.prevMonth.adherenceRate)}`;

            document.getElementById('prevTotal').textContent = stats.prevMonth.total;
            document.getElementById('prevOnTime').textContent = stats.prevMonth.onTime;
            document.getElementById('prevOverdue').textContent = stats.prevMonth.overdue;
        }
    } catch (err) {
        console.error('Ошибка загрузки KPI:', err);
    }
}

function getRateClass(rate) {
    if (rate >= 90) return 'good';
    if (rate >= 75) return 'warning';
    return 'danger';
}

// Загрузка текущих заказов
async function loadActiveOrders() {
    try {
        const response = await fetch(`${API}/zakazy`);
        if (!response.ok) throw new Error('Ошибка загрузки заказов');

        activeOrdersData = await response.json();
        if (currentReportTab === 'active') {
            renderActiveOrdersTable(activeOrdersData);
        }
    } catch (err) {
        console.error(err);
        document.getElementById('reportsTable').innerHTML = 
            '<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:28px;">Ошибка загрузки заказов</td></tr>';
    }
}

// Загрузка архива отгруженных заказов
async function loadArchiveOrders() {
    try {
        const response = await fetch(`${API}/zakazy/history`);
        if (!response.ok) throw new Error('Ошибка загрузки архива');

        archiveOrdersData = await response.json();
        if (currentReportTab === 'archive') {
            renderArchiveOrdersTable(archiveOrdersData);
        }
    } catch (err) {
        console.error(err);
        document.getElementById('reportsTable').innerHTML = 
            '<tr><td colspan="7" style="text-align:center; color:#ef4444; padding:28px;">Ошибка загрузки архива</td></tr>';
    }
}

function switchReportTab(tab) {
    currentReportTab = tab;

    const tabActive = document.getElementById('tabActiveOrders');
    const tabArchive = document.getElementById('tabArchiveOrders');

    if (tab === 'active') {
        tabActive.classList.add('active');
        tabArchive.classList.remove('active');
        renderActiveOrdersTable(activeOrdersData);
    } else {
        tabArchive.classList.add('active');
        tabActive.classList.remove('active');
        if (archiveOrdersData.length === 0) {
            loadArchiveOrders();
        } else {
            renderArchiveOrdersTable(archiveOrdersData);
        }
    }
}

function renderActiveOrdersTable(orders) {
    const thead = document.getElementById('reportsTableHead');
    thead.innerHTML = `
        <tr>
            <th style="width: 80px;">Номер</th>
            <th>Контрагент (клиент)</th>
            <th style="width: 150px;">Дата приёма</th>
            <th style="width: 160px;">План отгрузки</th>
            <th style="width: 160px;">Остаток дней</th>
            <th style="width: 150px;">Текущий статус</th>
        </tr>
    `;

    const tbody = document.getElementById('reportsTable');
    tbody.innerHTML = '';

    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px;">Заказы в производстве отсутствуют</td></tr>';
        return;
    }

    orders.forEach(order => {
        const today = new Date();
        const shipDate = new Date(order.planDataOtgruzki);
        const daysLeft = Math.ceil((shipDate - today) / (1000 * 60 * 60 * 24));

        let badgeClass = 'yellow';
        if (order.status === 'завершён' || order.status === 'отгружен') badgeClass = 'green';
        if (order.status === 'просрочен' || daysLeft < 0) badgeClass = 'red';

        const daysText = (order.status === 'завершён' || order.status === 'отгружен')
            ? 'Закрыт'
            : (daysLeft < 0 ? `Просрочен на ${Math.abs(daysLeft)} дн.` : `${daysLeft} дн.`);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700;">#${order.id}</td>
            <td style="font-weight:600;">${escapeHtml(order.klient?.fioNazvanie ?? '—')}</td>
            <td class="mono" style="color:var(--text-secondary);">${order.dataPriema}</td>
            <td class="mono" style="font-weight:600;">${order.planDataOtgruzki}</td>
            <td>
                <span class="urgency-indicator urgency-${badgeClass}">
                    <span class="dot"></span>
                    <span>${daysText}</span>
                </span>
            </td>
            <td><span style="font-weight:600; color:var(--text-secondary);">${order.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function renderArchiveOrdersTable(orders) {
    const thead = document.getElementById('reportsTableHead');
    thead.innerHTML = `
        <tr>
            <th style="width: 80px;">Номер</th>
            <th>Клиент / Заказчик</th>
            <th style="width: 130px;">Принят</th>
            <th style="width: 130px;">План. срок</th>
            <th style="width: 130px;">Факт отгрузки</th>
            <th style="width: 160px;">Соблюдение срока</th>
            <th style="width: 140px;">Предоплата (${BEL_RUBLE_SVG})</th>
        </tr>
    `;

    const tbody = document.getElementById('reportsTable');
    tbody.innerHTML = '';

    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px;">В архиве пока нет отгруженных заказов</td></tr>';
        return;
    }

    orders.forEach(order => {
        let deadlineBadge;
        if (order.wasOnTime) {
            deadlineBadge = `
                <span class="urgency-indicator urgency-green">
                    <span class="dot"></span>
                    <span>Отгружен в срок</span>
                </span>
            `;
        } else {
            deadlineBadge = `
                <span class="urgency-indicator urgency-red">
                    <span class="dot"></span>
                    <span>Задержка ${order.delayDays} дн.</span>
                </span>
            `;
        }

        const factDateFormatted = order.factDataOtgruzki 
            ? formatDateDisplay(order.factDataOtgruzki)
            : 'Сегодня';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700;">#${order.id}</td>
            <td style="font-weight:600;">${escapeHtml(order.klientFio)}</td>
            <td class="mono" style="color:var(--text-secondary);">${formatDateDisplay(order.dataPriema)}</td>
            <td class="mono" style="color:var(--text-secondary);">${formatDateDisplay(order.planDataOtgruzki)}</td>
            <td class="mono" style="font-weight:700; color:var(--text-main);">${factDateFormatted}</td>
            <td>${deadlineBadge}</td>
            <td class="mono" style="font-weight:600;">${formatByn(order.summaPredoplaty)}</td>
        `;
        tbody.appendChild(row);
    });
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}