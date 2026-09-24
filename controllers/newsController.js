const News = require('../models/News');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotificationEmail } = require('../utils/sendEmail');

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
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await News.countDocuments(query);

    res.json({
      news,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count,
    });
  } catch (error) {
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
      .select('title _id category isBreaking isUrgent priority createdAt');

    if (news.length === 0) {
      news = await News.find({})
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .select('title _id category isBreaking isUrgent priority createdAt');
    }

    res.json({ news });
  } catch (error) {
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
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getPopularNews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const news = await News.find({})
      .sort({ views: -1 })
      .limit(Number(limit))
      .select('title imageUrl views createdAt category excerpt');

    res.json({ news });
  } catch (error) {
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

    res.json({
      totalNews,
      totalViews: totalViews[0]?.total || 0,
      categoriesCount,
    });
  } catch (error) {
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
      .select('title imageUrl createdAt category excerpt');

    res.json({
      ...news.toObject(),
      related,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const createNews = async (req, res) => {
  try {
    const {
      title, content, excerpt, category, isFeatured,
      isBreaking, isUrgent, priority, tags, imageUrl,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
    }

    const news = await News.create({
      title,
      content,
      excerpt: excerpt || content.substring(0, 150) + '...',
      imageUrl: imageUrl || '',
      category: category || 'general',
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isBreaking: isBreaking === 'true' || isBreaking === true,
      isUrgent: isUrgent === 'true' || isUrgent === true,
      priority: Number(priority) || 0,
      tags: tags
        ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()))
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
    console.error('Create news error:', error);
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
      updatedData.tags = updatedData.tags.split(',').map(t => t.trim());
    }

    const updatedNews = await News.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true,
    });

    res.json(updatedNews);
  } catch (error) {
    console.error('Update news error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'الخبر غير موجود' });
    }

    await news.deleteOne();
    res.json({ message: 'تم حذف الخبر بنجاح' });
  } catch (error) {
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