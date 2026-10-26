const API = 'http://localhost:5216/api';

let allOrders = [];          // Все загруженные заказы
let filteredOrders = [];     // Отфильтрованные заказы
let sortColumn = 'id';       // Текущая колонка сортировки
let sortAsc = false;         // Новые заказы первыми
let isSupervisorScope = false; // Режим отображения задач (личные или все по цеху)

// Состояние пагинации
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;

// Таймер дебаунса для поиска
let searchDebounceTimer = null;

// Список заказчиков для фильтра
let clientsList = [];

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    loadClientsForFilter();
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
        showToast('Ошибка связи с сервером', 'error');
    }
}

// ==========================================================================
// 2. РЕЕСТР ЗАКАЗОВ В ПРОИЗВОДСТВЕ (ФИЛЬТРАЦИЯ, ПОИСК, СОРТИРОВКА, ПАГИНАЦИЯ)
// ==========================================================================

async function loadClientsForFilter() {
    try {
        const res = await fetch(`${API}/klienty`);
        if (!res.ok) return;
        clientsList = await res.json();
        const select = document.getElementById('clientFilter');
        if (!select) return;
        
        select.innerHTML = '<option value="">Все заказчики</option>';
        clientsList.sort((a, b) => a.fioNazvanie.localeCompare(b.fioNazvanie, 'ru'));
        clientsList.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.fioNazvanie;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('Не удалось загрузить справочник клиентов для фильтра', e);
    }
}

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
    document.querySelectorAll('#statusTabGroup .tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.value = status === 'all' ? '' : status;
    }
    currentPage = 1;
    applyFilters();
}

function onSearchInput() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    if (clearBtn) {
        clearBtn.style.display = input && input.value.trim().length > 0 ? 'inline-flex' : 'none';
    }

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        currentPage = 1;
        applyFilters();
    }, 150);
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    currentPage = 1;
    applyFilters();
}

function toggleAdvancedFilters() {
    const bar = document.getElementById('advancedFilterBar');
    const btn = document.getElementById('btnToggleFilters');
    if (!bar) return;

    const isHidden = window.getComputedStyle(bar).display === 'none';
    bar.style.display = isHidden ? 'block' : 'none';
    if (btn) {
        btn.classList.toggle('active', isHidden);
    }
}

function resetFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClearBtn');
    const statusFilter = document.getElementById('statusFilter');
    const urgencyFilter = document.getElementById('urgencyFilter');
    const clientFilter = document.getElementById('clientFilter');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');

    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    if (statusFilter) statusFilter.value = '';
    if (urgencyFilter) urgencyFilter.value = '';
    if (clientFilter) clientFilter.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';

    document.querySelectorAll('#statusTabGroup .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === 'all');
    });

    currentPage = 1;
    applyFilters();
    showToast('Все фильтры и условия поиска сброшены', 'info');
}

