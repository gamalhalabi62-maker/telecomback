const multer = require('multer');
const path = require('path');

// استخدام الذاكرة المؤقتة (Memory Storage) لالتقاط الـ Buffer
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedExtensions.test(file.mimetype.toLowerCase());

  if (extname && mimetype) {
    return cb(null, true);
  }
  return cb(new Error('يُسمح برفع الصور فقط بصيغ JPG, JPEG, PNG, WEBP, GIF'));
};

const uploadSingle = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // حد أقصى 5 ميجابايت
  fileFilter: imageFilter,
}).single('image');

module.exports = {
  uploadSingle,
  uploadImage: uploadSingle,
};