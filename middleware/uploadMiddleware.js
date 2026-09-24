const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// استخدام Memory Storage للصور و Disk Storage للفيديوهات لتوفير الذاكرة
const storage = multer.memoryStorage();

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'image' || file.fieldname === 'thumbnail') {
    const allowedImages = /jpeg|jpg|png|webp|gif/;
    const extname = allowedImages.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedImages.test(file.mimetype.toLowerCase());
    if (extname && mimetype) return cb(null, true);
    return cb(new Error('يُسمح برفع الصور فقط بصيغ JPG, PNG, WEBP'));
  }

  if (file.fieldname === 'video') {
    const allowedVideos = /mp4|webm|ogg|mov|avi/;
    const extname = allowedVideos.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /^video\//i.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    return cb(new Error('يُسمح برفع ملفات الفيديو فقط'));
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: fileFilter,
});

const uploadVideoOnly = multer({
  storage: diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: fileFilter,
});

const uploadSingle = upload.single('image');
const uploadVideoFields = uploadVideoOnly.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

module.exports = {
  uploadSingle,
  uploadImage: uploadSingle,
  uploadVideoFields,
};