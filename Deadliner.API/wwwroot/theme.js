/**
 * DeadLiner MES — Менеджер темы оформления (Светлая / Тёмная)
 * ООО «МикМебель»
 */

// Экран цеха (workshop.html) и печатная форма (print-order.html) работают в фиксированном режиме без переключателя
const isWorkshopScreen = window.location.pathname.toLowerCase().includes('workshop.html');
const isPrintScreen = window.location.pathname.toLowerCase().includes('print-order.html');

(function () {
    try {
        if (isWorkshopScreen) {
            document.documentElement.setAttribute('data-theme', 'dark');
            return;
        }
        if (isPrintScreen) {
            return;
        }

        const savedTheme = localStorage.getItem('deadliner_theme');
        // Если тема ещё не была сохранена, по умолчанию включаем тёмную тему
        const activeTheme = savedTheme || 'dark';
        document.documentElement.setAttribute('data-theme', activeTheme);
        
        // Быстрое обновление логотипа при первой готовности документа
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => updateLogos(activeTheme));
        } else {
            updateLogos(activeTheme);
        }
    } catch (e) {
        console.warn('Theme initialization error:', e);
    }
})();

function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
}

function updateLogos(theme) {
    if (isWorkshopScreen || isPrintScreen) return;
    const isDark = (theme === 'dark');
    const targetSrc = isDark ? 'logo_dark.png' : 'logo.png';
    const logos = document.querySelectorAll('.sidebar-logo-img, .company-logo, .login-header img, .card-header img, img[alt*="МикМебель"]');
    logos.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.includes('logo.png') || src.includes('logo_dark.png')) {
            if (!src.endsWith(targetSrc)) {
                img.src = targetSrc;
            }
        }
    });
}

function setTheme(theme) {
    if (isWorkshopScreen || isPrintScreen) return;
    const targetTheme = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', targetTheme);
    try {
        localStorage.setItem('deadliner_theme', targetTheme);
    } catch (e) {}
    updateThemeButtons();
    updateLogos(targetTheme);
}

function toggleTheme() {
    if (isWorkshopScreen || isPrintScreen) return;
    const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof showToast === 'function') {
        showToast(
            nextTheme === 'dark' ? 'Активирована тёмная тема оформления' : 'Активирована светлая тема оформления',
            'info',
            'Тема оформления'
        );
    }
}

function getThemeButtonHtml(isDark) {
    if (isDark) {
        return `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span class="theme-btn-label">Светлая тема</span>
        `;
    } else {
        return `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span class="theme-btn-label">Тёмная тема</span>
        `;
    }
}

function updateThemeButtons() {
    if (isWorkshopScreen || isPrintScreen) return;
    const isDark = getTheme() === 'dark';
    document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
        btn.innerHTML = getThemeButtonHtml(isDark);
        btn.setAttribute('title', isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему');
        btn.setAttribute('aria-label', isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему');
    });
}

function initThemeUI() {
    if (isWorkshopScreen || isPrintScreen) return;
    const isDark = getTheme() === 'dark';

    // 1. Если на странице есть .topbar-actions (все основные рабочие экраны)
    const topbarActions = document.querySelector('.topbar-actions');
    if (topbarActions && !document.getElementById('topbarThemeToggle')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'topbarThemeToggle';
        btn.className = 'btn-theme-toggle topbar-theme-btn';
        btn.innerHTML = getThemeButtonHtml(isDark);
        btn.title = isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
        btn.onclick = toggleTheme;
        topbarActions.insertBefore(btn, topbarActions.firstChild);
    }

    // 2. Если на странице нет topbar (авторизация login.html, register.html)
    if (!topbarActions && !document.getElementById('floatingThemeToggle')) {
        const floatingBox = document.createElement('div');
        floatingBox.id = 'floatingThemeToggle';
        floatingBox.className = 'theme-toggle-floating';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-theme-toggle floating-theme-btn';
        btn.innerHTML = getThemeButtonHtml(isDark);
        btn.title = isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
        btn.onclick = toggleTheme;

        floatingBox.appendChild(btn);
        document.body.appendChild(floatingBox);
    }

    // Инициализация логотипа
    updateLogos(getTheme());
}

if (!isWorkshopScreen && !isPrintScreen) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeUI);
    } else {
        initThemeUI();
    }
}
