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
            <td>${order.id}</td>
            <td>${order.klient?.fioNazvanie ?? '-'}</td>
            <td>${order.dataPriema}</td>
            <td>${order.planDataOtgruzki}</td>
            <td>${daysLeft} дн.</td>
            <td><span class="badge ${badgeClass}">${order.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}