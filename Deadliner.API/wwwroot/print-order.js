const API = 'http://localhost:5216/api';

const urlParams = new URLSearchParams(window.location.search);
const zakazId = urlParams.get('zakazId');

document.addEventListener('DOMContentLoaded', () => {
    if (!zakazId) {
        alert('Заказ не выбран!');
        window.location.href = 'index.html';
        return;
    }

    loadOrderData();
});

async function loadOrderData() {
    try {

        const resOrder = await fetch(`${API}/zakazy/${zakazId}`);
        if (!resOrder.ok) throw new Error('Ошибка загрузки данных заказа');
        const order = await resOrder.json();

        document.getElementById('docTitle').textContent = `НАРЯД-ЗАКАЗ № ${order.id}`;
        document.getElementById('clientName').textContent = order.klient?.fioNazvanie ?? '—';
        document.getElementById('clientPhone').textContent = order.klient?.telefon ?? '—';
        document.getElementById('clientAddress').textContent = order.klient?.adresObekta ?? '—';
        document.getElementById('dateReceive').textContent = order.dataPriema;
        document.getElementById('dateShip').textContent = order.planDataOtgruzki;
        document.getElementById('managerName').textContent = order.menedzher?.fio ?? 'Ревенко Е.А.';

        const itemsBody = document.getElementById('itemsBody');
        itemsBody.innerHTML = '';
        if (!order.izdeliya || order.izdeliya.length === 0) {
            itemsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Позиции изделий отсутствуют</td></tr>';
        } else {
            order.izdeliya.forEach((item, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="text-align:center;">${idx + 1}</td>
                    <td><strong>${item.nazvanie}</strong></td>
                    <td style="text-align:center;">${item.kolichestvo} шт.</td>
                    <td>${item.gabarity ?? 'По чертежу'}</td>
                `;
                itemsBody.appendChild(row);
            });
        }

        const resStages = await fetch(`${API}/etapyzakaza/zakaz/${zakazId}`);
        const stagesBody = document.getElementById('stagesBody');
        stagesBody.innerHTML = '';

        if (resStages.ok) {
            const stages = await resStages.json();
            if (stages && stages.length > 0) {
                stages.forEach((st, idx) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="text-align:center;">${idx + 1}</td>
                        <td>${st.etap?.nazvanie ?? `Этап #${st.idEtapa}`}</td>
                        <td style="text-align:center;">${st.planData}</td>
                        <td style="text-align:center;">${st.factData ?? '—'}</td>
                        <td style="text-align:center;">${st.status}</td>
                    `;
                    stagesBody.appendChild(row);
                });
            } else {
                stagesBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Маршрутные этапы не заданы</td></tr>';
            }
        }
    } catch (err) {
        console.error(err);
        alert('Не удалось сформировать печатную форму наряда');
    }
}