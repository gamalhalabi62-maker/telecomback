const News = require('../models/News');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotificationEmail } = require('../utils/sendEmail');
const cloudinary = require('../config/cloudinary');

const uploadImageToCloudinary = (fileBuffer, folderName = 'telecom-egypt/news') => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error('Image buffer is empty'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: 'image',
        timeout: 120000,
        transformation: [
          { width: 1600, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary image error:', error);
          return reject(error);
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary returned no secure_url for image'));
        }
        resolve(result);
      }
    );

    uploadStream.on('error', (err) => {
      console.error('❌ Image stream error:', err);
      reject(err);
    });

    uploadStream.end(fileBuffer);
  });
};

const uploadVideoToCloudinary = (fileBuffer, folderName = 'telecom-egypt/news/videos') => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error('Video buffer is empty'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: 'video',
        timeout: 300000,
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary video error:', error);
          return reject(error);
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary returned no secure_url for video'));
        }
        resolve(result);
      }
    );

    uploadStream.on('error', (err) => {
      console.error('❌ Video stream error:', err);
      reject(err);
    });

    uploadStream.end(fileBuffer);
  });
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`✅ Deleted from Cloudinary: ${publicId} (${resourceType})`);
  } catch (err) {
    console.error(`❌ Cloudinary delete error for ${publicId}:`, err.message);
  }
};

