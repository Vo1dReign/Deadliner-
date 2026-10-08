const API = 'http://localhost:5216/api';

let thresholdsData = [];

document.addEventListener('DOMContentLoaded', () => {
    // Проверка авторизации
    const user = showUserInfo();
    applyRoleRules(user);

    loadThresholds();
});

// Загрузка актуальных порогов из БД
async function loadThresholds() {
    try {
        const response = await fetch(`${API}/porogisrochnosti`);
        if (!response.ok) throw new Error('Ошибка загрузки');

        thresholdsData = await response.json();

        // Заполняем поля ввода значениями из базы
        const green = thresholdsData.find(t => t.cvet.toLowerCase().includes('зел'));
        const yellow = thresholdsData.find(t => t.cvet.toLowerCase().includes('жёл') || t.cvet.toLowerCase().includes('жел'));
        const red = thresholdsData.find(t => t.cvet.toLowerCase().includes('крас'));

        if (green) document.getElementById('greenDays').value = green.dneyOt - 1; // например > 7 дней
        if (yellow) {
            document.getElementById('yellowFrom').value = yellow.dneyOt;
            document.getElementById('yellowTo').value = yellow.dneyDo;
        }
        if (red) document.getElementById('redDays').value = red.dneyDo;

    } catch (err) {
        console.error(err);
        alert('Не удалось загрузить текущие настройки с сервера');
    }
}

// Сохранение обновленных порогов в базу данных
async function saveSettings(event) {
    event.preventDefault();

    const greenDays = parseInt(document.getElementById('greenDays').value);
    const yellowFrom = parseInt(document.getElementById('yellowFrom').value);
    const yellowTo = parseInt(document.getElementById('yellowTo').value);
    const redDays = parseInt(document.getElementById('redDays').value);

    const green = thresholdsData.find(t => t.cvet.toLowerCase().includes('зел'));
    const yellow = thresholdsData.find(t => t.cvet.toLowerCase().includes('жёл') || t.cvet.toLowerCase().includes('жел'));
    const red = thresholdsData.find(t => t.cvet.toLowerCase().includes('крас'));

    try {
        // Обновляем зеленый порог в БД
        if (green) {
            await fetch(`${API}/porogisrochnosti/${green.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: green.id, cvet: green.cvet, dneyOt: greenDays + 1, dneyDo: 999 })
            });
        }

        // Обновляем желтый порог в БД
        if (yellow) {
            await fetch(`${API}/porogisrochnosti/${yellow.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: yellow.id, cvet: yellow.cvet, dneyOt: yellowFrom, dneyDo: yellowTo })
            });
        }

        // Обновляем красный порог в БД
        if (red) {
            await fetch(`${API}/porogisrochnosti/${red.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: red.id, cvet: red.cvet, dneyOt: -999, dneyDo: redDays })
            });
        }

        // Сохраняем в кэш браузера для мгновенной перекраски на клиенте
        localStorage.setItem('customThresholds', JSON.stringify({
            yellowFrom: yellowFrom,
            yellowTo: yellowTo,
            redDays: redDays
        }));

        alert('Параметры срочности успешно сохранены!');
        window.location.href = 'index.html';
    } catch (err) {
        console.error(err);
        alert('Ошибка при сохранении настроек');
    }
}