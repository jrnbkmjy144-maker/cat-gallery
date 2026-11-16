const express = require('express');
const pool = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateIdParam, validateArtwork } = require('../middleware/validate');

const router = express.Router();

// GET /api/artworks/categories — список категорій
router.get('/categories', async (req, res, next) => {
    try {
        const result = await pool.query('SELECT id, name, description FROM categories ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/artworks — отримання всіх картин (з опціональною фільтрацією за category_id)
router.get('/', async (req, res, next) => {
    try {
        const { category_id } = req.query;
        let query = `
            SELECT a.id, a.category_id, c.name AS category_name, a.title, a.description,
                   a.price, a.technique, a.size, a.year, a.image_url, a.is_available, a.created_at
            FROM artworks a
            JOIN categories c ON a.category_id = c.id
        `;
        const params = [];

        if (category_id) {
            const catId = Number(category_id);
            if (!Number.isInteger(catId) || catId <= 0) {
                return res.status(400).json({ error: 'Некоректний параметр category_id.' });
            }
            query += ' WHERE a.category_id = $1';
            params.push(catId);
        }

        query += ' ORDER BY a.id ASC';
        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/artworks/:id — отримання однієї картини за ID
router.get('/:id', validateIdParam, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT a.id, a.category_id, c.name AS category_name, a.title, a.description,
                    a.price, a.technique, a.size, a.year, a.image_url, a.is_available, a.created_at
             FROM artworks a
             JOIN categories c ON a.category_id = c.id
             WHERE a.id = $1`,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Картину з вказаним ID не знайдено.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// POST /api/artworks — додавання нової картини (тільки admin)
router.post('/', authenticateToken, requireAdmin, validateArtwork, async (req, res, next) => {
    try {
        const { category_id, title, description, price, technique, size, year, image_url, is_available } = req.body;

        const catCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [Number(category_id)]);
        if (catCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Вказаної категорії не існує.' });
        }

        const result = await pool.query(
            `INSERT INTO artworks (category_id, title, description, price, technique, size, year, image_url, is_available)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                Number(category_id),
                title.trim(),
                description.trim(),
                Number(price),
                technique.trim(),
                size.trim(),
                Number(year),
                image_url.trim(),
                is_available !== undefined ? Boolean(is_available) : true
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// PUT /api/artworks/:id — повне оновлення картини (тільки admin)
router.put('/:id', authenticateToken, requireAdmin, validateIdParam, validateArtwork, async (req, res, next) => {
    try {
        const { category_id, title, description, price, technique, size, year, image_url, is_available } = req.body;

        const catCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [Number(category_id)]);
        if (catCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Вказаної категорії не існує.' });
        }

        const result = await pool.query(
            `UPDATE artworks
             SET category_id = $1, title = $2, description = $3, price = $4,
                 technique = $5, size = $6, year = $7, image_url = $8, is_available = $9
             WHERE id = $10
             RETURNING *`,
            [
                Number(category_id),
                title.trim(),
                description.trim(),
                Number(price),
                technique.trim(),
                size.trim(),
                Number(year),
                image_url.trim(),
                is_available !== undefined ? Boolean(is_available) : true,
                req.resourceId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Картину для оновлення не знайдено.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/artworks/:id — видалення картини (тільки admin)
router.delete('/:id', authenticateToken, requireAdmin, validateIdParam, async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM artworks WHERE id = $1 RETURNING id, title', [req.resourceId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Картину для видалення не знайдено.' });
        }
        res.status(200).json({ message: 'Картину успішно видалено', deleted: result.rows[0] });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Неможливо видалити картину, оскільки на неї оформлені замовлення.' });
        }
        next(err);
    }
});

module.exports = router;