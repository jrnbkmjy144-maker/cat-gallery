const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const artworksRoutes = require('./routes/artworks');
const ordersRoutes = require('./routes/orders');
const seedInitialUsers = require('./utils/seedAdmin');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Обробка некоректного JSON у тілі запиту
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Некоректний формат JSON у тілі запиту.' });
    }
    next(err);
});

// Роздача клієнтської частини з практикуму №1
app.use(express.static(path.join(__dirname, '..', 'public')));

// Підключення REST API маршрутів
app.use('/api/auth', authRoutes);
app.use('/api/artworks', artworksRoutes);
app.use('/api/orders', ordersRoutes);

// Перевірка стану сервера
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Обробка неіснуючих API-маршрутів
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API ендпоінт не знайдено.' });
});

// Централізований обробник помилок
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Внутрішня помилка сервера.' });
});

if (require.main === module) {
    app.listen(PORT, async () => {
        await seedInitialUsers();
        console.log(`Сервер Purrfect Art запущено на http://localhost:${PORT}`);
    });
}

module.exports = app;