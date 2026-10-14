const API = 'http://localhost:5216/api';

const urlParams = new URLSearchParams(window.location.search);
const zakazId = urlParams.get('zakazId');

let currentStages = [];
let allEmployees = [];

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);

    if (!zakazId) {
        showToast('Заказ не выбран!', 'warning', 'Предупреждение');
        setTimeout(() => { window.location.href = 'index.html'; }, 1200);
        return;
    }

    document.getElementById('orderTitle').textContent = `Технологический маршрут заказа №${zakazId}`;
    loadEmployees();
    loadStages();
});

async function loadEmployees() {
    try {
        const res = await fetch(`${API}/sotrudniki`);
        if (res.ok) {
            allEmployees = await res.json();
        }
    } catch (e) {
        console.error('Ошибка загрузки сотрудников:', e);
    }
}

async function loadStages() {
    try {
        const response = await fetch(`${API}/etapyzakaza/zakaz/${zakazId}`);
        if (!response.ok) throw new Error('Ошибка загрузки этапов');
        
        currentStages = await response.json();
        renderProgress(currentStages);
        renderTable(currentStages);
    } catch (err) {
        console.error(err);
        document.getElementById('stagesTable').innerHTML = 
            '<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:28px;">Для данного заказа технологические этапы еще не сформированы</td></tr>';
    }
}

function renderProgress(stages) {
    const track = document.getElementById('progressTrack');
    const percentEl = document.getElementById('progressPercent');
    if (!track) return;
    track.innerHTML = '';

    if (!stages || stages.length === 0) {
        percentEl.textContent = '0%';
        return;
    }

    const doneCount = stages.filter(s => s.status === 'завершён').length;
    const percent = Math.round((doneCount / stages.length) * 100);
    percentEl.textContent = `${percent}% (${doneCount} из ${stages.length} выполнено)`;

    stages.forEach(item => {
        const step = document.createElement('div');
        step.className = 'progress-step';

        if (item.status === 'завершён') {
            step.classList.add('done');
        } else if (item.status === 'в работе') {
            step.classList.add('current');
        }

        step.textContent = item.etap?.nazvanie ?? `Этап ${item.idEtapa}`;
        track.appendChild(step);
    });
}

