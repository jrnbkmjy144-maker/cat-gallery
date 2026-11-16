const express = require('express');
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { validateIdParam, validateOrderCreate } = require('../middleware/validate');

const router = express.Router();

// Усі маршрути замовлень вимагають JWT-автентифікації
router.use(authenticateToken);

// GET /api/orders — список замовлень (admin бачить усі, client — лише свої)
router.get('/', async (req, res, next) => {
    try {
        const baseQuery = `
            SELECT o.id, o.user_id, u.name AS customer_name, u.email AS customer_email,
                   o.artwork_id, a.title AS artwork_title, a.price AS artwork_price, a.image_url AS artwork_image,
                   o.delivery_phone, o.comment, o.status, o.created_at
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN artworks a ON o.artwork_id = a.id
        `;

        const result = req.user.role === 'admin'
            ? await pool.query(`${baseQuery} ORDER BY o.created_at DESC`)
            : await pool.query(`${baseQuery} WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [req.user.id]);

        res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/orders/:id — деталі конкретного замовлення
router.get('/:id', validateIdParam, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.user_id, u.name AS customer_name, u.email AS customer_email,
                    o.artwork_id, a.title AS artwork_title, a.price AS artwork_price,
                    o.delivery_phone, o.comment, o.status, o.created_at
             FROM orders o
             JOIN users u ON o.user_id = u.id
             JOIN artworks a ON o.artwork_id = a.id
             WHERE o.id = $1`,
            [req.resourceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Замовлення не знайдено.' });
        }

        const order = result.rows[0];
        if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
            return res.status(403).json({ error: 'У вас немає доступу до цього замовлення.' });
        }

        res.status(200).json(order);
    } catch (err) {
        next(err);
    }
});

// POST /api/orders — створення нового замовлення
router.post('/', validateOrderCreate, async (req, res, next) => {
    try {
        const artworkId = Number(req.body.artwork_id);
        const deliveryPhone = req.body.delivery_phone.trim();
        const comment = req.body.comment ? req.body.comment.trim() : '';

        const artCheck = await pool.query('SELECT id, title, is_available FROM artworks WHERE id = $1', [artworkId]);
        if (artCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Обрану картину не знайдено.' });
        }
        if (!artCheck.rows[0].is_available) {
            return res.status(400).json({ error: 'Ця картина вже продана або зарезервована.' });
        }

        const result = await pool.query(
            `INSERT INTO orders (user_id, artwork_id, delivery_phone, comment, status)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING id, user_id, artwork_id, delivery_phone, comment, status, created_at`,
            [req.user.id, artworkId, deliveryPhone, comment]
        );

        res.status(201).json({
            message: 'Замовлення успішно створено',
            order: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/orders/:id — оновлення статусу або коментаря замовлення
router.patch('/:id', validateIdParam, async (req, res, next) => {
    try {
        const existingResult = await pool.query('SELECT * FROM orders WHERE id = $1', [req.resourceId]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Замовлення не знайдено.' });
        }

        const existing = existingResult.rows[0];
        if (req.user.role !== 'admin' && existing.user_id !== req.user.id) {
            return res.status(403).json({ error: 'У вас немає прав для редагування цього замовлення.' });
        }

        const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        const nextStatus = req.body.status !== undefined ? req.body.status : existing.status;
        if (!allowedStatuses.includes(nextStatus)) {
            return res.status(400).json({ error: `Некоректний статус. Допустимі: ${allowedStatuses.join(', ')}` });
        }
        if (req.user.role !== 'admin' && nextStatus !== 'cancelled' && nextStatus !== existing.status) {
            return res.status(403).json({ error: 'Клієнт може змінити статус лише на cancelled.' });
        }

        const nextComment = req.body.comment !== undefined ? String(req.body.comment).trim() : existing.comment;
        const nextPhone = req.body.delivery_phone !== undefined ? String(req.body.delivery_phone).trim() : existing.delivery_phone;

        const updated = await pool.query(
            `UPDATE orders
             SET status = $1, comment = $2, delivery_phone = $3
             WHERE id = $4
             RETURNING *`,
            [nextStatus, nextComment, nextPhone, req.resourceId]
        );

        res.status(200).json(updated.rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/orders/:id — видалення замовлення
router.delete('/:id', validateIdParam, async (req, res, next) => {
    try {
        const existingResult = await pool.query('SELECT * FROM orders WHERE id = $1', [req.resourceId]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Замовлення не знайдено.' });
        }

        const existing = existingResult.rows[0];
        if (req.user.role !== 'admin' && existing.user_id !== req.user.id) {
            return res.status(403).json({ error: 'У вас немає прав для видалення цього замовлення.' });
        }

        await pool.query('DELETE FROM orders WHERE id = $1', [req.resourceId]);
        res.status(200).json({ message: 'Замовлення успішно видалено', deleted_id: req.resourceId });
    } catch (err) {
        next(err);
    }
});

module.exports = router;