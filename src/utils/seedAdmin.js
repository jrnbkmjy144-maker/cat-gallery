const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedInitialUsers() {
    try {
        const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
        if (rows[0].count > 0) return;

        const adminHash = await bcrypt.hash('Admin123!', 10);
        const clientHash = await bcrypt.hash('Client123!', 10);

        await pool.query(
            `INSERT INTO users (name, email, phone, password_hash, role) VALUES
             ('Адміністратор Галереї', 'admin@purrfect.art', '+380501112233', $1, 'admin'),
             ('Тестовий Клієнт', 'client@purrfect.art', '+380671234567', $2, 'client')`,
            [adminHash, clientHash]
        );
        console.log('Тестових користувачів створено (admin@purrfect.art / Admin123!, client@purrfect.art / Client123!)');
    } catch (err) {
        console.error('Помилка ініціалізації тестових користувачів:', err.message);
    }
}

module.exports = seedInitialUsers;