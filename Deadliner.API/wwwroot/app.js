const API = 'http://localhost:5216/api';

let allOrders = [];          // Все загруженные заказы
let sortColumn = null;       // Текущая колонка сортировки
let sortAsc = true;          // Направление сортировки
let isSupervisorScope = false; // Режим отображения задач (личные или все по цеху)

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    loadOrders();
    initTasksWidget(user);
});

// ==========================================================================
// 1. ВИДЖЕТ МИНИ-ДЕДЛАЙНОВ И ПЕРСОНАЛЬНЫХ ЗАДАЧ
// ==========================================================================

function initTasksWidget(user) {
    if (!user) return;

    const isSupervisor = user.idRoli === 1 || (user.rol && user.rol.nazvanie && user.rol.nazvanie.toLowerCase().includes('начальник'));
    const toggleGroup = document.getElementById('supervisorToggleGroup');

    if (isSupervisor && toggleGroup) {
        toggleGroup.style.display = 'inline-flex';
    }

    loadMyTasks(isSupervisorScope);
}

function switchTaskScope(scopeAll) {
    isSupervisorScope = scopeAll;

    const btnMy = document.getElementById('btnMyTasks');
    const btnAll = document.getElementById('btnAllTasks');
    const widgetTitle = document.getElementById('tasksWidgetTitle');

    if (btnMy && btnAll) {
        if (scopeAll) {
            btnMy.classList.remove('active');
            btnAll.classList.add('active');
            if (widgetTitle) widgetTitle.textContent = 'Все активные этапы цеха и мини-дедлайны';
        } else {
            btnAll.classList.remove('active');
            btnMy.classList.add('active');
            if (widgetTitle) widgetTitle.textContent = 'Мои задачи и мини-дедлайны';
        }
    }

    loadMyTasks(isSupervisorScope);
}

async function loadMyTasks(allForSupervisor = false) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const grid = document.getElementById('tasksGrid');
    const badge = document.getElementById('tasksCountBadge');
    if (!grid) return;

    try {
        const res = await fetch(`${API}/etapyzakaza/my/${user.id}?allForSupervisor=${allForSupervisor}`);
        if (!res.ok) throw new Error('Ошибка загрузки задач');

        const tasks = await res.json();
        if (badge) badge.textContent = `${tasks.length} ${getNoun(tasks.length, 'задача', 'задачи', 'задач')}`;

        if (!tasks || tasks.length === 0) {
            grid.innerHTML = `
                <div class="tasks-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <div>В данный момент нет активных технологических задач в графике.</div>
                    <div style="font-size: 12px; margin-top: 4px; color: #94a3b8;">Все назначенные этапы выполнены в срок.</div>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        tasks.forEach(t => {
            let urgencyClass = 'green';
            let badgeText = `до ${formatDateDisplay(t.planData)} (${t.daysLeft} дн.)`;
            let badgeStyle = 'green';

            if (t.daysLeft < 0) {
                urgencyClass = 'red';
                badgeStyle = 'red';
                badgeText = `Просрочен на ${Math.abs(t.daysLeft)} дн.`;
            } else if (t.daysLeft <= 2) {
                urgencyClass = 'yellow';
                badgeStyle = 'yellow';
                badgeText = `Срок горит (${t.daysLeft === 0 ? 'сегодня' : t.daysLeft + ' дн.'})`;
            }

            const assigneeBadge = t.sotrudnikFio !== 'Не назначен'
                ? `<span style="font-weight:600; color:var(--text-main);">${escapeHtml(t.sotrudnikFio)}</span>`
                : `<span style="color:#d97706; font-weight:600;">Не назначен (роль: ${t.rolNazvanie})</span>`;

            const card = document.createElement('div');
            card.className = `task-card urgency-${urgencyClass}`;
            card.innerHTML = `
                <div>
                    <div class="task-card-header">
                        <a href="stages.html?zakazId=${t.idZakaza}" class="task-order-pill">Заказ #${t.zakazNomer}</a>
                        <span class="task-deadline-badge ${badgeStyle}">
                            <span class="dot"></span>
                            <span>${badgeText}</span>
                        </span>
                    </div>

                    <div style="margin-top: 8px;">
                        <div class="task-stage-name">${escapeHtml(t.etapNazvanie)}</div>
                    </div>

                    <div class="task-meta-row" style="margin-top: 8px;">
                        <span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            Заказчик: ${escapeHtml(t.klientFio)}
                        </span>
                        <span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
                            Исполнитель: ${assigneeBadge}
                        </span>
                        <span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Мини-дедлайн: ${formatDateDisplay(t.planData)} (отгрузка заказа: ${formatDateDisplay(t.planDataOtgruzki)})
                        </span>
                    </div>
                </div>

                <div class="task-actions">
                    ${t.canComplete ? `
                        <button class="btn-task-complete" onclick="completeTaskFromWidget(${t.id}, '${escapeHtml(t.etapNazvanie)}', ${t.zakazNomer})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>
                            Отметить выполнение
                        </button>
                    ` : `
                        <button class="btn-task-complete" disabled title="Выполнение доступно только для роли: ${t.rolNazvanie}">
                            Только для: ${t.rolNazvanie}
                        </button>
                    `}
                    <a href="stages.html?zakazId=${t.idZakaza}" class="btn-task-link" title="Перейти в технологический маршрут заказа">
                        Маршрут
                    </a>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<div class="tasks-empty" style="color:var(--status-red);">Не удалось загрузить персональные задачи</div>';
    }
}

