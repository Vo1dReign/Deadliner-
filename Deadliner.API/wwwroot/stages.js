const API = 'http://localhost:5216/api';

const urlParams = new URLSearchParams(window.location.search);
const zakazId = urlParams.get('zakazId');

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);

    if (!zakazId) {
        alert('Заказ не выбран!');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('orderTitle').textContent = `Технологический маршрут заказа №${zakazId}`;
    loadStages();
});

async function loadStages() {
    try {
        const response = await fetch(`${API}/etapyzakaza/zakaz/${zakazId}`);
        if (!response.ok) throw new Error('Ошибка загрузки этапов');
        
        const stages = await response.json();
        renderProgress(stages);
        renderTable(stages);
    } catch (err) {
        console.error(err);
        document.getElementById('stagesTable').innerHTML = 
            '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Для данного заказа технологические этапы еще не сформированы</td></tr>';
    }
}

function renderProgress(stages) {
    const track = document.getElementById('progressTrack');
    const percentEl = document.getElementById('progressPercent');
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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Этапы отсутствуют</td></tr>';
        return;
    }

    stages.forEach((item, index) => {
        const isDone = item.status === 'завершён';
        const isCurrent = item.status === 'в работе';
        const colorType = isDone ? 'green' : (isCurrent ? 'yellow' : 'slate');

        const actionCell = isDone
            ? '<span style="color:var(--status-green-text); font-weight:700;">Готово</span>'
            : `<button class="btn-table-action action-emerald" onclick="completeStage(${item.id})">Завершить этап</button>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:600;">${index + 1}</td>
            <td style="font-weight:700;">${item.etap?.nazvanie ?? '—'}</td>
            <td><span class="btn-table-action action-purple" style="font-size:11px;">${item.etap?.tipEtapa ?? 'базовый'}</span></td>
            <td class="mono" style="color:var(--text-secondary);">${item.planData}</td>
            <td class="mono" style="font-weight:600;">${item.factData ?? '—'}</td>
            <td>
                <span class="urgency-indicator urgency-${colorType}">
                    <span class="dot"></span>
                    <span>${item.status}</span>
                </span>
            </td>
            <td>${actionCell}</td>
        `;
        tbody.appendChild(row);
    });
}

async function completeStage(stageId) {
    const confirmed = await showConfirm(
        'Завершение этапа',
        'Вы подтверждаете выполнение данного технологического этапа производства?',
        { confirmText: 'Завершить', isDanger: false, isInfo: true }
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/etapyzakaza/${stageId}/complete`, {
            method: 'POST'
        });

        if (res.ok) {
            showToast('Технологический этап успешно завершён!', 'success');
            loadStages();
        } else {
            showToast('Ошибка при отметке выполнения этапа', 'error');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error');
    }
}