const API = 'http://localhost:5216/api';

document.addEventListener('DOMContentLoaded', loadReport);

async function loadReport() {
    const response = await fetch(`${API}/zakazy`);
    const orders = await response.json();

    const total = orders.length;
    const done = orders.filter(o => o.status === 'завершён').length;
    const overdue = orders.filter(o => o.status === 'просрочен').length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('doneCount').textContent = done;
    document.getElementById('overdueCount').textContent = overdue;

    const tbody = document.getElementById('reportsTable');
    tbody.innerHTML = '';

    orders.forEach(order => 
        {
        const today = new Date();
        const shipDate = new Date(order.planDataOtgruzki);
        const daysLeft = Math.ceil((shipDate - today) / (1000 * 60 * 60 * 24));

        let badgeClass = 'yellow';
        if (order.status === 'завершён') badgeClass = 'green';
        if (order.status === 'просрочен') badgeClass = 'red';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="mono" style="font-weight:700;">#${order.id}</td>
            <td style="font-weight:600;">${order.klient?.fioNazvanie ?? '—'}</td>
            <td class="mono" style="color:var(--text-secondary);">${order.dataPriema}</td>
            <td class="mono" style="font-weight:600;">${order.planDataOtgruzki}</td>
            <td>
                <span class="urgency-indicator urgency-${badgeClass}">
                    <span class="dot"></span>
                    <span>${daysLeft} дн.</span>
                </span>
            </td>
            <td><span style="font-weight: 500; color:var(--text-secondary);">${order.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}