function removeFilter(type) {
    if (type === 'search') clearSearch();
    if (type === 'status') {
        const s = document.getElementById('statusFilter');
        if (s) s.value = '';
        document.querySelectorAll('#statusTabGroup .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.status === 'all'));
    }
    if (type === 'urgency') {
        const u = document.getElementById('urgencyFilter');
        if (u) u.value = '';
    }
    if (type === 'client') {
        const c = document.getElementById('clientFilter');
        if (c) c.value = '';
    }
    if (type === 'dates') {
        const df = document.getElementById('dateFrom');
        const dt = document.getElementById('dateTo');
        if (df) df.value = '';
        if (dt) dt.value = '';
    }
    currentPage = 1;
    applyFilters();
}

function applyFilters() {
    const searchVal = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    const statusVal = document.getElementById('statusFilter')?.value || '';
    const urgencyVal = document.getElementById('urgencyFilter')?.value || '';
    const clientVal = document.getElementById('clientFilter')?.value || '';
    const dateFromVal = document.getElementById('dateFrom')?.value || '';
    const dateToVal = document.getElementById('dateTo')?.value || '';

    // Синхронизация активной вкладки табов со статусом
    document.querySelectorAll('#statusTabGroup .tab-btn').forEach(btn => {
        const s = btn.dataset.status;
        if (!statusVal && s === 'all') btn.classList.add('active');
        else if (statusVal && s === statusVal) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Отрисовка фишек активных фильтров (chips) и индикатора
    const activeChipsContainer = document.getElementById('activeFilterChips');
    const activeFiltersDot = document.getElementById('activeFiltersDot');
    let hasActiveFilters = false;
    let chipsHtml = '';

    if (searchVal) {
        hasActiveFilters = true;
        chipsHtml += `<span class="filter-chip">Поиск: «${escapeHtml(searchVal)}» <span class="filter-chip-remove" onclick="removeFilter('search')">✕</span></span>`;
    }
    if (statusVal) {
        hasActiveFilters = true;
        chipsHtml += `<span class="filter-chip">Статус: ${escapeHtml(statusVal)} <span class="filter-chip-remove" onclick="removeFilter('status')">✕</span></span>`;
    }
    if (urgencyVal) {
        hasActiveFilters = true;
        const uLabels = { green: '🟢 В графике', yellow: '🟡 3–7 дн.', red: '🔴 Горит дедлайн' };
        chipsHtml += `<span class="filter-chip">${uLabels[urgencyVal] || urgencyVal} <span class="filter-chip-remove" onclick="removeFilter('urgency')">✕</span></span>`;
    }
    if (clientVal) {
        hasActiveFilters = true;
        const clientObj = clientsList.find(c => c.id == clientVal);
        const clientName = clientObj ? clientObj.fioNazvanie : `#${clientVal}`;
        chipsHtml += `<span class="filter-chip">Клиент: ${escapeHtml(clientName)} <span class="filter-chip-remove" onclick="removeFilter('client')">✕</span></span>`;
    }
    if (dateFromVal || dateToVal) {
        hasActiveFilters = true;
        const dText = `${dateFromVal || '...'} — ${dateToVal || '...'}`;
        chipsHtml += `<span class="filter-chip">Срок: ${dText} <span class="filter-chip-remove" onclick="removeFilter('dates')">✕</span></span>`;
    }

    if (activeChipsContainer) activeChipsContainer.innerHTML = chipsHtml;
    if (activeFiltersDot) activeFiltersDot.style.display = hasActiveFilters ? 'inline-block' : 'none';

    // Фильтрация массива заказов
    filteredOrders = allOrders.filter(order => {
        const clientName = (order.klient?.fioNazvanie ?? '').toLowerCase();
        const clientPhone = (order.klient?.telefon ?? '').toLowerCase();
        const orderIdStr = order.id.toString();
        const managerName = (order.menedzher?.fio ?? '').toLowerCase();

        const matchesSearch = !searchVal || 
            clientName.includes(searchVal) || 
            orderIdStr.includes(searchVal) || 
            clientPhone.includes(searchVal) ||
            managerName.includes(searchVal);

        const matchesStatus = !statusVal || order.status === statusVal;
        const matchesUrgency = !urgencyVal || order.colorClass === urgencyVal;
        const matchesClient = !clientVal || order.idKlienta == clientVal;

        let matchesDate = true;
        if (dateFromVal && order.planDataOtgruzki < dateFromVal) matchesDate = false;
        if (dateToVal && order.planDataOtgruzki > dateToVal) matchesDate = false;

        return matchesSearch && matchesStatus && matchesUrgency && matchesClient && matchesDate;
    });

    // Сортировка
    if (sortColumn) {
        filteredOrders.sort((a, b) => {
            let valA, valB;

            if (sortColumn === 'klient') {
                valA = a.klient?.fioNazvanie ?? '';
                valB = b.klient?.fioNazvanie ?? '';
                return sortAsc ? valA.localeCompare(valB, 'ru') : valB.localeCompare(valA, 'ru');
            } else if (sortColumn === 'id') {
                valA = a.id;
                valB = b.id;
            } else if (sortColumn === 'daysLeft') {
                valA = a.daysLeft;
                valB = b.daysLeft;
            } else {
                valA = a[sortColumn] ?? '';
                valB = b[sortColumn] ?? '';
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    // Обновление индикаторов сортировки в заголовках таблицы (th)
    document.querySelectorAll('table.data-table th.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    if (sortColumn) {
        const activeTh = document.getElementById(`th-${sortColumn}`);
        if (activeTh) {
            activeTh.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');
        }
    }

    // Обновление счётчиков
    const resultCountEl = document.getElementById('filterResultCount');
    const totalCountEl = document.getElementById('filterTotalCount');
    if (resultCountEl) resultCountEl.textContent = filteredOrders.length;
    if (totalCountEl) totalCountEl.textContent = allOrders.length;

    // Пагинация
    const totalCount = filteredOrders.length;
    let pagedOrders = [];
    let startIdx = 0;
    let endIdx = totalCount;

    if (pageSize === 'all') {
        totalPages = 1;
        currentPage = 1;
        pagedOrders = filteredOrders;
        startIdx = 0;
        endIdx = totalCount;
    } else {
        totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        startIdx = (currentPage - 1) * pageSize;
        endIdx = Math.min(startIdx + pageSize, totalCount);
        pagedOrders = filteredOrders.slice(startIdx, endIdx);
    }

    renderTable(pagedOrders, totalCount);
    renderPagination(totalCount, startIdx, endIdx);
}

function sortTable(column) {
    if (sortColumn === column) {
        sortAsc = !sortAsc;
    } else {
        sortColumn = column;
        sortAsc = (column === 'id' ? false : true);
    }
    applyFilters();
}

function changePageSize(val) {
    pageSize = (val === 'all') ? 'all' : parseInt(val, 10);
    currentPage = 1;
    applyFilters();
}

function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
    applyFilters();
    const panel = document.querySelector('.table-panel');
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderPagination(totalCount, startIdx, endIdx) {
    const infoEl = document.getElementById('paginationInfo');
    const controlsEl = document.getElementById('paginationControls');
    const barEl = document.getElementById('paginationBar');

    if (!barEl) return;

    if (totalCount === 0) {
        if (infoEl) infoEl.textContent = 'Заказы не найдены';
        if (controlsEl) controlsEl.innerHTML = '';
        return;
    }

    if (infoEl) {
        if (pageSize === 'all') {
            infoEl.innerHTML = `Показаны все <strong>${totalCount}</strong> ${getNoun(totalCount, 'заказ', 'заказа', 'заказов')}`;
        } else {
            infoEl.innerHTML = `Показано <strong>${startIdx + 1}–${endIdx}</strong> из <strong>${totalCount}</strong> ${getNoun(totalCount, 'заказа', 'заказов', 'заказов')}`;
        }
    }

    if (!controlsEl) return;
    if (pageSize === 'all' || totalPages <= 1) {
        controlsEl.innerHTML = '';
        return;
    }

    let html = '';

    // Кнопка «Первая»
    html += `<button class="pagination-btn" onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''} title="Первая страница">«</button>`;
    // Кнопка «Назад»
    html += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} title="Предыдущая страница">‹</button>`;

    // Номера страниц (с умным сокращением)
    const pageWindow = 2;
    let prevShown = 0;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - pageWindow && p <= currentPage + pageWindow)) {
            if (prevShown && p - prevShown > 1) {
                html += `<span class="pagination-ellipsis">…</span>`;
            }
            html += `<button class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
            prevShown = p;
        }
    }

    // Кнопка «Вперёд»
    html += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} title="Следующая страница">›</button>`;
    // Кнопка «Последняя»
    html += `<button class="pagination-btn" onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} title="Последняя страница">»</button>`;

    controlsEl.innerHTML = html;
}

function renderTable(orders, totalCount) {
    const tbody = document.getElementById('ordersTable');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary); padding:40px; font-weight:500;">Заказов по заданным критериям не найдено</td></tr>';
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const isAdmin = currentUser.idRoli === 1 || currentUser.rol === 'Администратор';
    const isSupervisor = isAdmin || (currentUser.rol && currentUser.rol.toLowerCase().includes('начальник'));

    orders.forEach(order => {
        const isShipped = order.status === 'отгружен' || order.status === 'завершён';
        const daysText = isShipped
            ? 'Закрыт'
            : (order.daysLeft < 0 ? `Просрочен на ${Math.abs(order.daysLeft)} дн.` : `${order.daysLeft} дн.`);

        const isMyOrder = currentUser.id && (order.idMenedzhera === currentUser.id);
        const canManageOrder = isSupervisor || isMyOrder;

        const managerFio = order.menedzher?.fio ?? (order.idMenedzhera ? `Сотрудник #${order.idMenedzhera}` : 'Не назначен');
        const managerRole = order.menedzher?.rol?.nazvanie ? ` • ${order.menedzher.rol.nazvanie}` : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:600; color:var(--text-main);">#${order.id}</td>
            <td>
                <div style="font-weight:600; color:var(--text-main);">${escapeHtml(order.klient?.fioNazvanie ?? '—')}</div>
                <div style="font-size:11.5px; color:var(--text-secondary); margin-top:3px; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    <span>Менеджер: <strong>${escapeHtml(managerFio)}</strong>${escapeHtml(managerRole)}</span>
                    ${isMyOrder ? `<span style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; background:var(--brand-primary-light); color:var(--brand-primary);">Вы</span>` : ''}
                </div>
            </td>
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
                    ${canManageOrder ? `
                        <a class="btn-table-action action-blue" href="order.html?id=${order.id}">Изменить</a>
                        <button class="btn-table-action action-amber" onclick="openStatusModal(${order.id}, '${escapeHtml(order.status)}')">Статус</button>
                        ${(order.status === 'готов к отгрузке' || order.status === 'в работе') ? `
                            <button class="btn-table-action action-emerald" onclick="shipOrder(${order.id}, '${escapeHtml(order.klient?.fioNazvanie ?? '')}')">Отгрузить</button>
                        ` : ''}
                        <button class="btn-table-action action-rose" onclick="deleteOrder(${order.id})">Удалить</button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    applyRoleRules(currentUser);
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

function openStatusModal(orderId, currentStatus) {
    const modal = document.getElementById('statusModal');
    if (!modal) return;

    document.getElementById('statusOrderId').value = orderId;
    document.getElementById('statusModalTitle').textContent = `Управление статусом заказа #${orderId}`;
    document.getElementById('selectStatusValue').value = currentStatus || 'в работе';
    document.getElementById('statusNote').value = '';

    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

async function submitStatusChange(event) {
    event.preventDefault();

    const orderId = document.getElementById('statusOrderId').value;
    const newStatus = document.getElementById('selectStatusValue').value;
    const note = document.getElementById('statusNote').value.trim();
    const user = JSON.parse(localStorage.getItem('user'));

    try {
        const res = await fetch(`${API}/zakazy/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: newStatus,
                sotrudnikId: user?.id ?? 1,
                note: note
            })
        });

        if (res.ok) {
            closeStatusModal();
            showToast(`Статус заказа #${orderId} изменён на «${newStatus}»`, 'success');
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
        const user = JSON.parse(localStorage.getItem('user'));
        const res = await fetch(`${API}/zakazy/${id}?sotrudnikId=${user?.id ?? 1}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`Заказ #${id} успешно удалён из системы`, 'success');
            loadOrders();
            loadMyTasks(isSupervisorScope);
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || 'Не удалось удалить заказ', 'error');
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

// ==========================================================================
// 8. ИНТЕГРАЦИЯ С 1С: ИМПОРТ ИЗ EXCEL (.XLS / .XLSX)
// ==========================================================================

let parsed1CItems = [];

function openImport1CModal() {
    const modal = document.getElementById('import1CModal');
    if (!modal) return;

    reset1CImport();
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) fileInput.value = '';

    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeImport1CModal() {
    const modal = document.getElementById('import1CModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function reset1CImport() {
    parsed1CItems = [];
    const stepUpload = document.getElementById('importStepUpload');
    const stepPreview = document.getElementById('importStepPreview');
    if (stepUpload) stepUpload.style.display = 'block';
    if (stepPreview) stepPreview.style.display = 'none';

    const btnParse = document.getElementById('btnParse1C');
    if (btnParse) {
        btnParse.disabled = false;
        btnParse.innerHTML = '<span>Распознать</span>';
    }
}

async function parse1CFile() {
    const fileInput = document.getElementById('excelFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Пожалуйста, выберите файл выгрузки из 1С (.xls или .xlsx)', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const defaultDays = document.getElementById('importProdDays')?.value || 14;

    const btnParse = document.getElementById('btnParse1C');
    if (btnParse) {
        btnParse.disabled = true;
        btnParse.innerHTML = '<span>Обработка...</span>';
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API}/import1c/preview?defaultProdDays=${defaultDays}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Ошибка обработки файла 1С');
        }

        parsed1CItems = await response.json();
        if (!parsed1CItems || parsed1CItems.length === 0) {
            showToast('В файле не найдено строк с производственными заказами', 'warning');
            reset1CImport();
            return;
        }

        showToast(`Файл успешно прочитан! Найдено ${parsed1CItems.length} нарядов.`, 'success');

        // Переключаем отображение на предпросмотр
        document.getElementById('importStepUpload').style.display = 'none';
        document.getElementById('importStepPreview').style.display = 'flex';

        render1CPreviewTable();
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Ошибка связи с сервером', 'error', 'Ошибка 1С');
        if (btnParse) {
            btnParse.disabled = false;
            btnParse.innerHTML = '<span>Распознать</span>';
        }
    }
}

function render1CPreviewTable() {
    const tbody = document.getElementById('importPreviewTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const newClientsCount = parsed1CItems.filter(i => !i.isExistingClient).length;

    document.getElementById('previewTotalCount').textContent = parsed1CItems.length;
    document.getElementById('previewNewClientsCount').textContent = newClientsCount;

    parsed1CItems.forEach((item, index) => {
        const tr = document.createElement('tr');

        const clientBadge = item.isExistingClient
            ? `<span style="display:inline-block; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; background:#eff6ff; color:#2563eb; margin-left:6px;" title="Контрагент уже есть в базе">В базе</span>`
            : `<span style="display:inline-block; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; background:#ecfdf5; color:#059669; margin-left:6px;" title="Будет автоматически создан новый контрагент">+ Новый</span>`;

        const amountFormatted = Number(item.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const currencyBadge = item.currency === 'BYN' ? BEL_RUBLE_SVG : `<span class="mono" style="font-size:11px;">${item.currency}</span>`;

        const shipDateBadge = item.hasExplicitShipDate
            ? `<div style="font-size: 10px; font-weight: 600; color: var(--status-green); margin-top: 2px;">✔ из файла 1С</div>`
            : `<div style="font-size: 10px; font-weight: 600; color: #d97706; margin-top: 2px;">⏱ норматив (+14дн)</div>`;

        const productHtml = item.productName
            ? `<div style="font-weight: 700; color: var(--brand-primary); font-size: 12px; margin-bottom: 2px;">📦 ${escapeHtml(item.productName)}</div>`
            : '';

        const contractHtml = item.contract
            ? `<div style="font-size: 11.5px; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.contract)}">${escapeHtml(item.contract)}</div>`
            : '<span style="color:var(--text-muted); font-size:11px;">—</span>';

        const addressHtml = item.address
            ? `<div style="font-size: 12px; color: var(--text-main); font-weight: 500; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.address)}">📍 ${escapeHtml(item.address)}</div>`
            : `<span style="color: var(--text-muted); font-size: 12px;">—</span>`;

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="row-checkbox-1c" data-index="${index}" ${item.selected ? 'checked' : ''} onchange="update1CItemSelected(${index}, this.checked)">
            </td>
            <td class="mono" style="font-weight: 700; color: var(--text-main);">
                ${escapeHtml(item.docNumber || '—')}
            </td>
            <td>
                <span style="font-weight: 600;">${escapeHtml(item.clientName)}</span>
                ${clientBadge}
            </td>
            <td class="mono" style="font-size: 13px; color: var(--text-secondary);">
                ${item.orderDate}
            </td>
            <td>
                <input type="date" class="form-control mono" style="padding: 4px 8px; font-size: 12px; height: 30px; width: 130px;" 
                       value="${item.planShipDate}" onchange="update1CItemPlanDate(${index}, this.value)">
                ${shipDateBadge}
            </td>
            <td class="mono" style="font-weight: 600; font-size: 13px;">
                ${amountFormatted}&nbsp;${currencyBadge}
            </td>
            <td>
                ${productHtml}
                ${contractHtml}
            </td>
            <td>
                ${addressHtml}
            </td>
        `;

        tbody.appendChild(tr);
    });

    update1CSelectedCounter();
}

function update1CItemSelected(index, isChecked) {
    if (parsed1CItems[index]) {
        parsed1CItems[index].selected = isChecked;
    }

    const masterCheckbox = document.getElementById('masterCheckbox1C');
    if (masterCheckbox) {
        masterCheckbox.checked = parsed1CItems.length > 0 && parsed1CItems.every(i => i.selected);
    }

    update1CSelectedCounter();
}

function update1CItemPlanDate(index, newDate) {
    if (parsed1CItems[index] && newDate) {
        parsed1CItems[index].planShipDate = newDate;
    }
}

function toggleSelectAll1C(masterChecked) {
    parsed1CItems.forEach(i => i.selected = masterChecked);

    document.querySelectorAll('.row-checkbox-1c').forEach(cb => {
        cb.checked = masterChecked;
    });

    update1CSelectedCounter();
}

function update1CSelectedCounter() {
    const selectedCount = parsed1CItems.filter(i => i.selected).length;
    const countEl = document.getElementById('previewSelectedCount');
    const btnCountEl = document.getElementById('btnSelectedCount');
    const btnConfirm = document.getElementById('btnConfirmImport1C');

    if (countEl) countEl.textContent = selectedCount;
    if (btnCountEl) btnCountEl.textContent = selectedCount;
    if (btnConfirm) btnConfirm.disabled = selectedCount === 0;
}

async function execute1CImport() {
    const selected = parsed1CItems.filter(i => i.selected);
    if (selected.length === 0) {
        showToast('Выберите хотя бы один заказ для импорта', 'warning');
        return;
    }

    const confirmed = await showConfirm(
        'Импорт заказов из 1С',
        `Запустить импорт выбранных нарядов (${selected.length} шт.) в производственную базу? Для каждого заказа будет автоматически сгенерирована технологическая цепочка этапов цеха.`,
        { confirmText: 'Импортировать', isInfo: true }
    );
    if (!confirmed) return;

    const btnConfirm = document.getElementById('btnConfirmImport1C');
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span>Импорт данных...</span>';
    }

    const user = JSON.parse(localStorage.getItem('user'));
    const payload = {
        items: selected,
        defaultManagerId: user?.id ?? 1
    };

    try {
        const response = await fetch(`${API}/import1c/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Ошибка импорта');
        }

        const result = await response.json();
        closeImport1CModal();
        showToast(result.message || `Успешно импортировано ${result.totalImported} заказов!`, 'success', 'Импорт из 1С завершён');

        // Перезагружаем реестр и персональные виджеты
        loadOrders();
        loadMyTasks(isSupervisorScope);
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Ошибка связи с сервером', 'error', 'Ошибка импорта');
        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = `<span>📥 Импортировать выбранные (<span id="btnSelectedCount">${selected.length}</span>)</span>`;
        }
    }
}
