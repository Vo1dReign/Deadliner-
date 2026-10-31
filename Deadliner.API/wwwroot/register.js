let isPhoneVerified = false;
let smsCooldownSeconds = 0;
let cooldownInterval = null;

// Автоматическая маска для белорусского номера телефона
function formatPhoneInput(input) {
    let val = input.value.replace(/\D/g, '');
    
    // Если начали вводить с 80...
    if (val.startsWith('80') && val.length > 2) {
        val = '375' + val.substring(2);
    } else if (val.startsWith('8')) {
        val = '375';
    }

    if (!val.startsWith('375')) {
        val = '375' + val;
    }

    // Ограничиваем 12 цифрами (375 + 9 цифр)
    val = val.substring(0, 12);

    let formatted = '+375';
    if (val.length > 3) {
        formatted += ' (' + val.substring(3, 5);
    }
    if (val.length > 5) {
        formatted += ') ' + val.substring(5, 8);
    }
    if (val.length > 8) {
        formatted += '-' + val.substring(8, 10);
    }
    if (val.length > 10) {
        formatted += '-' + val.substring(10, 12);
    }

    input.value = formatted;
}

// Запрос отправки SMS-кода
async function requestSmsCode() {
    const phoneInput = document.getElementById('telefon');
    const rawPhone = phoneInput.value.trim();

    if (!rawPhone || rawPhone.replace(/\D/g, '').length < 12) {
        showToast('Введите полный номер телефона в формате +375 (XX) XXX-XX-XX', 'warning', 'Проверка номера');
        return;
    }

    const btn = document.getElementById('btnSendSms');
    btn.disabled = true;
    btn.innerText = 'Отправка...';

    try {
        const res = await fetch('/api/auth/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefon: rawPhone })
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('otpBox').classList.add('active');
            document.getElementById('verificationCode').focus();

            // Показываем toast с кодом для демонстрации/тестирования
            const demoInfo = data.testCode ? ` (Код для теста: ${data.testCode})` : '';
            showToast(`${data.message}${demoInfo}`, 'success', 'SMS-код отправлен');

            // Запускаем 30-секундный таймер повторной отправки
            startSmsCooldown(30);
        } else {
            showToast(data.message || 'Ошибка отправки кода', 'error', 'Ошибка');
            btn.disabled = false;
            btn.innerText = 'Получить код';
        }
    } catch (err) {
        showToast('Ошибка соединения с сервером', 'error', 'Сеть');
        btn.disabled = false;
        btn.innerText = 'Получить код';
    }
}

// Обратный отсчёт до возможности повторной отправки
function startSmsCooldown(seconds) {
    smsCooldownSeconds = seconds;
    const btn = document.getElementById('btnSendSms');
    const timerText = document.getElementById('smsTimerText');

    clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
        smsCooldownSeconds--;
        if (smsCooldownSeconds <= 0) {
            clearInterval(cooldownInterval);
            btn.disabled = false;
            btn.innerText = 'Выслать повторно';
            timerText.innerText = '';
        } else {
            btn.disabled = true;
            btn.innerText = `Повтор (${smsCooldownSeconds}с)`;
            timerText.innerText = `Повторный запрос кода будет доступен через ${smsCooldownSeconds} сек.`;
        }
    }, 1000);
}

// Подтверждение SMS-кода
async function confirmSmsCode() {
    const rawPhone = document.getElementById('telefon').value.trim();
    const code = document.getElementById('verificationCode').value.trim();

    if (!code || code.length !== 4) {
        showToast('Введите 4-значный код из SMS', 'warning', 'Внимание');
        return;
    }

    try {
        const res = await fetch('/api/auth/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefon: rawPhone, code: code })
        });

        const data = await res.json();

        if (res.ok) {
            isPhoneVerified = true;
            document.getElementById('otpBox').classList.remove('active');
            document.getElementById('btnSendSms').style.display = 'none';
            document.getElementById('telefon').readOnly = true;
            document.getElementById('phoneVerifiedStatus').style.display = 'inline-flex';
            showToast('Номер телефона успешно подтверждён!', 'success', 'Успешно');
        } else {
            showToast(data.message || 'Неверный проверочный код', 'error', 'Ошибка');
        }
    } catch (err) {
        showToast('Ошибка проверки кода', 'error', 'Сеть');
    }
}

// Завершение регистрации
async function registerUser() {
    const fio = document.getElementById('fio').value.trim();
    const telefon = document.getElementById('telefon').value.trim();
    const rolId = parseInt(document.getElementById('rol').value);
    const login = document.getElementById('login').value.trim();
    const parol = document.getElementById('parol').value.trim();
    const verificationCode = document.getElementById('verificationCode')?.value?.trim() || '';

    if (!fio || !login || !parol) {
        showToast('Заполните все обязательные поля (ФИО, Логин, Пароль)!', 'warning', 'Внимание');
        return;
    }

    if (parol.length < 6) {
        showToast('Пароль должен содержать не менее 6 символов!', 'warning', 'Безопасность');
        return;
    }

    // Если телефон введён, проверяем, подтверждён ли он кодом
    if (telefon && !isPhoneVerified) {
        showToast('Пожалуйста, подтвердите номер телефона кодом из SMS!', 'warning', 'Верификация');
        return;
    }

    const newSotrudnik = {
        fio: fio,
        telefon: telefon,
        idRoli: rolId,
        rolId: rolId, 
        login: login,
        parol: parol,
        verificationCode: verificationCode
    };

    const submitBtn = document.getElementById('btnSubmitRegister');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Регистрация...';

    try {
        const res = await fetch('/api/sotrudniki', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSotrudnik)
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Сотрудник успешно зарегистрирован с PBKDF2 шифрованием пароля!', 'success', 'Успех');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1400);
        } else {
            showToast(data.message || 'Ошибка при регистрации. Проверьте данные.', 'error', 'Ошибка');
            submitBtn.disabled = false;
            submitBtn.innerText = 'Зарегистрировать аккаунт';
        }
    } catch (err) {
        showToast('Ошибка связи с сервером', 'error', 'Сеть');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Зарегистрировать аккаунт';
    }
}
