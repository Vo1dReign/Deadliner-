
const params = new URLSearchParams(window.location.search);
const zakazId = parseInt(params.get('zakazId'));

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);

    if (!zakazId || isNaN(zakazId)) {
        const titleEl = document.getElementById('title');
        if (titleEl) titleEl.textContent = 'Ошибка: не указан номер заказа';
        showToast('Заказ не выбран!', 'warning', 'Предупреждение');
        setTimeout(() => { window.location.href = 'index.html'; }, 1200);
        return;
    }

    const titleEl = document.getElementById('title');
    if (titleEl) titleEl.textContent = `Изделия заказа №${zakazId}`;
    loadItems();
});

async function loadItems() {
    const res = await fetch(`/api/izdeliya?zakazId=${zakazId}`);
    if (!res.ok) { console.error('Ошибка API:', res.status); return; }
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];

    const tbody = document.getElementById('itemsTable');
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">В спецификации этого заказа пока нет изделий. Добавьте первое изделие через форму ниже.</td></tr>';
        return;
    }

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${item.naimenovanie}</strong></td>
            <td>${item.kolichestvo} шт.</td>
            <td>${item.harakteristiki || '—'}</td>
            <td>
                <button class="btn-table-action action-rose manager-only" onclick="deleteItem(${item.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const user = typeof getUser === 'function' ? getUser() : null;
    if (user && typeof applyRoleRules === 'function') {
        applyRoleRules(user);
    }
}

async function addItem() {
    const naimenovanie = document.getElementById('naimenovanie').value.trim();
    const kolichestvo = parseInt(document.getElementById('kolichestvo').value) || 1;
    const harakteristiki = document.getElementById('harakteristiki').value.trim();

    if (!naimenovanie) {
        showToast('Введите наименование изделия!', 'warning', 'Внимание');
        return;
    }

    try {
        const res = await fetch('/api/izdeliya', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idZakaza: zakazId,
                zakazId: zakazId,
                naimenovanie: naimenovanie,
                kolichestvo: kolichestvo,
                harakteristiki: harakteristiki
            })
        });

        if (res.ok) {
            document.getElementById('naimenovanie').value = '';
            document.getElementById('kolichestvo').value = '1';
            document.getElementById('harakteristiki').value = '';
            showToast('Изделие успешно добавлено в заказ', 'success');
            loadItems();
        } else {
            let errorMsg = 'Не удалось сохранить изделие';
            try {
                const errData = await res.json();
                if (errData && errData.message) errorMsg = errData.message;
            } catch (_) {}
            showToast(errorMsg, 'error', 'Ошибка');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error', 'Сеть');
    }
}

async function deleteItem(id) {
    const confirmed = await showConfirm(
        'Удаление изделия',
        'Вы действительно хотите удалить это изделие из спецификации заказа?',
        { confirmText: 'Удалить', danger: true }
    );
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/izdeliya/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Изделие успешно удалено', 'success');
            loadItems();
        } else {
            showToast('Не удалось удалить изделие', 'error', 'Ошибка');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error', 'Сеть');
    }
}
