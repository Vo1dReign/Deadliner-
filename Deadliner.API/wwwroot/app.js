const API = 'http://localhost:5216/api';

document.addEventListener('DOMContentLoaded', loadOrders);

async function loadOrders() {
    const response = await fetch(`${API}/zakazy`);
    const orders = await response.json();

    const tbody = document.getElementById(`ordersTable`);
    tbody.innerHTML = '';

    orders.forEach(order => {
        const today = new Date();
        const shipDate = new Date(order.planDataOtgruzki);
        const daysLeft = Math.ceil((shipDate - today)/ (1000 * 60 * 60 * 24));

        let colorClass = `green`;
        if (daysLeft <= 2)colorClass = 'red';
        else if (daysLeft <= 7)colorClass = 'yellow';

        const row = document.createElement('tr');
        row.className = colorClass;
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.klient?.fioNazvanie ?? '-'}</td>
            <td>${order.dataPriema}</td>
            <td>${order.planDataOtgruzki}</td>
            <td>${daysLeft} дн.</td>
            <td>${order.status}</td>
            <td>
                <button class="btn" onclick="deleteOrder(${order.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteOrder(id) {
    if (!confirm('Удалить заказ ?')) return;
    await fetch(`${API}/zakazy/${id}`, {method: 'DELETE'});
    loadOrders();
}

function openCreate()
{
    window.location.href = 'order.html';
}