const Statistic = require('../models/Statistic');


const getStatistics = async (req, res) => {
  try {
    const { active, category } = req.query;
    let query = {};

    if (active === 'true') query.isActive = true;
    if (category) query.category = category;

    const statistics = await Statistic.find(query).sort({ order: 1, createdAt: 1 });
    res.json({ statistics, total: statistics.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getStatisticById = async (req, res) => {
  try {
    const statistic = await Statistic.findById(req.params.id);
    if (!statistic) return res.status(404).json({ message: 'الإحصائية غير موجودة' });
    res.json(statistic);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const createStatistic = async (req, res) => {
  try {
    const { label, value, suffix, icon, color, order, isActive, category } = req.body;

    if (!label || value === undefined) {
      return res.status(400).json({ message: 'الاسم والقيمة مطلوبان' });
    }

    const statistic = await Statistic.create({
      label,
      value: Number(value) || 0,
      suffix: suffix || '',
      icon: icon || 'trophy',
      color: color || 'primary',
      order: Number(order) || 0,
      isActive: isActive === 'true' || isActive === true || isActive === undefined,
      category: category || 'general',
    });

    res.status(201).json(statistic);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const updateStatistic = async (req, res) => {
  try {
    const statistic = await Statistic.findById(req.params.id);
    if (!statistic) return res.status(404).json({ message: 'الإحصائية غير موجودة' });

    const updatedData = { ...req.body };

    if (updatedData.value !== undefined) updatedData.value = Number(updatedData.value) || 0;
    if (updatedData.order !== undefined) updatedData.order = Number(updatedData.order) || 0;
    if (updatedData.isActive !== undefined) {
      updatedData.isActive = updatedData.isActive === 'true' || updatedData.isActive === true;
    }

    const updated = await Statistic.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const deleteStatistic = async (req, res) => {
  try {
    const statistic = await Statistic.findById(req.params.id);
    if (!statistic) return res.status(404).json({ message: 'الإحصائية غير موجودة' });

    await statistic.deleteOne();
    res.json({ message: 'تم حذف الإحصائية بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  getStatistics,
  getStatisticById,
  createStatistic,
  updateStatistic,
  deleteStatistic,
};