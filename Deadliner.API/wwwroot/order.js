const API = 'http://localhost:5216/api';

document.addEventListener('DOMContentLoaded', async ()=>
{
    await loadClient();
    await loadManager();
});

async function loadClient() {
    const response = await fetch(`${API}/klienty`)
    const clients = await response.json();

    const select = document.getElementById('clientId');
    clients.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.fioNazvanie;
        select.appendChild(option);
    });
}

async function loadManager() {
    const response = await fetch(`${API}/sotrudniki`)
    const clients = await response.json();

    const select = document.getElementById('managerId');
    clients.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.fio;
        select.appendChild(option);
    });
}

async function createOrder() {
    const clientId = document.getElementById('clientId').value;
    const managerId = document.getElementById('managerId').value;
    const prepayment = document.getElementById('prepayment').value;
    const shipDate = document.getElementById('shipDate').value;

    if (!clientId || !managerId || !shipDate){
        alert('Заполните все обязательные поля!')
        return;
    }

     const order = {
        idKlienta: parseInt(clientId),
        klientId: parseInt(clientId),
        idMenedzhera: parseInt(managerId),
        menedzherId: parseInt(managerId),
        summaPredoplaty: parseFloat(prepayment) || 0,
        planDataOtgruzki: shipDate,
        status: 'в работе'
    };
    const response = await fetch(`${API}/zakazy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    });
    if (response.ok) {
        alert('Заказ создан!');
        window.location.href = 'index.html';
    } else {
        alert('Ошибка при создании заказа');
    }
}