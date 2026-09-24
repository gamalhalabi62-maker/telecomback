const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const path = require('path');

const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'telecom-egypt/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  },
});

const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    if (file.fieldname === 'thumbnail') {
      return {
        folder: 'telecom-egypt/thumbnails',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      };
    }
    return {
      folder: 'telecom-egypt/videos',
      resource_type: 'video',
      allowed_formats: ['mp4', 'webm', 'ogg', 'mov', 'avi'],
    };
  },
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('يُسمح بالصور فقط'));
};

const videoFilter = (req, file, cb) => {
  if (file.fieldname === 'thumbnail') {
    return imageFilter(req, file, cb);
  }
  const allowedTypes = /mp4|webm|ogg|mov|avi/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (extname) return cb(null, true);
  cb(new Error('يُسمح بالفيديو فقط'));
};

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
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
  uploadImage: uploadSingle,
};