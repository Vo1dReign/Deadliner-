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

        data.forEach(item => {
            const badgeClass = item.tipEtapa === 'базовый' ? 'badge-base' : 'badge-sub';
            const roleName = item.rolOtvetstvennogo?.nazvanie ?? getRoleNameById(item.idRoliOtvetstvennogo);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight:bold; color:#aab4d0;">№ ${item.poryadkovyNomer}</td>
                <td style="font-weight:bold; font-size:15px;">${item.nazvanie}</td>
                <td><span class="badge ${badgeClass}">${item.tipEtapa}</span></td>
                <td>👤 ${roleName}</td>
                <td>
                    <button class="btn btn-danger manager-only" onclick="deleteStage(${item.id})">Удалить</button>
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
        alert('Заполните все обязательные поля!');
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
            loadCatalog();
        } else {
            alert('Ошибка при сохранении этапа в базу данных');
        }
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}

// Удаление этапа
async function deleteStage(id) {
    if (!confirm('Вы уверены, что хотите удалить этот этап из общего справочника цеха?')) return;

    try {
        const res = await fetch(`${API}/etapproizvodstva/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            loadCatalog();
        } else {
            alert('Не удалось удалить этап');
        }
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}

function getRoleNameById(id) {
    if (id === 1) return 'Администратор';
    if (id === 2) return 'Менеджер';
    if (id === 3) return 'Сотрудник цеха';
    return 'Не назначено';
}