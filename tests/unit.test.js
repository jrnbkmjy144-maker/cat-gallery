process.env.JWT_SECRET = 'test_unit_secret_key';

const jwt = require('jsonwebtoken');
const {
    validateIdParam,
    validateRegister,
    validateLogin,
    validateArtwork,
    validateOrderCreate
} = require('../src/middleware/validate');
const { authenticateToken, requireAdmin } = require('../src/middleware/auth');

function createMockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('Unit-тести: Middleware валідації та авторизації (Purrfect Art)', () => {
    test('UT-01: validateIdParam пропускає коректний числовий ID та записує req.resourceId', () => {
        const req = { params: { id: '15' } };
        const res = createMockRes();
        const next = jest.fn();

        validateIdParam(req, res, next);

        expect(req.resourceId).toBe(15);
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('UT-02: validateIdParam відхиляє нечисловий або від’ємний ID зі статусом 400', () => {
        const req = { params: { id: 'abc' } };
        const res = createMockRes();
        const next = jest.fn();

        validateIdParam(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test('UT-03: validateRegister відхиляє некоректний email, коротке ім’я та слабкий пароль', () => {
        const req = {
            body: { name: 'А', email: 'invalid-email', phone: '123', password: '123' }
        };
        const res = createMockRes();
        const next = jest.fn();

        validateRegister(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Помилка валідації даних',
                details: expect.arrayContaining([
                    expect.stringContaining("Ім'я"),
                    expect.stringContaining('електронної пошти'),
                    expect.stringContaining('телефону'),
                    expect.stringContaining('Пароль')
                ])
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('UT-04: validateLogin відхиляє запит із пробілами замість email або пароля (BUG-03)', () => {
        const req = { body: { email: '   ', password: '   ' } };
        const res = createMockRes();
        const next = jest.fn();

        validateLogin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test('UT-05: validateArtwork відхиляє від’ємну ціну та булеві типи замість чисел', () => {
        const req = {
            body: {
                category_id: true,
                title: 'Космічний Мурчик',
                description: 'Опис картини для перевірки валідації',
                price: -250,
                technique: 'Олія на полотні',
                size: '50x70 см',
                year: 2025,
                image_url: 'https://example.com/cat.jpg'
            }
        };
        const res = createMockRes();
        const next = jest.fn();

        validateArtwork(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test('UT-06: authenticateToken декодує валідний Bearer JWT та передає керування далі', () => {
        const token = jwt.sign({ id: 7, email: 'user@purrfect.ua', role: 'client' }, process.env.JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = createMockRes();
        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(req.user).toMatchObject({ id: 7, email: 'user@purrfect.ua', role: 'client' });
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('UT-07: requireAdmin блокує користувача з роллю client зі статусом 403', () => {
        const req = { user: { id: 7, role: 'client' } };
        const res = createMockRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});