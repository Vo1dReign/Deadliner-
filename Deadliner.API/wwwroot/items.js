
const params = new URLSearchParams(window.location.search);
const zakazId = parseInt(params.get('zakazId'));

if (!zakazId) {
    document.getElementById('title').textContent = 'Ошибка: не указан номер заказа';
}

document.getElementById('title').textContent = `Изделия заказа №${zakazId}`;

async function loadItems() {
    const res = await fetch(`/api/izdeliya?zakazId=${zakazId}`);
    if (!res.ok) { console.error('Ошибка API:', res.status); return; }
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];

    const tbody = document.getElementById('itemsTable');
    tbody.innerHTML = '';

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.naimenovanie}</td>
            <td>${item.kolichestvo}</td>
            <td>${item.harakteristiki || '—'}</td>
            <td>
                <button class="btn btn-danger" onclick="deleteItem(${item.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function addItem() {
    const naimenovanie = document.getElementById('naimenovanie').value.trim();
    const kolichestvo = parseInt(document.getElementById('kolichestvo').value);
    const harakteristiki = document.getElementById('harakteristiki').value.trim();

    if (!naimenovanie) {
        alert('Введите наименование!');
        return;
    }

    await fetch('/api/izdeliya', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idZakaza: zakazId, naimenovanie, kolichestvo, harakteristiki })
    });

    document.getElementById('naimenovanie').value = '';
    document.getElementById('kolichestvo').value = '1';
    document.getElementById('harakteristiki').value = '';

    loadItems();
}


async function deleteItem(id) {
    if (!confirm('Удалить изделие?')) return;
    await fetch(`/api/izdeliya/${id}`, { method: 'DELETE' });
    loadItems();
}

loadItems();