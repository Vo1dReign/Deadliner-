const API = 'http://localhost:5216/api';

let soundEnabled = false;
let audioCtx = null;
let idleTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    
    updateClock();
    loadWorkshop();

    // Каждую секунду обновляем часы
    setInterval(updateClock, 1000);

    // Каждые 30 секунд обновляем заказы без участия человека
    setInterval(loadWorkshop, 30000);

    // Логика автоскрытия курсора мыши при простое (через 3 секунды)
    initCursorHiding();
});

function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s}`;
}

async function loadWorkshop() {
    try {
        const response = await fetch(`${API}/zakazy`);
        if (!response.ok) return;

        const orders = await response.json();
        const active = orders.filter(o => o.status !== 'завершён');

        const tbody = document.getElementById('workshopTable');
        tbody.innerHTML = '';

        const thresh = JSON.parse(localStorage.getItem('customThresholds')) || { redDays: 2, yellowFrom: 3, yellowTo: 7 };
        let hasCriticalOrders = false;

        active.forEach(order => {
            const today = new Date();
            const shipDate = new Date(order.planDataOtgruzki);
            const daysLeft = Math.ceil((shipDate - today) / (1000 * 60 * 60 * 24));

            let colorClass = 'green';
            if (daysLeft <= thresh.redDays) {
                colorClass = 'red';
                hasCriticalOrders = true; // Зафиксирован критический заказ
            } else if (daysLeft >= thresh.yellowFrom && daysLeft <= thresh.yellowTo) {
                colorClass = 'yellow';
            }

            const daysText = daysLeft < 0
                ? `<span class="overdue">⚠ ПРОСРОЧЕН на ${Math.abs(daysLeft)} дн.</span>`
                : `${daysLeft} дн.`;

            const row = document.createElement('tr');
            row.className = colorClass;
            row.innerHTML = `
                <td><strong>#${order.id}</strong></td>
                <td>${order.klient?.fioNazvanie ?? '—'}</td>
                <td>${order.planDataOtgruzki}</td>
                <td class="days-left">${daysText}</td>
                <td>${order.status}</td>
            `;
            tbody.appendChild(row);
        });

        // Если включен звук и есть критические заказы — издаем звуковой зуммер
        if (soundEnabled && hasCriticalOrders) {
            playAlertBeep();
        }
    } catch (err) {
        console.error('Ошибка опроса заказов цеха', err);
    }
}

// 1. Полноэкранный режим Kiosk Mode
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            alert('Не удалось включить полноэкранный режим');
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// 2. Включение / выключение звукового сигнала
function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('soundBtn');

    if (soundEnabled) {
        btn.textContent = '🔔 Звук: ВКЛ';
        btn.style.background = '#22c55e';
        // Инициализируем AudioContext по клику пользователя
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        playAlertBeep(); // Тестовый пик
    } else {
        btn.textContent = '🔔 Звук: Выкл';
        btn.style.background = '#3478dc';
    }
}

// Генерация звука тревоги через встроенный Web Audio API
function playAlertBeep() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Гц (нота Ля)
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.3); 
    } catch (e) {
        console.warn('Audio API не поддерживается', e);
    }
}

function initCursorHiding() {
    document.addEventListener('mousemove', () => {
        document.body.classList.remove('hide-cursor');
        clearTimeout(idleTimer);

        idleTimer = setTimeout(() => {
            document.body.classList.add('hide-cursor');
        }, 3000);
    });
}