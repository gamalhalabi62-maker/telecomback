const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

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
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: fileFilter,
});

const uploadSingle = upload.single('image');
const uploadVideoFields = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

module.exports = {
  uploadSingle,
  uploadImage: uploadSingle,
  uploadVideoFields,
};