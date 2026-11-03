const API = '/api';

let soundEnabled = false;
let audioCtx = null;
let idleTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    const user = showUserInfo();
    applyRoleRules(user);
    
    updateClock();
    loadWorkshop();

    setInterval(updateClock, 1000);

    setInterval(loadWorkshop, 30000);

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
        const active = orders.filter(o => o.status !== 'завершён' && o.status !== 'отгружен');

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
                hasCriticalOrders = true;
            } else if (daysLeft >= thresh.yellowFrom && daysLeft <= thresh.yellowTo) {
                colorClass = 'yellow';
            }

            const daysText = daysLeft < 0
                ? `<span class="overdue">ПРОСРОЧЕН на ${Math.abs(daysLeft)} дн.</span>`
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

        if (soundEnabled && hasCriticalOrders) {
            playAlertBeep();
        }
    } catch (err) {
        console.error('Ошибка опроса заказов цеха', err);
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showToast('Не удалось включить полноэкранный режим', 'warning', 'Режим экрана');
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('soundBtn');

    if (soundEnabled) {
        btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
            </svg>
            <span>Звук: ВКЛ</span>
        `;
        btn.style.background = '#10b981';

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        playAlertBeep();
    } else {
        btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <span>Звук: Выкл</span>
        `;
        btn.style.background = '#334155';
    }
} 


function playAlertBeep() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
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