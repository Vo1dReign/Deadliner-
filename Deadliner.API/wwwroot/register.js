async function registerUser() {
    const fio = document.getElementById('fio').value.trim();
    const telefon = document.getElementById('telefon').value.trim();
    const rolId = parseInt(document.getElementById('rol').value);
    const login = document.getElementById('login').value.trim();
    const parol = document.getElementById('parol').value.trim();

    if (!fio || !login || !parol) {
        alert('Заполните обязательные поля (ФИО, Логин, Пароль)!');
        return;
    }

    const newSotrudnik = {
        fio: fio,
        telefon: telefon,
        idRoli: rolId,
        rolId: rolId, 
        login: login,
        parol: parol
    };

    const res = await fetch('/api/sotrudniki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSotrudnik)
    });

    if (res.ok) {
        alert('Сотрудник успешно зарегистрирован!');
        window.location.href = 'login.html';
    } else {
        alert('Ошибка при регистрации. Возможно, такой логин уже занят или введены неверные данные.');
    }
}