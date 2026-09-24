const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

/*
|--------------------------------------------------------------------------
| IMAGE UPLOAD (Memory Storage for Base64 Conversion)
|--------------------------------------------------------------------------
*/
const imageMemoryStorage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif/;
  const extname = allowedExtensions.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedExtensions.test(file.mimetype.toLowerCase());

  if (extname && mimetype) {
    return cb(null, true);
  }
  return cb(new Error('يُسمح برفع الصور فقط بصيغ JPG, JPEG, PNG, WEBP, GIF'));
};

const newsImageUpload = multer({
  storage: imageMemoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
});


/*
|--------------------------------------------------------------------------
| VIDEO UPLOAD (Cloudinary Storage for Videos)
|--------------------------------------------------------------------------
*/
const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.fieldname === 'thumbnail') {
      return {
        folder: 'telecom-egypt/thumbnails',
        resource_type: 'image',
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

const videoFilter = (req, file, cb) => {
  if (file.fieldname === 'thumbnail') {
    return imageFilter(req, file, cb);
  }

  const allowedExtensions = /mp4|webm|ogg|mov|avi/;
  const extname = allowedExtensions.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = /^video\//i.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }

  return cb(new Error('يُسمح برفع ملفات الفيديو فقط'));
};

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: videoFilter,
});


/*
|--------------------------------------------------------------------------
| MIDDLEWARES EXPORTS
|--------------------------------------------------------------------------
*/
const uploadSingle = newsImageUpload.single('image');

const uploadVideoFields = uploadVideo.fields([
  {
    name: 'video',
    maxCount: 1,
  },
  {
    name: 'thumbnail',
    maxCount: 1,
  },
]);

module.exports = {
  uploadSingle,
  uploadImage: uploadSingle,
  uploadVideoFields, // تم إضافتها لحل خطأ الـ undefined في videoRoutes
};