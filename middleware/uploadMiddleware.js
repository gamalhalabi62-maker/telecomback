const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir('uploads/images');
ensureDir('uploads/videos');
ensureDir('uploads/thumbnails');

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `img-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      cb(null, 'uploads/thumbnails/');
    } else {
      cb(null, 'uploads/videos/');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const prefix = file.fieldname === 'thumbnail' ? 'thumb' : 'vid';
    cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('يُسمح بالصور فقط (jpg, png, webp, gif)'));
};

const videoFilter = (req, file, cb) => {
  if (file.fieldname === 'thumbnail') {
    return imageFilter(req, file, cb);
  }
  const allowedTypes = /mp4|webm|ogg|mov|avi/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (extname) return cb(null, true);
  cb(new Error('يُسمح بالفيديو فقط (mp4, webm, ogg, mov, avi)'));
};

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: videoFilter,
});


const uploadSingle = uploadImage.single('image');

const uploadVideoFields = uploadVideo.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

module.exports = {
  uploadSingle,
  uploadVideoFields,
  uploadImage: uploadSingle, // alias
};