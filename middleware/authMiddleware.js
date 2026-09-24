const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'المستخدم غير موجود' });
      }

      if (!req.user.isActive) {
        return res.status(403).json({ message: 'الحساب معطّل' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'التوكن غير صالح' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'غير مصرح لك، لا يوجد توكن' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'هذه العملية للمسؤولين فقط' });
  }
};

const adminOrEditor = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'editor')) {
    next();
  } else {
    res.status(403).json({ message: 'هذه العملية للمسؤولين والمحررين فقط' });
  }
};

module.exports = { protect, adminOnly, adminOrEditor };