const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');


const createMessage = async (req, res) => {
  try {
    const { subject, subjectText, content, phone } = req.body;

    if (!subject || !content) {
      return res.status(400).json({ message: 'الموضوع والمحتوى مطلوبان' });
    }

    if (content.length < 10) {
      return res.status(400).json({ message: 'الرسالة قصيرة جداً (10 أحرف على الأقل)' });
    }

    const message = await Message.create({
      sender: req.user._id,
      senderName: req.user.name,
      senderEmail: req.user.email,
      senderPhone: phone || req.user.phone || '',
      subject,
      subjectText: subjectText || '',
      content,
      status: 'new',
    });

    const admins = await User.find({ role: 'admin' });
    const adminNotifications = admins.map((admin) => ({
      recipient: admin._id,
      title: '📩 رسالة جديدة',
      body: `من: ${req.user.name} - ${subjectText || subject}`,
      type: 'message',
      link: `/admin/messages`,
      icon: 'envelope',
    }));

    if (adminNotifications.length > 0) {
      await Notification.insertMany(adminNotifications);
    }

    res.status(201).json({
      message: 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً',
      data: message,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getMyMessages = async (req, res) => {
  try {
    const messages = await Message.find({ sender: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ messages, total: messages.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getAllMessages = async (req, res) => {
  try {
    const { status, subject, search, page = 1, limit = 20 } = req.query;
    let query = {};

    if (status) query.status = status;
    if (subject) query.subject = subject;
    if (search) {
      query.$or = [
        { senderName: { $regex: search, $options: 'i' } },
        { senderEmail: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const messages = await Message.find(query)
      .populate('sender', 'name email phone')
      .populate('repliedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Message.countDocuments(query);

    const stats = {
      total: await Message.countDocuments(),
      new: await Message.countDocuments({ status: 'new' }),
      read: await Message.countDocuments({ status: 'read' }),
      replied: await Message.countDocuments({ status: 'replied' }),
      archived: await Message.countDocuments({ status: 'archived' }),
    };

    res.json({
      messages,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count,
      stats,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getMessageById = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('sender', 'name email phone')
      .populate('repliedBy', 'name');

    if (!message) {
      return res.status(404).json({ message: 'الرسالة غير موجودة' });
    }

    const isOwner = message.sender._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'غير مصرح لك بالوصول' });
    }

    if (isAdmin && message.status === 'new') {
      message.status = 'read';
      await message.save();
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const updateMessageStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'الرسالة غير موجودة' });
    }

    if (status) message.status = status;
    if (adminNotes !== undefined) message.adminNotes = adminNotes;

    if (status === 'replied') {
      message.repliedBy = req.user._id;
      message.repliedAt = new Date();
    }

    await message.save();

    res.json({ message: 'تم تحديث الرسالة بنجاح', data: message });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'الرسالة غير موجودة' });
    }

    await message.deleteOne();
    res.json({ message: 'تم حذف الرسالة بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  createMessage,
  getMyMessages,
  getAllMessages,
  getMessageById,
  updateMessageStatus,
  deleteMessage,
};