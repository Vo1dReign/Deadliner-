const API = 'http://localhost:5216/api';

const urlParams = new URLSearchParams(window.location.search);
const zakazId = urlParams.get('zakazId');

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);

    if (!zakazId) {
        alert('Заказ не выбран!');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('orderTitle').textContent = `Хроника и аудит заказа №${zakazId}`;
    loadAudit();
});

async function loadAudit() {
    const container = document.getElementById('timelineList');
    try {
        const response = await fetch(`${API}/zhurnalizmenenii/zakaz/${zakazId}`);
        if (!response.ok) throw new Error('Ошибка загрузки журнала');

        const logs = await response.json();
        container.innerHTML = '';

        if (!logs || logs.length === 0) {
            container.innerHTML = '<div style="color: #aab4d0; padding: 12px 0;">История действий по данному заказу пока пуста</div>';
            return;
        }

        logs.forEach(log => {
            const date = new Date(log.dataIzmenenia);
            const formattedDate = date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const author = log.sotrudnik?.fio ?? `Сотрудник #${log.idSotrudnika}`;

            const item = document.createElement('div');
            item.className = 'timeline-item';
            item.innerHTML = `
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-author">👤 ${author}</span>
                        <span>🕒 ${formattedDate}</span>
                    </div>
                    <div class="timeline-desc">${log.opisanieIzmenenia}</div>
                </div>
            `;
            container.appendChild(item);
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color: #ef4444;">Не удалось загрузить историю заказа</div>';
    }
}

async function addAuditNote(event) {
    event.preventDefault();

    const textInput = document.getElementById('noteText');
    const text = textInput.value.trim();
    if (!text) return;

    const user = JSON.parse(localStorage.getItem('user'));
    const authorId = user?.id ?? 1;

    const payload = {
        idZakaza: parseInt(zakazId),
        idSotrudnika: authorId,
        opisanieIzmenenia: text
    };

    try {
        const res = await fetch(`${API}/zhurnalizmenenii`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            textInput.value = '';
            loadAudit();
        } else {
            alert('Ошибка при сохранении записи аудита');
        }
    } catch (err) {
        alert('Ошибка связи с сервером');
    }
}