const getNews = async (req, res) => {
  try {
    const {
      category, search, page = 1, limit = 10, sort = 'latest',
      featured, breaking, urgent, mediaType,
    } = req.query;

    let query = {};

    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (breaking === 'true') query.isBreaking = true;
    if (urgent === 'true') query.isUrgent = true;
    if (mediaType) query.mediaType = mediaType;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'popular') sortOption = { views: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'priority') sortOption = { priority: -1, createdAt: -1 };

    const news = await News.find(query)
      .populate('author', 'name')
      .sort(sortOption)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const count = await News.countDocuments(query);

    res.json({
      news,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
      total: count,
    });
  } catch (error) {
    console.error('❌ getNews error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getBreakingNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    let news = await News.find({
      $or: [{ isBreaking: true }, { isUrgent: true }],
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(Number(limit))
      .select('title _id category isBreaking isUrgent priority createdAt imageUrl videoThumbnail mediaType');

    if (news.length === 0) {
      news = await News.find({})
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .select('title _id category isBreaking isUrgent priority createdAt imageUrl videoThumbnail mediaType');
    }

    res.json({ news });
  } catch (error) {
    console.error('❌ getBreakingNews error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getFeaturedNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    let featured = await News.find({ isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('author', 'name');

    if (featured.length === 0) {
      featured = await News.find({})
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .populate('author', 'name');
    }

    res.json({ news: featured });
  } catch (error) {
    console.error('❌ getFeaturedNews error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getPopularNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const news = await News.find({})
      .sort({ views: -1 })
      .limit(Number(limit))
      .select('title imageUrl videoThumbnail mediaType views createdAt category excerpt');

    res.json({ news });
  } catch (error) {
    console.error('❌ getPopularNews error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const totalNews = await News.countDocuments();
    const totalViews = await News.aggregate([
      { $group: { _id: null, total: { $sum: '$views' } } },
    ]);
    const categoriesCount = await News.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const mediaTypeCount = await News.aggregate([
      { $group: { _id: '$mediaType', count: { $sum: 1 } } },
    ]);

    res.json({
      totalNews,
      totalViews: totalViews[0]?.total || 0,
      categoriesCount,
      mediaTypeCount,
    });
  } catch (error) {
    console.error('❌ getStats error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id).populate('author', 'name');
    if (!news) {
      return res.status(404).json({ message: 'الخبر غير موجود' });
    }

    news.views += 1;
    await news.save();

    const related = await News.find({
      _id: { $ne: news._id },
      category: news.category,
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('title imageUrl videoThumbnail mediaType createdAt category excerpt');

    res.json({
      ...news.toObject(),
      related,
    });
  } catch (error) {
    console.error('❌ getNewsById error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const createNews = async (req, res) => {
  try {
    const {
      title, content, excerpt, category, isFeatured,
      isBreaking, isUrgent, priority, tags,
      mediaType: rawMediaType,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
    }

    let mediaType = rawMediaType || 'none';
    if (!['none', 'image', 'video', 'both'].includes(mediaType)) {
      mediaType = 'none';
    }

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    let imageUrl = '';
    let imagePublicId = '';
    let videoUrl = '';
    let videoPublicId = '';
    let videoThumbnail = '';
    let videoDuration = 0;

    if (imageFile) {
      try {
        const imgResult = await uploadImageToCloudinary(imageFile.buffer);
        imageUrl = imgResult.secure_url;
        imagePublicId = imgResult.public_id;
      } catch (err) {
        console.error('❌ Image upload failed:', err);
        return res.status(500).json({
          message: 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.',
          error: err.message,
        });
      }
    }

    if (videoFile) {
      try {
        const vidResult = await uploadVideoToCloudinary(videoFile.buffer);
        videoUrl = vidResult.secure_url;
        videoPublicId = vidResult.public_id;
        videoDuration = Math.round(vidResult.duration || 0);

        videoThumbnail = vidResult.secure_url
          .replace('/video/upload/', '/video/upload/so_auto/')
          .replace(/\.[^.]+$/, '.jpg');
      } catch (err) {
        console.error('❌ Video upload failed:', err);
        if (imagePublicId) await deleteFromCloudinary(imagePublicId, 'image');
        return res.status(500).json({
          message: 'فشل رفع الفيديو. يرجى المحاولة مرة أخرى.',
          error: err.message,
        });
      }
    }

    if (mediaType === 'image' && !imageUrl) {
      return res.status(400).json({ message: 'يجب إرفاق صورة عند اختيار نوع "صورة"' });
    }
    if (mediaType === 'video' && !videoUrl) {
      return res.status(400).json({ message: 'يجب إرفاق فيديو عند اختيار نوع "فيديو"' });
    }
    if (mediaType === 'both' && (!imageUrl || !videoUrl)) {
      return res.status(400).json({ message: 'يجب إرفاق صورة وفيديو عند اختيار نوع "صورة وفيديو"' });
    }

    if (mediaType === 'none') {
      if (imagePublicId) await deleteFromCloudinary(imagePublicId, 'image');
      if (videoPublicId) await deleteFromCloudinary(videoPublicId, 'video');
      imageUrl = '';
      imagePublicId = '';
      videoUrl = '';
      videoPublicId = '';
      videoThumbnail = '';
      videoDuration = 0;
    }
    if (mediaType === 'image' && videoPublicId) {
      await deleteFromCloudinary(videoPublicId, 'video');
      videoUrl = '';
      videoPublicId = '';
      videoThumbnail = '';
      videoDuration = 0;
    }
    if (mediaType === 'video' && imagePublicId) {
      await deleteFromCloudinary(imagePublicId, 'image');
      imageUrl = '';
      imagePublicId = '';
    }

    const news = await News.create({
      title,
      content,
      excerpt: excerpt || content.substring(0, 150) + '...',
      mediaType,
      imageUrl,
      imagePublicId,
      videoUrl,
      videoPublicId,
      videoThumbnail,
      videoDuration,
      category: category || 'general',
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isBreaking: isBreaking === 'true' || isBreaking === true,
      isUrgent: isUrgent === 'true' || isUrgent === true,
      priority: Number(priority) || 0,
      tags: tags
        ? Array.isArray(tags)
          ? tags
          : tags.split(',').map((t) => t.trim())
        : [],
      author: req.user._id,
    });

    try {
      const users = await User.find({
        receiveNotifications: true,
        isVerified: true,
        isActive: true,
      }).select('_id name email');

      if (users.length > 0) {
        const notifications = users.map((user) => ({
          recipient: user._id,
          title: '📰 خبر جديد',
          body: title,
          type: 'news',
          link: `/news/${news._id}`,
          icon: 'newspaper',
        }));

        await Notification.insertMany(notifications);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = `${frontendUrl}/news/${news._id}`;

        users.forEach((user) => {
          sendNotificationEmail(
            user.email,
            user.name,
            'خبر جديد على موقع نادي المصرية للاتصالات',
            `<p><strong>${title}</strong></p><p>${excerpt || content.substring(0, 200)}...</p>`,
            link
          ).catch((err) => console.error('Email error:', err.message));
        });
      }
    } catch (notifyErr) {
      console.error('Notification error:', notifyErr.message);
    }

    res.status(201).json(news);
  } catch (error) {
    console.error('❌ Create news error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const updateNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'الخبر غير موجود' });
    }

    const updatedData = { ...req.body };

    delete updatedData.author;
    delete updatedData.views;
    delete updatedData.createdAt;
    delete updatedData.updatedAt;
    delete updatedData._id;

    let mediaType = updatedData.mediaType !== undefined ? updatedData.mediaType : news.mediaType;
    if (!['none', 'image', 'video', 'both'].includes(mediaType)) {
      mediaType = news.mediaType;
    }

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    let newImageUrl = news.imageUrl;
    let newImagePublicId = news.imagePublicId;
    let newVideoUrl = news.videoUrl;
    let newVideoPublicId = news.videoPublicId;
    let newVideoThumbnail = news.videoThumbnail;
    let newVideoDuration = news.videoDuration;

    if (imageFile) {
      try {
        const imgResult = await uploadImageToCloudinary(imageFile.buffer);
        if (news.imagePublicId) {
          await deleteFromCloudinary(news.imagePublicId, 'image');
        }
        newImageUrl = imgResult.secure_url;
        newImagePublicId = imgResult.public_id;
      } catch (err) {
        console.error('❌ Image update failed:', err);
        return res.status(500).json({
          message: 'فشل رفع الصورة الجديدة',
          error: err.message,
        });
      }
    }

    if (videoFile) {
      try {
        const vidResult = await uploadVideoToCloudinary(videoFile.buffer);
        if (news.videoPublicId) {
          await deleteFromCloudinary(news.videoPublicId, 'video');
        }
        newVideoUrl = vidResult.secure_url;
        newVideoPublicId = vidResult.public_id;
        newVideoDuration = Math.round(vidResult.duration || 0);
        newVideoThumbnail = vidResult.secure_url
          .replace('/video/upload/', '/video/upload/so_auto/')
          .replace(/\.[^.]+$/, '.jpg');
      } catch (err) {
        console.error('❌ Video update failed:', err);
        return res.status(500).json({
          message: 'فشل رفع الفيديو الجديد',
          error: err.message,
        });
      }
    }

    if (mediaType === 'image' && !newImageUrl) {
      return res.status(400).json({ message: 'يجب إرفاق صورة عند اختيار نوع "صورة"' });
    }
    if (mediaType === 'video' && !newVideoUrl) {
      return res.status(400).json({ message: 'يجب إرفاق فيديو عند اختيار نوع "فيديو"' });
    }
    if (mediaType === 'both' && (!newImageUrl || !newVideoUrl)) {
      return res.status(400).json({ message: 'يجب إرفاق صورة وفيديو عند اختيار نوع "صورة وفيديو"' });
    }

    if (mediaType === 'none') {
      if (newImagePublicId) await deleteFromCloudinary(newImagePublicId, 'image');
      if (newVideoPublicId) await deleteFromCloudinary(newVideoPublicId, 'video');
      newImageUrl = '';
      newImagePublicId = '';
      newVideoUrl = '';
      newVideoPublicId = '';
      newVideoThumbnail = '';
      newVideoDuration = 0;
    }
    if (mediaType === 'image' && newVideoPublicId) {
      await deleteFromCloudinary(newVideoPublicId, 'video');
      newVideoUrl = '';
      newVideoPublicId = '';
      newVideoThumbnail = '';
      newVideoDuration = 0;
    }
    if (mediaType === 'video' && newImagePublicId) {
      await deleteFromCloudinary(newImagePublicId, 'image');
      newImageUrl = '';
      newImagePublicId = '';
    }

    updatedData.mediaType = mediaType;
    updatedData.imageUrl = newImageUrl;
    updatedData.imagePublicId = newImagePublicId;
    updatedData.videoUrl = newVideoUrl;
    updatedData.videoPublicId = newVideoPublicId;
    updatedData.videoThumbnail = newVideoThumbnail;
    updatedData.videoDuration = newVideoDuration;

    if (updatedData.isFeatured !== undefined) {
      updatedData.isFeatured =
        updatedData.isFeatured === 'true' || updatedData.isFeatured === true;
    }
    if (updatedData.isBreaking !== undefined) {
      updatedData.isBreaking =
        updatedData.isBreaking === 'true' || updatedData.isBreaking === true;
    }
    if (updatedData.isUrgent !== undefined) {
      updatedData.isUrgent =
        updatedData.isUrgent === 'true' || updatedData.isUrgent === true;
    }
    if (updatedData.priority !== undefined) {
      updatedData.priority = Number(updatedData.priority) || 0;
    }
    if (updatedData.tags && !Array.isArray(updatedData.tags)) {
      updatedData.tags = updatedData.tags.split(',').map((t) => t.trim());
    }

    const updatedNews = await News.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true,
    });

    res.json(updatedNews);
  } catch (error) {
    console.error('❌ Update news error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'الخبر غير موجود' });
    }

    if (news.imagePublicId) await deleteFromCloudinary(news.imagePublicId, 'image');
    if (news.videoPublicId) await deleteFromCloudinary(news.videoPublicId, 'video');

    await news.deleteOne();
    res.json({ message: 'تم حذف الخبر بنجاح' });
  } catch (error) {
    console.error('❌ deleteNews error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  getNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  getBreakingNews,
  getFeaturedNews,
  getPopularNews,
  getStats,
};