async function completeTaskFromWidget(stageId, stageName, orderId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        showToast('Необходимо авторизоваться', 'warning');
        return;
    }

    const confirmed = await showConfirm(
        'Выполнение этапа',
        `Вы подтверждаете завершение технологического этапа «${stageName}» по заказу #${orderId}? Действие будет зафиксировано в журнале аудита.`,
        { confirmText: 'Завершить этап', isDanger: false, isInfo: true }
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/etapyzakaza/${stageId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sotrudnikId: user.id })
        });

        if (res.ok) {
            const data = await res.json();
            showToast(`Этап «${stageName}» успешно выполнен! (${data.deadlineResult})`, 'success');
            loadMyTasks(isSupervisorScope);
            loadOrders();
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || 'Ошибка при завершении этапа', 'error', 'Отказ');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error', 'Сеть');
    }
}

// ==========================================================================
// 2. РЕЕСТР ЗАКАЗОВ В ПРОИЗВОДСТВЕ
// ==========================================================================

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

function updateMetrics(orders) {
    const statTotal = document.getElementById('statTotal');
    const statGreen = document.getElementById('statGreen');
    const statYellow = document.getElementById('statYellow');
    const statRed = document.getElementById('statRed');

    if (!statTotal) return;

    statTotal.textContent = orders.length;
    statGreen.textContent = orders.filter(o => o.colorClass === 'green' && o.status !== 'завершён' && o.status !== 'отгружен').length;
    statYellow.textContent = orders.filter(o => o.colorClass === 'yellow' && o.status !== 'завершён' && o.status !== 'отгружен').length;
    statRed.textContent = orders.filter(o => o.colorClass === 'red' || o.status === 'просрочен').length;
}

function setQuickTab(status, tabBtn) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.value = status === 'all' ? '' : status;
    }
    applyFilters();
}

function applyFilters() {
    const searchVal = document.getElementById('searchInput').value.trim().toLowerCase();
    const statusVal = document.getElementById('statusFilter')?.value ?? '';
    const urgencyVal = document.getElementById('urgencyFilter')?.value ?? '';

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

    renderTable(filtered);
}

