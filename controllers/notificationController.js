const Notification = require('../models/Notification');


const getMyNotifications = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'الإشعار غير موجود' });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مصرح' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ message: 'تم تعليم الإشعار كمقروء', data: notification });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ message: 'تم تعليم كل الإشعارات كمقروءة' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'الإشعار غير موجود' });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مصرح' });
    }

    await notification.deleteOne();
    res.json({ message: 'تم حذف الإشعار' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ message: 'تم حذف كل الإشعارات' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};