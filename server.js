const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

['uploads/images', 'uploads/videos', 'uploads/thumbnails'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());
app.use(morgan('dev'));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'تم تجاوز عدد الطلبات المسموح بها، حاول لاحقاً.',
});
app.use('/api', limiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/players', require('./routes/playerRoutes'));
app.use('/api/matches', require('./routes/matchRoutes'));
app.use('/api/statistics', require('./routes/statisticRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

app.get('/', (req, res) => {
  res.json({
    message: 'مرحباً بك في API نادي المصرية للاتصالات',
    version: '2.0',
    endpoints: {
      auth: '/api/auth',
      news: '/api/news',
      videos: '/api/videos',
      players: '/api/players',
      matches: '/api/matches',
      statistics: '/api/statistics',
      messages: '/api/messages',
      notifications: '/api/notifications',
    },
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'حجم الملف كبير جداً' });
  }
  res.status(500).json({ message: err.message || 'خطأ في السيرفر' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'المسار غير موجود' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});