function renderTable(orders) {
    const tbody = document.getElementById('ordersTable');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary); padding:40px; font-weight:500;">Заказов по заданным критериям не найдено</td></tr>';
        return;
    }

    orders.forEach(order => {
        const isShipped = order.status === 'отгружен' || order.status === 'завершён';
        const daysText = isShipped
            ? 'Закрыт'
            : (order.daysLeft < 0 ? `Просрочен на ${Math.abs(order.daysLeft)} дн.` : `${order.daysLeft} дн.`);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:600; color:var(--text-main);">#${order.id}</td>
            <td style="font-weight:600;">${escapeHtml(order.klient?.fioNazvanie ?? '—')}</td>
            <td class="mono" style="color:var(--text-secondary); font-size:13px;">${order.dataPriema}</td>
            <td class="mono" style="font-weight:600; font-size:13px;">${order.planDataOtgruzki}</td>
            <td>
                <span class="urgency-indicator urgency-${isShipped ? 'green' : order.colorClass}">
                    <span class="dot"></span>
                    <span>${daysText}</span>
                </span>
            </td>
            <td>
                <span style="font-size:13px; font-weight:600; color:${getStatusColor(order.status)};">${order.status}</span>
            </td>
            <td>
                <div class="action-row">
                    <a class="btn-table-action action-purple" href="items.html?zakazId=${order.id}">Изделия</a>
                    <a class="btn-table-action action-blue" href="stages.html?zakazId=${order.id}">Маршрут</a>
                    <a class="btn-table-action action-slate" href="audit.html?zakazId=${order.id}">Аудит</a>
                    <a class="btn-table-action action-emerald" href="print-order.html?zakazId=${order.id}" target="_blank">Бланк</a>
                    ${(order.status === 'готов к отгрузке' || order.status === 'в работе') ? `
                        <button class="btn-table-action action-emerald" onclick="shipOrder(${order.id}, '${escapeHtml(order.klient?.fioNazvanie ?? '')}')">Отгрузить</button>
                    ` : ''}
                    <button class="btn-table-action action-rose admin-only" onclick="deleteOrder(${order.id})">Удалить</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    const user = JSON.parse(localStorage.getItem('user'));
    applyRoleRules(user);
}

function getStatusColor(status) {
    if (status === 'готов к отгрузке') return 'var(--brand-primary)';
    if (status === 'отгружен' || status === 'завершён') return 'var(--status-green)';
    if (status === 'просрочен') return 'var(--status-red)';
    return 'var(--text-secondary)';
}

async function shipOrder(orderId, clientName) {
    const user = JSON.parse(localStorage.getItem('user'));
    const confirmed = await showConfirm(
        'Отгрузка готовой продукции',
        `Подтвердить отгрузку заказа #${orderId} клиенту «${clientName}»? Статус заказа будет переведён в «отгружен», факт. дата будет зафиксирована сегодня.`,
        { confirmText: 'Отгрузить заказ', isInfo: true }
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/zakazy/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'отгружен', sotrudnikId: user?.id ?? 1 })
        });

        if (res.ok) {
            showToast(`Заказ #${orderId} успешно отгружен клиенту!`, 'success');
            loadOrders();
            loadMyTasks(isSupervisorScope);
        } else {
            showToast('Не удалось обновить статус заказа', 'error');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
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

async function deleteOrder(id) {
    const confirmed = await showConfirm(
        'Удаление заказа',
        `Вы действительно хотите безвозвратно удалить заказ #${id}? Все связанные технологические этапы и изделия будут удалены.`
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/zakazy/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`Заказ #${id} успешно удалён из системы`, 'success');
            loadOrders();
            loadMyTasks(isSupervisorScope);
        } else {
            showToast('Не удалось удалить заказ', 'error');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
}

function openCreate() {
    window.location.href = 'order.html';
}

function exportToCSV() {
    if (!allOrders || allOrders.length === 0) {
        showToast('Нет данных для выгрузки в CSV', 'warning');
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
    showToast('Отчёт успешно экспортирован в CSV файл', 'success');
}

// Вспомогательные функции форматирования
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

function getNoun(number, one, two, five) {
    let n = Math.abs(number);
    n %= 100;
    if (n >= 5 && n <= 20) return five;
    n %= 10;
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return two;
    return five;
}