const API = 'http://localhost:5216/api';

let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Проверка авторизации
    const user = showUserInfo();
    if (!user) return;

    applyRoleRules(user);

    // 2. Загрузка подробных данных профиля с сервера
    await loadProfileData(user.id);
});

async function loadProfileData(userId) {
    try {
        const res = await fetch(`${API}/sotrudniki/${userId}`);
        if (!res.ok) throw new Error('Не удалось получить данные сотрудника');

        currentProfile = await res.json();
        renderProfile(currentProfile);
    } catch (err) {
        console.error(err);
        const fallbackUser = JSON.parse(localStorage.getItem('user'));
        if (fallbackUser) {
            renderProfile({
                id: fallbackUser.id,
                fio: fallbackUser.fio,
                login: fallbackUser.login || 'admin',
                telefon: fallbackUser.telefon || '',
                idRoli: fallbackUser.idRoli || 1,
                rol: { nazvanie: fallbackUser.rol || 'Администратор' }
            });
        }
    }
}

function renderProfile(p) {
    const initials = p.fio ? p.fio.charAt(0).toUpperCase() : 'U';
    const roleName = p.rol ? p.rol.nazvanie : (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).rol : 'Сотрудник');

    // Hero-карточка
    const avatarEl = document.getElementById('profileAvatarLarge');
    const btnDel = document.getElementById('btnDeletePhoto');
    if (p.foto) {
        avatarEl.innerHTML = `<img src="${p.foto}" alt="${initials}" style="width:100%; height:100%; object-fit:cover; border-radius:20px;">`;
        if (btnDel) btnDel.style.display = 'inline-block';
    } else {
        avatarEl.textContent = initials;
        if (btnDel) btnDel.style.display = 'none';
    }

    document.getElementById('profileHeroName').textContent = p.fio;
    document.getElementById('profileHeroRole').textContent = roleName;
    document.getElementById('topbarUserRole').textContent = `${roleName} • Онлайн`;

    // Метаданные
    document.getElementById('metaUserId').textContent = `#${p.id}`;
    document.getElementById('metaUserLogin').textContent = p.login || '—';
    document.getElementById('metaUserPhone').textContent = p.telefon || 'Не указан';

    let accessDesc = 'Базовый доступ к производственному экрану';
    if (roleName === 'Администратор') {
        accessDesc = 'SuperAdmin: полный root-доступ ко всем разделам и БД';
    } else if (roleName === 'Менеджер' || roleName === 'Начальник производства') {
        accessDesc = 'Диспетчеризация, аналитика и ведение клиентов';
    } else if (roleName === 'Бухгалтер') {
        accessDesc = 'Учёт и финансово-производственные отчёты';
    } else if (roleName === 'Дизайнер' || roleName === 'Конструктор') {
        accessDesc = 'Спецификации и технологические маршруты изделий';
    }
    document.getElementById('metaUserAccess').textContent = accessDesc;

    // Заполнение формы личных данных
    document.getElementById('profileFio').value = p.fio || '';
    document.getElementById('profilePhone').value = p.telefon || '';
    document.getElementById('profileLogin').value = p.login || '';
    document.getElementById('profileRoleDisabled').value = roleName;
}

