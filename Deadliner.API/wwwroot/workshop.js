const API = 'http://localhost:5216/api';

// Запускаем при загрузке
document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    updateClock();
    loadWorkshop();

    setInterval(updateClock, 1000);
    setInterval(loadWorkshop, 30000);
});

function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s}`;
}

async function loadWorkshop() {
    const response = await fetch(`${API}/zakazy`);
    const orders = await response.json();

    const active = orders.filter(o => o.status !== 'завершён');

    const tbody = document.getElementById('workshopTable');
    tbody.innerHTML = '';

    active.forEach(order => {
        const today = new Date();
        const shipDate = new Date(order.planDataOtgruzki);
        const daysLeft = Math.ceil((shipDate - today) / (1000 * 60 * 60 * 24));

        let colorClass = 'green';
        if (daysLeft <= 2) colorClass = 'red';
        else if (daysLeft <= 7) colorClass = 'yellow';

        const daysText = daysLeft < 0
            ? `<span class="overdue">ПРОСРОЧЕН на ${Math.abs(daysLeft)} дн.</span>`
            : `${daysLeft} дн.`;

        const row = document.createElement('tr');
        row.className = colorClass;
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.klient?.fioNazvanie ?? '—'}</td>
            <td>${order.planDataOtgruzki}</td>
            <td class="days-left">${daysText}</td>
            <td>${order.status}</td>
        `;
        tbody.appendChild(row);
    });
}