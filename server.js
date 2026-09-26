const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

['uploads/images', 'uploads/videos', 'uploads/thumbnails'].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5174',
  'https://telecomfront.vercel.app',
  'https://telecomfront-f2owm9e53-jam-b9da.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      console.log('⚠️  CORS not whitelisted (allowed anyway):', origin);
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  })
);


app.use(morgan('dev'));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);


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

app.use('/api/test', require('./routes/testRoutes'));
app.use('/api/filgoal', require('./routes/filgoalRoutes'));
app.use('/api/elections', require('./routes/electionRoutes'));
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Error 404',
    version: '2.1',
  });
});


app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer Error:', err.code, err.message);

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'حجم الملف كبير جداً (الحد 100 ميجابايت)',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: `حقل غير متوقع: ${err.field}. تأكد من اسم الحقل (image / video / thumbnail)`,
      });
    }
    return res.status(400).json({
      message: `خطأ في رفع الملف: ${err.message}`,
    });
  }
  next(err);
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack || err.message);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'حجم الملف كبير جداً' });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'المصدر غير مسموح به',
      error: 'CORS error',
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'خطأ في السيرفر',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: 'المسار غير موجود',
    path: req.originalUrl,
  });
});


const PORT = process.env.PORT || 5000;
const cron = require('node-cron');
const { runScraper } = require('./scripts/scrapeFilGoal');

cron.schedule('*/30 * * * *', async () => {
  console.log('\n⏰ [CRON] FilGoal full sync (every 30 min)...');
  try {
    const result = await runScraper();
    console.log('✅ [CRON] Sync result:', result);
  } catch (err) {
    console.error('❌ [CRON] Sync error:', err.message);
  }
}, {
  timezone: 'Africa/Cairo',
});

console.log('⏰ Cron job scheduled: FilGoal full sync every 30 minutes');

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  allowedOrigins.forEach((o) => console.log(`   • ${o}`));
  console.log('');
});