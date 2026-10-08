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
        let badgeClass = 'badge-gray';
        if (item.status === 'завершён') badgeClass = 'badge-green';
        else if (item.status === 'в работе') badgeClass = 'badge-yellow';

        const actionCell = item.status === 'завершён'
            ? '<span style="color:#22c55e; font-weight:bold;">✔ Выполнено</span>'
            : `<button class="btn btn-success" onclick="completeStage(${item.id})">Завершить этап</button>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight:bold;">${item.etap?.nazvanie ?? '—'}</td>
            <td>${item.etap?.tipEtapa ?? 'базовый'}</td>
            <td>${item.planData}</td>
            <td>${item.factData ?? '—'}</td>
            <td><span class="badge ${badgeClass}">${item.status}</span></td>
            <td>${actionCell}</td>
        `;
        tbody.appendChild(row);
    });
}

async function completeStage(stageId) {
    if (!confirm('Подтвердить завершение данного технологического этапа?')) return;

    try {
        const res = await fetch(`${API}/etapyzakaza/${stageId}/complete`, {
            method: 'POST'
        });

        if (res.ok) {
            loadStages();
        } else {
            alert('Ошибка при отметке выполнения этапа');
        }
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}