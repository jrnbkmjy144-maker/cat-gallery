const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-\(\)]{9,18}$/;

function validateIdParam(req, res, next) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Некоректний числовий ідентифікатор ресурсу.' });
    }
    req.resourceId = id;
    next();
}

function validateRegister(req, res, next) {
    const { name, email, phone, password } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
        errors.push("Ім'я є обов'язковим і має містити від 2 до 50 символів.");
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
        errors.push('Вкажіть коректну адресу електронної пошти.');
    }
    if (!phone || typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim())) {
        errors.push('Вкажіть коректний номер телефону (9–18 символів).');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        errors.push('Пароль має містити щонайменше 6 символів.');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Помилка валідації даних', details: errors });
    }
    next();
}

function validateLogin(req, res, next) {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Вкажіть email та пароль для входу.' });
    }
    next();
}

function validateArtwork(req, res, next) {
    const { category_id, title, description, price, technique, size, year, image_url } = req.body;
    const errors = [];

    if (!Number.isInteger(Number(category_id)) || Number(category_id) <= 0) {
        errors.push('category_id має бути додатним цілим числом.');
    }
    if (!title || typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 100) {
        errors.push('Назва картини має містити від 2 до 100 символів.');
    }
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
        errors.push('Опис картини має містити щонайменше 5 символів.');
    }
    const numPrice = Number(price);
    if (Number.isNaN(numPrice) || numPrice <= 0 || numPrice > 100000) {
        errors.push('Ціна повинна бути числом більшим за 0.');
    }
    if (!technique || typeof technique !== 'string' || technique.trim().length < 2) {
        errors.push('Вкажіть техніку виконання.');
    }
    if (!size || typeof size !== 'string' || size.trim().length < 3) {
        errors.push('Вкажіть розмір картини.');
    }
    const numYear = Number(year);
    if (!Number.isInteger(numYear) || numYear < 1900 || numYear > 2100) {
        errors.push('Рік створення має бути цілим числом у діапазоні 1900–2100.');
    }
    if (!image_url || typeof image_url !== 'string' || !/^https?:\/\/.+/.test(image_url.trim())) {
        errors.push('image_url має бути коректним HTTP/HTTPS посиланням.');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Помилка валідації картини', details: errors });
    }
    next();
}

function validateOrderCreate(req, res, next) {
    const { artwork_id, delivery_phone, comment } = req.body;
    const errors = [];

    if (!Number.isInteger(Number(artwork_id)) || Number(artwork_id) <= 0) {
        errors.push('Оберіть коректну картину зі списку (artwork_id).');
    }
    if (!delivery_phone || typeof delivery_phone !== 'string' || !PHONE_REGEX.test(delivery_phone.trim())) {
        errors.push('Вкажіть коректний контактний номер телефону.');
    }
    if (comment !== undefined && comment !== null && typeof comment === 'string' && comment.length > 300) {
        errors.push('Коментар не може перевищувати 300 символів.');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: 'Помилка валідації замовлення', details: errors });
    }
    next();
}

module.exports = {
    validateIdParam,
    validateRegister,
    validateLogin,
    validateArtwork,
    validateOrderCreate
};