const API = 'http://localhost:5216/api';

document.addEventListener('DOMContentLoaded', () => {
    // Проверка прав и пользователя
    const user = showUserInfo();
    applyRoleRules(user);

    loadCatalog();
});

// Загрузка всех этапов из справочника
async function loadCatalog() {
    const tbody = document.getElementById('catalogTable');
    try {
        const response = await fetch(`${API}/etapproizvodstva`);
        if (!response.ok) throw new Error('Ошибка загрузки');

        const data = await response.json();
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">В справочнике пока нет этапов</td></tr>';
            return;
        }

            const isBase = item.tipEtapa === 'базовый';
            const roleName = item.rolOtvetstvennogo?.nazvanie ?? getRoleNameById(item.idRoliOtvetstvennogo);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="mono" style="font-weight:700; color:var(--brand-primary);">№ ${item.poryadkovyNomer}</td>
                <td style="font-weight:700;">${item.nazvanie}</td>
                <td><span class="btn-table-action ${isBase ? 'action-blue' : 'action-purple'}" style="font-size:11px;">${item.tipEtapa}</span></td>
                <td style="font-weight:500; color:var(--text-secondary);">${roleName}</td>
                <td>
                    <button class="btn-table-action action-rose manager-only" onclick="deleteStage(${item.id})">Удалить</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        const user = JSON.parse(localStorage.getItem('user'));
        applyRoleRules(user);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Ошибка соединения с сервером</td></tr>';
    }
}

async function addStage(event) {
    event.preventDefault();

    const nazvanie = document.getElementById('nazvanie').value.trim();
    const poryadok = parseInt(document.getElementById('poryadok').value);
    const tipEtapa = document.getElementById('tipEtapa').value;
    const rolId = parseInt(document.getElementById('rolSelect').value);

    if (!nazvanie || isNaN(poryadok)) {
        showToast('Заполните все обязательные поля!', 'warning', 'Внимание');
        return;
    }

    const payload = {
        nazvanie: nazvanie,
        poryadkovyNomer: poryadok,
        tipEtapa: tipEtapa,
        idRoliOtvetstvennogo: rolId
    };

    try {
        const res = await fetch(`${API}/etapproizvodstva`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById('addStageForm').reset();
            showToast('Этап успешно добавлен в справочник', 'success');
            loadCatalog();
        } else {
            showToast('Ошибка при сохранении этапа в базу данных', 'error', 'Ошибка');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error', 'Сеть');
    }
}

// Удаление этапа
async function deleteStage(id) {
    const confirmed = await showConfirm(
        'Удаление этапа',
        'Вы уверены, что хотите удалить этот этап из общего справочника цеха?',
        { confirmText: 'Удалить', danger: true }
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/etapproizvodstva/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast('Этап успешно удален', 'success');
            loadCatalog();
        } else {
            showToast('Не удалось удалить этап', 'error', 'Ошибка');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error', 'Сеть');
    }
}

function getRoleNameById(id) {
    if (id === 1) return 'Администратор';
    if (id === 2) return 'Менеджер';
    if (id === 3) return 'Сотрудник цеха';
    return 'Не назначено';
}