process.env.JWT_SECRET = 'test_api_secret_key';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');
const app = require('../src/server');

jest.mock('../src/config/db', () => ({
    query: jest.fn()
}));

const clientToken = jwt.sign({ id: 2, email: 'client@purrfect.ua', role: 'client' }, process.env.JWT_SECRET);
const adminToken = jwt.sign({ id: 1, email: 'admin@purrfect.ua', role: 'admin' }, process.env.JWT_SECRET);

describe('Интеграционные API-тести: REST API Purrfect Art', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // === 1. СИСТЕМНЫЕ МАРШРУТЫ ===
    test('API-01: GET /api/health повертає статус 200 та стан сервера ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('API-02: Запит до неіснуючого маршруту /api/unknown повертає 404 Not Found', async () => {
        const res = await request(app).get('/api/unknown');
        expect(res.statusCode).toBe(404);
    });

    // === 2. АУТЕНТИФИКАЦИЯ И ПРОФИЛЬ (src/routes/auth.js) ===
    test('API-03: POST /api/auth/register успішно реєструє нового клієнта (201 Created)', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [] }) // email вільний
            .mockResolvedValueOnce({
                rows: [{ id: 10, name: 'Олена', email: 'olena@test.ua', phone: '+380991112233', role: 'client' }]
            });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Олена',
                email: 'olena@test.ua',
                phone: '+380991112233',
                password: 'Password123'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user.email).toBe('olena@test.ua');
    });

    test('API-04: POST /api/auth/register відхиляє дублікат email зі статусом 409 Conflict', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Олена',
                email: 'client@purrfect.ua',
                phone: '+380991112233',
                password: 'Password123'
            });

        expect(res.statusCode).toBe(409);
    });

    test('API-05: POST /api/auth/login повертає JWT-токен при коректних облікових даних (200 OK)', async () => {
        const hash = await bcrypt.hash('Secret123', 10);
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 2, name: 'Іван', email: 'client@purrfect.ua', phone: '+380991234567', password_hash: hash, role: 'client' }]
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'client@purrfect.ua', password: 'Secret123' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).not.toHaveProperty('password_hash');
    });

    test('API-06: POST /api/auth/login відхиляє неіснуючого користувача (401 Unauthorized)', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'ghost@purrfect.ua', password: 'Secret123' });

        expect(res.statusCode).toBe(401);
    });

    test('API-07: POST /api/auth/login відхиляє невірний пароль (401 Unauthorized)', async () => {
        const hash = await bcrypt.hash('RightPass123', 10);
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 2, email: 'client@purrfect.ua', password_hash: hash, role: 'client' }]
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'client@purrfect.ua', password: 'WrongPassword' });

        expect(res.statusCode).toBe(401);
    });

    test('API-08: GET /api/auth/me повертає профіль поточного користувача або 404', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 2, name: 'Іван', email: 'client@purrfect.ua', role: 'client' }]
        });
        const okRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(okRes.statusCode).toBe(200);
        expect(okRes.body.id).toBe(2);

        pool.query.mockResolvedValueOnce({ rows: [] });
        const notFoundRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(notFoundRes.statusCode).toBe(404);
    });

    // === 3. КАТАЛОГ КАРТИН (src/routes/artworks.js) ===
    test('API-09: GET /api/artworks/categories повертає список категорій (200 OK)', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Класика' }] });
        const res = await request(app).get('/api/artworks/categories');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    test('API-10: GET /api/artworks підтримує фільтрацію за category_id та відхиляє невалідний параметр', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, category_id: 2, title: 'Кібер-кіт' }] });
        const okRes = await request(app).get('/api/artworks?category_id=2');
        expect(okRes.statusCode).toBe(200);

        const badRes = await request(app).get('/api/artworks?category_id=abc');
        expect(badRes.statusCode).toBe(400);
    });

    test('API-11: GET /api/artworks/:id повертає картину (200), 404 при відсутності та 400 при нечисловому ID', async () => {
        const badRes = await request(app).get('/api/artworks/invalid-id');
        expect(badRes.statusCode).toBe(400);

        pool.query.mockResolvedValueOnce({ rows: [] });
        const notFoundRes = await request(app).get('/api/artworks/999');
        expect(notFoundRes.statusCode).toBe(404);

        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Зоряний кіт' }] });
        const okRes = await request(app).get('/api/artworks/1');
        expect(okRes.statusCode).toBe(200);
    });

    test('API-12: POST /api/artworks блокує client (403) та дозволяє admin створювати картину (201)', async () => {
        const payload = {
            category_id: 1,
            title: 'Кібер-Мурчик',
            description: 'Неоновий портрет кота у стилі кіберпанк',
            price: 4500,
            technique: 'Цифровий живопис',
            size: '60x80 см',
            year: 2026,
            image_url: 'https://example.com/cyber-cat.jpg'
        };

        const forbiddenRes = await request(app)
            .post('/api/artworks')
            .set('Authorization', `Bearer ${clientToken}`)
            .send(payload);
        expect(forbiddenRes.statusCode).toBe(403);

        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 12, ...payload, is_available: true }] });

        const createdRes = await request(app)
            .post('/api/artworks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(payload);
        expect(createdRes.statusCode).toBe(201);
        expect(createdRes.body.id).toBe(12);
    });

    test('API-13: PUT /api/artworks/:id оновлює картину (200) або повертає 404', async () => {
        const payload = {
            category_id: 1,
            title: 'Оновлений кіт',
            description: 'Оновлений детальний опис картини',
            price: 5000,
            technique: 'Олія',
            size: '50x70 см',
            year: 2026,
            image_url: 'https://example.com/updated.jpg'
        };

        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [{ id: 1, ...payload }] });
        const okRes = await request(app)
            .put('/api/artworks/1')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(payload);
        expect(okRes.statusCode).toBe(200);

        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 1 }] })
            .mockResolvedValueOnce({ rows: [] });
        const notFoundRes = await request(app)
            .put('/api/artworks/999')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(payload);
        expect(notFoundRes.statusCode).toBe(404);
    });

    test('API-14: DELETE /api/artworks/:id видаляє картину (200) та обробляє конфлікт замовлень (400)', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 3, title: 'Кіт' }] });
        const okRes = await request(app)
            .delete('/api/artworks/3')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(okRes.statusCode).toBe(200);

        const fkError = new Error('foreign key violation');
        fkError.code = '23503';
        pool.query.mockRejectedValueOnce(fkError);
        const conflictRes = await request(app)
            .delete('/api/artworks/1')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(conflictRes.statusCode).toBe(400);
    });

    // === 4. ЗАМОВЛЕННЯ ТА КОНТРОЛЬ ДОСТУПУ (src/routes/orders.js) ===
    test('API-15: GET /api/orders без токена повертає 401 Unauthorized', async () => {
        const res = await request(app).get('/api/orders');
        expect(res.statusCode).toBe(401);
    });

    test('API-16: GET /api/orders повертає всі замовлення для admin і лише власні для client', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
        const adminRes = await request(app)
            .get('/api/orders')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(adminRes.statusCode).toBe(200);
        expect(adminRes.body).toHaveLength(2);

        pool.query.mockResolvedValueOnce({ rows: [{ id: 2, user_id: 2 }] });
        const clientRes = await request(app)
            .get('/api/orders')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(clientRes.statusCode).toBe(200);
        expect(clientRes.body).toHaveLength(1);
    });

    test('API-17: GET /api/orders/:id блокує доступ до чужого замовлення (403 IDOR) та повертає 404', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 99 }] });
        const forbiddenRes = await request(app)
            .get('/api/orders/1')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(forbiddenRes.statusCode).toBe(403);

        pool.query.mockResolvedValueOnce({ rows: [] });
        const notFoundRes = await request(app)
            .get('/api/orders/999')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(notFoundRes.statusCode).toBe(404);
    });

    test('API-18: POST /api/orders створює замовлення, знімає картину з продажу (BUG-01) та відхиляє продану (400)', async () => {
        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Зоряний кіт', is_available: true }] })
            .mockResolvedValueOnce({ rows: [{ id: 5, user_id: 2, artwork_id: 1, status: 'pending' }] })
            .mockResolvedValueOnce({ rows: [] });

        const okRes = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ artwork_id: 1, delivery_phone: '+380991234567', comment: 'Нова Пошта' });
        expect(okRes.statusCode).toBe(201);
        expect(pool.query).toHaveBeenCalledWith('UPDATE artworks SET is_available = false WHERE id = $1', [1]);

        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Зоряний кіт', is_available: false }] });
        const soldRes = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ artwork_id: 1, delivery_phone: '+380991234567' });
        expect(soldRes.statusCode).toBe(400);
    });

    test('API-19: PATCH /api/orders/:id відхиляє невалідний телефон (BUG-02) та повертає картину при скасуванні', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{ id: 5, user_id: 2, artwork_id: 1, status: 'pending', comment: '', delivery_phone: '+380991234567' }]
        });
        const badPhoneRes = await request(app)
            .patch('/api/orders/5')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ delivery_phone: '12' });
        expect(badPhoneRes.statusCode).toBe(400);

        pool.query
            .mockResolvedValueOnce({
                rows: [{ id: 5, user_id: 2, artwork_id: 1, status: 'pending', comment: '', delivery_phone: '+380991234567' }]
            })
            .mockResolvedValueOnce({ rows: [{ id: 5, status: 'cancelled' }] })
            .mockResolvedValueOnce({ rows: [] });
        const cancelRes = await request(app)
            .patch('/api/orders/5')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ status: 'cancelled' });
        expect(cancelRes.statusCode).toBe(200);
        expect(pool.query).toHaveBeenCalledWith('UPDATE artworks SET is_available = true WHERE id = $1', [1]);
    });

    test('API-20: DELETE /api/orders/:id забороняє видалення чужого замовлення (403) та видаляє своє (200)', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 5, user_id: 99, artwork_id: 1 }] });
        const forbiddenRes = await request(app)
            .delete('/api/orders/5')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(forbiddenRes.statusCode).toBe(403);

        pool.query
            .mockResolvedValueOnce({ rows: [{ id: 5, user_id: 2, artwork_id: 1 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });
        const okRes = await request(app)
            .delete('/api/orders/5')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(okRes.statusCode).toBe(200);
    });
});
