const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

/*
|--------------------------------------------------------------------------
| IMAGE UPLOAD
|--------------------------------------------------------------------------
| News images are stored temporarily in memory.
| The newsController uploads the buffer directly to Cloudinary.
| This avoids the 403 issue coming from multer-storage-cloudinary
| during image upload.
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

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: imageFilter,
});


/*
|--------------------------------------------------------------------------
| VIDEO UPLOAD
|--------------------------------------------------------------------------
| Keep CloudinaryStorage for videos so the existing videoController
| continues receiving Cloudinary URLs in req.files.
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


/*
|--------------------------------------------------------------------------
| VIDEO FILTER
|--------------------------------------------------------------------------
*/

const videoFilter = (req, file, cb) => {
  /*
   * Thumbnail is an image
   */
  if (file.fieldname === 'thumbnail') {
    return imageFilter(req, file, cb);
  }

  /*
   * Video validation
   */
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


/*
|--------------------------------------------------------------------------
| VIDEO MULTER
|--------------------------------------------------------------------------
*/

const uploadVideo = multer({
  storage: videoStorage,

  limits: {
    fileSize: 200 * 1024 * 1024,
  },

  fileFilter: videoFilter,
});


/*
|--------------------------------------------------------------------------
| MIDDLEWARES
|--------------------------------------------------------------------------
*/

/*
 * News:
 * POST /api/news
 * PUT  /api/news/:id
 *
 * Frontend field:
 * image
 */
const uploadSingle = newsImageUpload.single('image');


/*
 * Videos:
 *
 * video    -> actual video
 * thumbnail -> video thumbnail
 */
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


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  uploadSingle,

  // Kept for compatibility with existing routes/controllers
  uploadImage: uploadSingle,

  uploadVideoFields,
};