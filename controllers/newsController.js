const News = require('../models/News');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotificationEmail } = require('../utils/sendEmail');
const cloudinary = require('../config/cloudinary');

/**
 * رفع Buffer إلى Cloudinary
 * - resource_type: 'image' صراحةً (ليس 'auto')
 * - timeout 120 ثانية
 * - تحقق من وجود buffer و secure_url
 * - transformation لتحسين الصور
 */
const uploadBufferToCloudinary = (
  fileBuffer,
  folderName = 'telecom-egypt/news',
  resourceType = 'image'
) => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error('File buffer is empty or missing'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: resourceType,
        timeout: 120000, // 2 دقيقة
        transformation: [
          { width: 1600, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload_stream error:', error);
          return reject(error);
        }
        if (!result || !result.secure_url) {
          return reject(new Error('Cloudinary returned no secure_url'));
        }
        resolve(result);
      }
    );

    uploadStream.on('error', (err) => {
      console.error('❌ Upload stream error:', err);
      reject(err);
    });

    uploadStream.end(fileBuffer);
  });
};

/* ============================================================
 *  GET  /api/news
 *  قائمة الأخبار مع فلترة وترتيب وترقيم صفحات
 * ============================================================ */
const getNews = async (req, res) => {
  try {
    const {
      category, search, page = 1, limit = 10, sort = 'latest',
      featured, breaking, urgent,
    } = req.query;

    let query = {};

    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (breaking === 'true') query.isBreaking = true;
    if (urgent === 'true') query.isUrgent = true;

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

/* ============================================================
 *  GET  /api/news/breaking
 * ============================================================ */
const getBreakingNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    let news = await News.find({
      $or: [{ isBreaking: true }, { isUrgent: true }],
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(Number(limit))
      .select('title _id category isBreaking isUrgent priority createdAt imageUrl');

    if (news.length === 0) {
      news = await News.find({})
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .select('title _id category isBreaking isUrgent priority createdAt imageUrl');
    }

    res.json({ news });
  } catch (error) {
    console.error('❌ getBreakingNews error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

/* ============================================================
 *  GET  /api/news/featured
 * ============================================================ */
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

/* ============================================================
 *  GET  /api/news/popular
 * ============================================================ */
const getPopularNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const news = await News.find({})
      .sort({ views: -1 })
      .limit(Number(limit))
      .select('title imageUrl views createdAt category excerpt');

    res.json({ news });
  } catch (error) {
    console.error('❌ getPopularNews error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

/* ============================================================
 *  GET  /api/news/stats
 * ============================================================ */
const getStats = async (req, res) => {
  try {
    const totalNews = await News.countDocuments();
    const totalViews = await News.aggregate([
      { $group: { _id: null, total: { $sum: '$views' } } },
    ]);
    const categoriesCount = await News.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    res.json({
      totalNews,
      totalViews: totalViews[0]?.total || 0,
      categoriesCount,
    });
  } catch (error) {
    console.error('❌ getStats error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

/* ============================================================
 *  GET  /api/news/:id
 * ============================================================ */
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
      .select('title imageUrl createdAt category excerpt');

    res.json({
      ...news.toObject(),
      related,
    });
  } catch (error) {
    console.error('❌ getNewsById error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

/* ============================================================
 *  POST  /api/news   (admin)
 *  multipart/form-data بحقل اسمه "image"
 * ============================================================ */
const createNews = async (req, res) => {
  try {
    console.log('\n========== CREATE NEWS ==========');
    console.log('req.body keys:', Object.keys(req.body));
    console.log('req.file exists:', !!req.file);
    console.log(
      'req.file details:',
      req.file
        ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: !!req.file.buffer,
            bufferLength: req.file.buffer?.length,
          }
        : 'NO FILE'
    );
    console.log('=================================\n');

    const {
      title, content, excerpt, category, isFeatured,
      isBreaking, isUrgent, priority, tags,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
    }

    let imageUrl = req.body.imageUrl || '';

    // ✅ إذا وُجد ملف، يجب أن يُرفع بنجاح أو نُرجع خطأ 500
    if (req.file) {
      if (!req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({ message: 'الملف المرفوع فارغ أو تالف' });
      }

      console.log('📤 Uploading to Cloudinary...');
      try {
        const cloudResult = await uploadBufferToCloudinary(
          req.file.buffer,
          'telecom-egypt/news',
          'image'
        );
        imageUrl = cloudResult.secure_url;
        console.log('✅ Cloudinary URL:', imageUrl);
      } catch (cloudErr) {
        console.error('❌ Cloudinary upload failed:', cloudErr);
        return res.status(500).json({
          message: 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.',
          error: cloudErr.message,
        });
      }
    } else {
      console.log('⚠️ No file attached to request');
    }

    console.log('📝 Final imageUrl:', imageUrl || '(empty)');

    const news = await News.create({
      title,
      content,
      excerpt: excerpt || content.substring(0, 150) + '...',
      imageUrl,
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

    /* ---------- إشعارات + بريد ---------- */
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

/* ============================================================
 *  PUT  /api/news/:id   (admin)
 * ============================================================ */
const updateNews = async (req, res) => {
  try {
    console.log('\n========== UPDATE NEWS ==========');
    console.log('req.file exists:', !!req.file);
    console.log(
      'req.file details:',
      req.file
        ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: !!req.file.buffer,
          }
        : 'NO FILE'
    );

    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'الخبر غير موجود' });
    }

    const updatedData = { ...req.body };

    // ✅ إذا وُجد ملف، يجب أن يُرفع بنجاح أو نُرجع خطأ
    if (req.file) {
      if (!req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({ message: 'الملف المرفوع فارغ أو تالف' });
      }

      console.log('📤 Uploading new image to Cloudinary...');
      try {
        const cloudResult = await uploadBufferToCloudinary(
          req.file.buffer,
          'telecom-egypt/news',
          'image'
        );
        updatedData.imageUrl = cloudResult.secure_url;
        console.log('✅ New Cloudinary URL:', updatedData.imageUrl);
      } catch (cloudErr) {
        console.error('❌ Cloudinary upload failed:', cloudErr);
        return res.status(500).json({
          message: 'فشل رفع الصورة الجديدة',
          error: cloudErr.message,
        });
      }
    }

    /* ---------- تحويلات Boolean / Number ---------- */
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

/* ============================================================
 *  DELETE  /api/news/:id   (admin)
 * ============================================================ */
const deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'الخبر غير موجود' });
    }

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