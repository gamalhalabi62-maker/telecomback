const express = require('express');
const router = express.Router();
const {
  getVideos,
  getVideoById,
  getFeaturedVideos,
  createVideo,
  updateVideo,
  deleteVideo,
} = require('../controllers/videoController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { uploadVideoFields } = require('../middleware/uploadMiddleware');

router.get('/featured', getFeaturedVideos);

router.get('/', getVideos);
router.get('/:id', getVideoById);

router.post('/', protect, adminOnly, uploadVideoFields, createVideo);
router.put('/:id', protect, adminOnly, uploadVideoFields, updateVideo);
router.delete('/:id', protect, adminOnly, deleteVideo);

module.exports = router;