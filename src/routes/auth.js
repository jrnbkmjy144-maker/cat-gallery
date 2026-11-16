const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validate');

const router = express.Router();

// POST /api/auth/register — реєстрація нового користувача
router.post('/register', validateRegister, async (req, res, next) => {
    try {
        const name = req.body.name.trim();
        const email = req.body.email.trim().toLowerCase();
        const phone = req.body.phone.trim();
        const password = req.body.password;

        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Користувач із такою електронною поштою вже існує.' });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            `INSERT INTO users (name, email, phone, password_hash, role)
             VALUES ($1, $2, $3, $4, 'client')
             RETURNING id, name, email, phone, role, created_at`,
            [name, email, phone, passwordHash]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.status(201).json({
            message: 'Реєстрація успішна',
            token,
            user
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/login — автентифікація користувача
router.post('/login', validateLogin, async (req, res, next) => {
    try {
        const email = req.body.email.trim().toLowerCase();
        const password = req.body.password;

        const result = await pool.query(
            'SELECT id, name, email, phone, password_hash, role FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Невірний email або пароль.' });
        }

        const userRecord = result.rows[0];
        const isMatch = await bcrypt.compare(password, userRecord.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Невірний email або пароль.' });
        }

        const token = jwt.sign(
            { id: userRecord.id, email: userRecord.email, role: userRecord.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        const { password_hash, ...safeUser } = userRecord;
        res.status(200).json({
            message: 'Вхід виконано успішно',
            token,
            user: safeUser
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/me — отримання даних поточного користувача за JWT
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Користувача не знайдено.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;