// Сохранение личных данных
async function saveProfileInfo(event) {
    event.preventDefault();
    const alertBox = document.getElementById('infoAlert');
    alertBox.className = 'alert-box';
    alertBox.style.display = 'none';

    if (!currentProfile) return;

    const fio = document.getElementById('profileFio').value.trim();
    const telefon = document.getElementById('profilePhone').value.trim();
    const login = document.getElementById('profileLogin').value.trim();

    if (!fio || !login) {
        showCustomAlert(alertBox, 'Пожалуйста, заполните ФИО и логин!', 'error');
        return;
    }

    const payload = {
        id: currentProfile.id,
        fio: fio,
        telefon: telefon || null,
        login: login,
        idRoli: currentProfile.idRoli || (currentProfile.rol ? currentProfile.rol.id : 1),
        parol: currentProfile.parol || null
    };

    try {
        const res = await fetch(`${API}/sotrudniki/${currentProfile.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            currentProfile.fio = fio;
            currentProfile.telefon = telefon || null;
            currentProfile.login = login;

            // Обновляем данные текущей сессии в localStorage
            const localUser = JSON.parse(localStorage.getItem('user')) || {};
            localUser.fio = fio;
            localUser.login = login;
            localStorage.setItem('user', JSON.stringify(localUser));

            // Обновляем отображение
            renderProfile(currentProfile);
            showUserInfo();

            showCustomAlert(alertBox, 'Личные данные успешно обновлены!', 'success');
        } else {
            showCustomAlert(alertBox, 'Не удалось сохранить данные на сервере.', 'error');
        }
    } catch (err) {
        console.error(err);
        showCustomAlert(alertBox, 'Ошибка связи с сервером базы данных.', 'error');
    }
}

// Смена пароля
async function changePassword(event) {
    event.preventDefault();
    const alertBox = document.getElementById('passwordAlert');
    alertBox.className = 'alert-box';
    alertBox.style.display = 'none';

    if (!currentProfile) return;

    const currentPass = document.getElementById('currentPassword').value.trim();
    const newPass = document.getElementById('newPassword').value.trim();
    const confirmPass = document.getElementById('confirmPassword').value.trim();

    // Проверка текущего пароля (если сохранён на сервере)
    if (currentProfile.parol && currentPass !== currentProfile.parol) {
        showCustomAlert(alertBox, 'Текущий пароль указан неверно!', 'error');
        return;
    }

    if (newPass.length < 6) {
        showCustomAlert(alertBox, 'Новый пароль должен содержать не менее 6 символов!', 'error');
        return;
    }

    if (newPass !== confirmPass) {
        showCustomAlert(alertBox, 'Новый пароль и подтверждение не совпадают!', 'error');
        return;
    }

    const payload = {
        id: currentProfile.id,
        fio: currentProfile.fio,
        telefon: currentProfile.telefon,
        login: currentProfile.login,
        idRoli: currentProfile.idRoli || (currentProfile.rol ? currentProfile.rol.id : 1),
        parol: newPass
    };

    try {
        const res = await fetch(`${API}/sotrudniki/${currentProfile.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            currentProfile.parol = newPass;

            // Очистка полей ввода пароля
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';

            showCustomAlert(alertBox, 'Пароль учетной записи успешно изменен!', 'success');
        } else {
            showCustomAlert(alertBox, 'Не удалось обновить пароль на сервере.', 'error');
        }
    } catch (err) {
        console.error(err);
        showCustomAlert(alertBox, 'Ошибка связи с сервером.', 'error');
    }
}

function showCustomAlert(box, text, type) {
    box.textContent = text;
    box.className = `alert-box ${type}`;
    box.style.display = 'flex';
}

// Загрузка и удаление фотографии профиля
function triggerPhotoUpload() {
    document.getElementById('photoFileInput').click();
}

async function handlePhotoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите файл изображения (PNG, JPG, WEBP).');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5 МБ.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            // Масштабируем до 256x256 для ультра-быстрой загрузки и хранения
            const canvas = document.createElement('canvas');
            const size = 256;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Center-crop кадрирование
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;

            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            const base64Photo = canvas.toDataURL('image/jpeg', 0.88);

            await uploadPhotoToServer(base64Photo);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function uploadPhotoToServer(base64Photo) {
    if (!currentProfile) return;

    try {
        const res = await fetch(`${API}/sotrudniki/${currentProfile.id}/foto`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foto: base64Photo })
        });

        if (res.ok) {
            currentProfile.foto = base64Photo;

            // Обновляем текущую сессию в localStorage
            const localUser = JSON.parse(localStorage.getItem('user')) || {};
            localUser.foto = base64Photo;
            localStorage.setItem('user', JSON.stringify(localUser));

            renderProfile(currentProfile);
            showUserInfo();

            const alertBox = document.getElementById('infoAlert');
            showCustomAlert(alertBox, 'Фотография профиля успешно установлена!', 'success');
        } else {
            alert('Не удалось сохранить фото на сервере');
        }
    } catch (err) {
        console.error(err);
        alert('Ошибка связи с сервером');
    }
}

async function deleteProfilePhoto() {
    if (!confirm('Вы уверены, что хотите удалить фотографию профиля?')) return;
    if (!currentProfile) return;

    try {
        const res = await fetch(`${API}/sotrudniki/${currentProfile.id}/foto`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foto: null })
        });

        if (res.ok) {
            currentProfile.foto = null;

            // Обновляем текущую сессию в localStorage
            const localUser = JSON.parse(localStorage.getItem('user')) || {};
            delete localUser.foto;
            localStorage.setItem('user', JSON.stringify(localUser));

            renderProfile(currentProfile);
            showUserInfo();

            const alertBox = document.getElementById('infoAlert');
            showCustomAlert(alertBox, 'Фотография профиля удалена.', 'success');
        } else {
            alert('Не удалось удалить фото');
        }
    } catch (err) {
        console.error(err);
        alert('Ошибка связи с сервером');
    }
}

