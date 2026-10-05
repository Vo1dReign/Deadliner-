async function doLogin() {
    const login = document.getElementById('login').value.trim();
    const parol = document.getElementById('parol').value.trim();
    const errorDiv = document.getElementById('error');

    errorDiv.textContent = '';

    if (!login || !parol) {
        errorDiv.textContent = 'Введите логин и пароль';
        return;
    }

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, parol })
    });

    if (!res.ok) {
        errorDiv.textContent = 'Неверный логин или пароль';
        return;
    }

    const user = await res.json();

    localStorage.setItem('user', JSON.stringify(user));

    window.location.href = 'index.html';
}