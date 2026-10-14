async function registerUser() {
    const fio = document.getElementById('fio').value.trim();
    const telefon = document.getElementById('telefon').value.trim();
    const rolId = parseInt(document.getElementById('rol').value);
    const login = document.getElementById('login').value.trim();
    const parol = document.getElementById('parol').value.trim();

    if (!fio || !login || !parol) {
        showToast('Заполните обязательные поля (ФИО, Логин, Пароль)!', 'warning', 'Внимание');
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

    try {
        const res = await fetch('/api/sotrudniki', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSotrudnik)
        });

        if (res.ok) {
            showToast('Сотрудник успешно зарегистрирован!', 'success', 'Успех');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1200);
        } else {
            showToast('Ошибка при регистрации. Возможно, такой логин уже занят или введены неверные данные.', 'error', 'Ошибка');
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error', 'Сеть');
    }
}