const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../utils/sendEmail');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};


const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'يرجى إدخال جميع الحقول المطلوبة' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({
          message: 'هذا البريد الإلكتروني مستخدم بالفعل',
          field: 'email',
        });
      }

      return res.status(400).json({
        message: 'هذا البريد مسجل بالفعل لكن لم يتم تفعيله. يرجى التحقق من بريدك أو إعادة إرسال الرمز.',
        requiresVerification: true,
        email: existingUser.email,
        field: 'email',
      });
    }


    const userRole = role === 'admin' || role === 'editor' ? 'user' : (role || 'user');

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '',
      role: userRole,
      isVerified: false,
    });

    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    const emailResult = await sendOTPEmail(user.email, otp, user.name);

    if (!emailResult.success) {
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({
        message: 'فشل إرسال البريد. تحقق من إعدادات البريد الإلكتروني.',
        error: emailResult.error,
      });
    }

    res.status(201).json({
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
      email: user.email,
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'البريد والرمز مطلوبان' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpires');

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'الحساب مفعّل بالفعل' });
    }

    if (!user.verifyOTP(otp)) {
      return res.status(400).json({ message: 'الرمز غير صحيح أو منتهي الصلاحية' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'تم تفعيل حسابك بنجاح! يمكنك الآن تسجيل الدخول',
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'البريد الإلكتروني مطلوب' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'الحساب مفعّل بالفعل' });
    }

    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    const emailResult = await sendOTPEmail(email, otp, user.name);

    if (!emailResult.success) {
      return res.status(500).json({ message: 'فشل إرسال البريد. حاول لاحقاً' });
    }

    res.json({ message: 'تم إرسال رمز جديد إلى بريدك' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'يرجى إدخال البريد وكلمة المرور' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'الحساب غير مُفعّل. يرجى التحقق من بريدك الإلكتروني',
        requiresVerification: true,
        email: user.email,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'الحساب معطّل. تواصل مع الإدارة' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      receiveNotifications: user.receiveNotifications,
      isVerified: user.isVerified,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const updateProfile = async (req, res) => {
  try {
    const { name, phone, receiveNotifications } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (receiveNotifications !== undefined) user.receiveNotifications = receiveNotifications;

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      receiveNotifications: user.receiveNotifications,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  getMe,
  updateProfile,
};