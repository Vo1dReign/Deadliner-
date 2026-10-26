async function doLogin() {
    const loginInput = document.getElementById('login');
    const parolInput = document.getElementById('parol');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.querySelector('.btn-submit');

    const login = loginInput ? loginInput.value.trim() : '';
    const parol = parolInput ? parolInput.value.trim() : '';

    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }

    if (!login || !parol) {
        showError('Пожалуйста, введите логин и пароль');
        return;
    }

    // Блокировка кнопки на время выполнения запроса
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Проверка учетных данных...';
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, parol })
        });

        if (!res.ok) {
            let msg = 'Неверный логин или пароль';
            try {
                const data = await res.json();
                if (data && data.message) {
                    msg = data.message;
                }
            } catch (_) {}
            showError(msg);
            return;
        }

        const user = await res.json();

        // Сохранение сессии пользователя в localStorage
        localStorage.setItem('user', JSON.stringify(user));

        if (submitBtn) {
            submitBtn.textContent = 'Успешно! Переход...';
        }

        // Переадресация на главную страницу системы
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Login error:', err);
        showError('Ошибка связи с сервером. Убедитесь, что сервер Deadliner.API и база данных запущены.');
    } finally {
        if (submitBtn && submitBtn.textContent !== 'Успешно! Переход...') {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти в систему';
        }
    }
}

function showError(text) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = text;
        errorDiv.style.display = 'block';
    } else {
        alert(text);
    }
}

// Заполнение формы при клике на демо-аккаунт
function fillCredentials(login, parol) {
    const loginInput = document.getElementById('login');
    const parolInput = document.getElementById('parol');
    if (loginInput && parolInput) {
        loginInput.value = login;
        parolInput.value = parol;
        doLogin();
    }
}
