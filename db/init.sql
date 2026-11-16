-- 1. Таблиця користувачів
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL CHECK (char_length(name) >= 2),
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблиця категорій (жанрів)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- 3. Таблиця картин
CREATE TABLE IF NOT EXISTS artworks (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
    technique VARCHAR(60) NOT NULL,
    size VARCHAR(30) NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2100),
    image_url TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Таблиця замовлень
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artwork_id INTEGER NOT NULL REFERENCES artworks(id) ON DELETE RESTRICT,
    delivery_phone VARCHAR(20) NOT NULL,
    comment VARCHAR(300),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Початкові категорії
INSERT INTO categories (name, description) VALUES
    ('Бізнес', 'Ділові та серйозні котячі образи для кабінету чи офісу'),
    ('Загальне', 'Класичні портрети та затишні сцени з життя котів'),
    ('Комедія', 'Гумористичні, магічні та експресивні ілюстрації')
ON CONFLICT (name) DO NOTHING;

-- Початкові картини (перенесені з практикуму №1)
INSERT INTO artworks (category_id, title, description, price, technique, size, year, image_url)
SELECT c.id, v.title, v.description, v.price, v.technique, v.size, v.year, v.image_url
FROM (VALUES
    ('Бізнес', 'Бізнес-кіт', 'Стриманий портрет кота у діловому стилі, виконаний графічним олівцем із деталізацією погляду.', 140.00, 'Олівець', '50x65 см', 2025, 'https://i.pinimg.com/736x/e2/f4/87/e2f487b4265be2707d3321aa9c1864b1.jpg'),
    ('Загальне', 'Зацікавленість', 'Легкий ескізний портрет, що передає природну допитливість та грацію пухнастого героя.', 110.00, 'Олівець', '40x40 см', 2024, 'https://i.pinimg.com/1200x/6a/ac/34/6aac34527a9be36bf61ec37c3884dded.jpg'),
    ('Комедія', 'Чудово', 'Харизматична робота з яскравою емоцією схвалення, яка піднімає настрій у будь-якому інтер’єрі.', 180.00, 'Олівець', '60x80 см', 2025, 'https://i.pinimg.com/736x/62/d9/fc/62d9fcbce9ccf6c207112714c23b9cb3.jpg'),
    ('Комедія', 'Чаклун', 'Містичний та кумедний образ кота-чарівника, написаний насиченими олійними фарбами.', 155.00, 'Олія', '50x70 см', 2026, 'https://i.pinimg.com/736x/06/f7/36/06f736d7a1637d039e9250ad75bf7c69.jpg'),
    ('Комедія', 'Надмузика', 'Експресивний акриловий живопис про кота, який повністю поринув у ритм улюбленої мелодії.', 125.00, 'Акрил', '40x50 см', 2025, 'https://i.pinimg.com/736x/c3/4e/ce/c34ecec70ec9afe7eb2e4f6184fdc7af.jpg'),
    ('Загальне', 'Задоволення', 'Тепла картина на полотні, що випромінює спокій, затишок та абсолютну гармонію.', 190.00, 'Полотно, олія', '60x60 см', 2026, 'https://i.pinimg.com/736x/07/f5/52/07f5525954368fb8c6d458c855364de7.jpg')
) AS v(cat_name, title, description, price, technique, size, year, image_url)
JOIN categories c ON c.name = v.cat_name
WHERE NOT EXISTS (SELECT 1 FROM artworks);