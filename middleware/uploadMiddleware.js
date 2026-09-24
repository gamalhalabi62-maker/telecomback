const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const imageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const imageExts = /\.(jpe?g|png|webp|gif)$/i;
const videoMimes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
const videoExts = /\.(mp4|webm|ogg|mov|avi)$/i;

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'image' || file.fieldname === 'thumbnail') {
    const okExt = imageExts.test(file.originalname);
    const okMime = imageMimes.includes(file.mimetype.toLowerCase());
    if (okExt && okMime) return cb(null, true);
    return cb(
      new Error(`صيغة الصورة غير مدعومة: ${file.mimetype}. يُسمح بـ JPG, PNG, WEBP, GIF فقط.`)
    );
  }

  if (file.fieldname === 'video') {
    const okExt = videoExts.test(file.originalname);
    const okMime = videoMimes.includes(file.mimetype.toLowerCase()) ||
      file.mimetype.toLowerCase().startsWith('video/');
    if (okExt && okMime) return cb(null, true);
    return cb(new Error('صيغة الفيديو غير مدعومة'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter,
});

const uploadSingle = upload.single('image');

const uploadNewsFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

const uploadVideoFields = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

module.exports = {
  uploadSingle,
  uploadImage: uploadSingle,
  uploadNewsFields,
  uploadVideoFields,
  upload,
};