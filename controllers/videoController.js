const Video = require('../models/Video');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

const uploadBufferToCloudinary = (fileBuffer, folderName = 'telecom-egypt/videos') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

const getVideos = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12, featured } = req.query;
    let query = {};

    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (search) {
      query.$or = [
        { title: { $regex: search,$options: 'i' } },
        { description: { $regex: search,$options: 'i' } },
      ];
    }

    const videos = await Video.find(query)
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Video.countDocuments(query);

    res.json({
      videos,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('author', 'name');
    if (!video) return res.status(404).json({ message: 'الفيديو غير موجود' });

    video.views += 1;
    await video.save();

    const related = await Video.find({
      _id: { $ne: video._id },
      category: video.category,
    })
      .limit(3)
      .select('title thumbnailUrl duration views createdAt');

    res.json({ ...video.toObject(), related });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getFeaturedVideos = async (req, res) => {
  try {
    let videos = await Video.find({ isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(6);

    if (videos.length === 0) {
      videos = await Video.find({}).sort({ createdAt: -1 }).limit(6);
    }

    res.json({ videos });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const createVideo = async (req, res) => {
  try {
    const { title, description, category, duration, isFeatured } = req.body;

    if (!title) return res.status(400).json({ message: 'العنوان مطلوب' });

    let videoUrl = req.body.videoUrl || '';
    let thumbnailUrl = '';

    if (req.files) {
      if (req.files.video && req.files.video[0]) {
        const file = req.files.video[0];
        videoUrl = `/uploads/${file.filename}`;
      }

      if (req.files.thumbnail && req.files.thumbnail[0]) {
        const thumbFile = req.files.thumbnail[0];
        try {
          const fileBuffer = thumbFile.buffer || fs.readFileSync(thumbFile.path);
          const cloudResult = await uploadBufferToCloudinary(fileBuffer, 'telecom-egypt/thumbnails');
          thumbnailUrl = cloudResult.secure_url;
        } catch (cloudErr) {
          const fileBuffer = thumbFile.buffer || fs.readFileSync(thumbFile.path);
          const b64 = Buffer.from(fileBuffer).toString('base64');
          thumbnailUrl = `data:${thumbFile.mimetype};base64,${b64}`;
        }
        if (thumbFile.path && fs.existsSync(thumbFile.path)) {
          fs.unlinkSync(thumbFile.path);
        }
      }
    }

    if (!videoUrl) return res.status(400).json({ message: 'ملف الفيديو أو الرابط مطلوب' });

    const video = await Video.create({
      title,
      description: description || '',
      videoUrl,
      thumbnailUrl,
      category: category || 'general',
      duration: Number(duration) || 0,
      isFeatured: isFeatured === 'true' || isFeatured === true,
      author: req.user._id,
    });

    res.status(201).json(video);
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const updateVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'الفيديو غير موجود' });

    const updatedData = { ...req.body };

    if (req.files) {
      if (req.files.video && req.files.video[0]) {
        updatedData.videoUrl = `/uploads/${req.files.video[0].filename}`;
      }
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        const thumbFile = req.files.thumbnail[0];
        try {
          const fileBuffer = thumbFile.buffer || fs.readFileSync(thumbFile.path);
          const cloudResult = await uploadBufferToCloudinary(fileBuffer, 'telecom-egypt/thumbnails');
          updatedData.thumbnailUrl = cloudResult.secure_url;
        } catch (cloudErr) {
          const fileBuffer = thumbFile.buffer || fs.readFileSync(thumbFile.path);
          const b64 = Buffer.from(fileBuffer).toString('base64');
          updatedData.thumbnailUrl = `data:${thumbFile.mimetype};base64,${b64}`;
        }
        if (thumbFile.path && fs.existsSync(thumbFile.path)) {
          fs.unlinkSync(thumbFile.path);
        }
      }
    }

    if (updatedData.isFeatured !== undefined) {
      updatedData.isFeatured = updatedData.isFeatured === 'true' || updatedData.isFeatured === true;
    }

    const updatedVideo = await Video.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true,
    });

    res.json(updatedVideo);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'الفيديو غير موجود' });

    if (video.videoUrl && video.videoUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', video.videoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await video.deleteOne();
    res.json({ message: 'تم حذف الفيديو بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  getVideos,
  getVideoById,
  getFeaturedVideos,
  createVideo,
  updateVideo,
  deleteVideo,
};