function renderTable(stages) {
    const tbody = document.getElementById('stagesTable');
    tbody.innerHTML = '';

    if (!stages || stages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px;">Технологические этапы отсутствуют</td></tr>';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user')) || {};
    const isSupervisor = user.idRoli === 1 || (user.rol && user.rol.nazvanie && user.rol.nazvanie.toLowerCase().includes('начальник'));
    const isManager = user.idRoli === 2;

    const todayStr = new Date().toISOString().slice(0, 10);

    stages.forEach((item, index) => {
        const isDone = item.status === 'завершён';
        const isDirectAssignee = item.idSotrudnika === user.id;
        const isRoleMatch = !item.idSotrudnika && (!item.etap?.idRoliOtvetstvennogo || item.etap?.idRoliOtvetstvennogo === user.idRoli);
        const canComplete = isSupervisor || isDirectAssignee || isRoleMatch;

        // Расчет соблюдения мини-дедлайна
        let deadlineBadge = `<span class="mono">${formatDateDisplay(item.planData)}</span>`;
        if (isDone) {
            const planD = new Date(item.planData);
            const factD = new Date(item.factData || item.planData);
            if (factD <= planD) {
                deadlineBadge += ` <span style="color:var(--status-green); font-size:11px; font-weight:700;">(в срок)</span>`;
            } else {
                const diffDays = Math.ceil((factD - planD) / (1000 * 60 * 60 * 24));
                deadlineBadge += ` <span style="color:var(--status-red); font-size:11px; font-weight:700;">(+${diffDays} дн.)</span>`;
            }
        } else {
            const planD = new Date(item.planData);
            const nowD = new Date(todayStr);
            const left = Math.ceil((planD - nowD) / (1000 * 60 * 60 * 24));
            if (left < 0) {
                deadlineBadge += ` <span style="color:var(--status-red); font-size:11px; font-weight:700;">(просрочен)</span>`;
            } else if (left <= 2) {
                deadlineBadge += ` <span style="color:var(--status-yellow); font-size:11px; font-weight:700;">(горит!)</span>`;
            }
        }

        const requiredRoleName = item.etap?.rolOtvetstvennogo?.nazvanie ?? 'Сотрудник цеха';
        const assigneeFio = item.sotrudnik?.fio ?? '<span style="color:#d97706;">Не назначен</span>';

        let actionCell = '';
        if (isDone) {
            actionCell = '<span style="color:var(--status-green); font-weight:700; font-size:13px;">Завершён</span>';
        } else {
            const completeBtn = canComplete
                ? `<button class="btn-table-action action-emerald" onclick="completeStage(${item.id}, '${escapeHtml(item.etap?.nazvanie ?? '')}')">Завершить</button>`
                : `<button class="btn-table-action action-slate" disabled title="Доступно только для: ${requiredRoleName}">Только ${requiredRoleName}</button>`;

            const assignBtn = (isSupervisor || isManager)
                ? `<button class="btn-table-action action-blue" onclick="openAssignModal(${item.id})">Назначить</button>`
                : '';

            actionCell = `<div style="display:flex; gap:6px;">${completeBtn}${assignBtn}</div>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:600;">${index + 1}</td>
            <td style="font-weight:700;">${escapeHtml(item.etap?.nazvanie ?? '—')}</td>
            <td><span class="btn-table-action action-purple" style="font-size:11.5px;">${escapeHtml(requiredRoleName)}</span></td>
            <td>${assigneeFio}</td>
            <td>${deadlineBadge}</td>
            <td class="mono" style="font-weight:600;">${item.factData ? formatDateDisplay(item.factData) : '—'}</td>
            <td>
                <span class="urgency-indicator urgency-${isDone ? 'green' : (item.status === 'в работе' ? 'yellow' : 'slate')}">
                    <span class="dot"></span>
                    <span>${item.status}</span>
                </span>
            </td>
            <td>${actionCell}</td>
        `;
        tbody.appendChild(row);
    });
}

// Завершение этапа
async function completeStage(stageId, stageName) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        showToast('Необходимо авторизоваться', 'warning');
        return;
    }

    const confirmed = await showConfirm(
        'Завершение технологического этапа',
        `Вы подтверждаете завершение этапа «${stageName}»? Фактическое выполнение и соблюдение мини-дедлайна будут зафиксированы в журнале аудита.`,
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
            showToast(`Технологический этап «${stageName}» успешно выполнен! (${data.deadlineResult})`, 'success');
            loadStages();
        } else {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || 'Ошибка при завершении этапа', 'error', 'Отказ');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
}

// ==========================================================================
// МОДАЛЬНОЕ ОКНО НАЗНАЧЕНИЯ ИСПОЛНИТЕЛЯ И МИНИ-ДЕДЛАЙНА
// ==========================================================================

function openAssignModal(stageId) {
    const stage = currentStages.find(s => s.id === stageId);
    if (!stage) return;

    document.getElementById('assignStageId').value = stageId;
    document.getElementById('assignModalTitle').textContent = `Назначение: ${stage.etap?.nazvanie ?? `Этап #${stage.idEtapa}`}`;

    const select = document.getElementById('assignEmployeeSelect');
    select.innerHTML = '<option value="">-- Выберите сотрудника из штата --</option>';

    allEmployees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        const roleName = emp.rol?.nazvanie ?? `Роль #${emp.idRoli}`;
        opt.textContent = `${emp.fio} (${roleName})`;
        if (stage.idSotrudnika === emp.id) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    document.getElementById('assignPlanDateInput').value = stage.planData || '';

    const overlay = document.getElementById('assignModalOverlay');
    overlay.style.display = 'flex';
    overlay.classList.add('active');
}

function closeAssignModal() {
    const overlay = document.getElementById('assignModalOverlay');
    overlay.style.display = 'none';
    overlay.classList.remove('active');
}

async function saveStageAssignment() {
    const stageId = parseInt(document.getElementById('assignStageId').value);
    const empIdVal = document.getElementById('assignEmployeeSelect').value;
    const planDateVal = document.getElementById('assignPlanDateInput').value;

    if (!stageId) return;

    const payload = {};
    if (empIdVal) {
        payload.idSotrudnika = parseInt(empIdVal);
    }
    if (planDateVal) {
        payload.planData = planDateVal;
    }

    try {
        const res = await fetch(`${API}/etapyzakaza/${stageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast('Параметры этапа успешно сохранены!', 'success');
            closeAssignModal();
            loadStages();
        } else {
            showToast('Не удалось сохранить изменения', 'error');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
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