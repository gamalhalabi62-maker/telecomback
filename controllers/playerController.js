const Player = require('../models/Player');
const cloudinary = require('../config/cloudinary');

// دالة مساعدة لرفع الـ Buffer إلى Cloudinary
const uploadBufferToCloudinary = (fileBuffer, folderName = 'telecom-egypt/players') => {
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

const getPlayers = async (req, res) => {
  try {
    const { position, search, active } = req.query;
    let query = {};

    if (position) query.position = position;
    if (active === 'true') query.isActive = true;
    if (search) query.name = { $regex: search,$options: 'i' };

    const players = await Player.find(query).sort({ order: 1, number: 1 });
    res.json({ players, total: players.length });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getPlayersByPosition = async (req, res) => {
  try {
    const players = await Player.find({ isActive: true }).sort({ order: 1, number: 1 });

    const grouped = {
      goalkeeper: players.filter(p => p.position === 'goalkeeper'),
      defender: players.filter(p => p.position === 'defender'),
      midfielder: players.filter(p => p.position === 'midfielder'),
      forward: players.filter(p => p.position === 'forward'),
    };

    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getTeamStats = async (req, res) => {
  try {
    const totalPlayers = await Player.countDocuments({ isActive: true });
    const totalGoals = await Player.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$stats.goals' } } },
    ]);
    const totalAppearances = await Player.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$stats.appearances' } } },
    ]);

    res.json({
      totalPlayers,
      totalGoals: totalGoals[0]?.total || 0,
      totalAppearances: totalAppearances[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getPlayerById = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'اللاعب غير موجود' });

    const related = await Player.find({
      _id: { $ne: player._id },
      position: player.position,
      isActive: true,
    })
      .sort({ number: 1 })
      .limit(4);

    res.json({ ...player.toObject(), related });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const createPlayer = async (req, res) => {
  try {
    const {
      name, number, position, nationality, birthDate,
      height, weight, bio, isCaptain, isActive, order,
      stats,
    } = req.body;

    if (!name || !number || !position) {
      return res.status(400).json({ message: 'الاسم والرقم والمركز مطلوبون' });
    }

    let imageUrl = req.body.imageUrl || '';

    // رفع الصورة إلى Cloudinary إذا وجد ملف مرفوع
    if (req.file && req.file.buffer) {
      try {
        const cloudResult = await uploadBufferToCloudinary(req.file.buffer);
        imageUrl = cloudResult.secure_url;
      } catch (cloudErr) {
        console.error('Cloudinary upload error:', cloudErr);
        // التراجع لاستخدام Base64 في حال فشل Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        imageUrl = `data:${req.file.mimetype};base64,${b64}`;
      }
    }

    const playerData = {
      name,
      number: Number(number),
      position,
      nationality: nationality || 'مصري',
      birthDate: birthDate || undefined,
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      bio: bio || '',
      imageUrl,
      isCaptain: isCaptain === 'true' || isCaptain === true,
      isActive: isActive !== 'false' && isActive !== false,
      order: Number(order) || 0,
    };

    if (stats) {
      const parsedStats = typeof stats === 'string' ? JSON.parse(stats) : stats;
      playerData.stats = {
        appearances: Number(parsedStats.appearances) || 0,
        goals: Number(parsedStats.goals) || 0,
        assists: Number(parsedStats.assists) || 0,
        yellowCards: Number(parsedStats.yellowCards) || 0,
        redCards: Number(parsedStats.redCards) || 0,
      };
    }

    const player = await Player.create(playerData);
    res.status(201).json(player);
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const updatePlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'اللاعب غير موجود' });

    const updatedData = { ...req.body };

    if (req.file && req.file.buffer) {
      try {
        const cloudResult = await uploadBufferToCloudinary(req.file.buffer);
        updatedData.imageUrl = cloudResult.secure_url;
      } catch (cloudErr) {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        updatedData.imageUrl = `data:${req.file.mimetype};base64,${b64}`;
      }
    }

    if (updatedData.number !== undefined) updatedData.number = Number(updatedData.number);
    if (updatedData.height !== undefined && updatedData.height !== '')
      updatedData.height = Number(updatedData.height);
    if (updatedData.weight !== undefined && updatedData.weight !== '')
      updatedData.weight = Number(updatedData.weight);
    if (updatedData.isCaptain !== undefined)
      updatedData.isCaptain = updatedData.isCaptain === 'true' || updatedData.isCaptain === true;
    if (updatedData.isActive !== undefined)
      updatedData.isActive = updatedData.isActive !== 'false' && updatedData.isActive !== false;
    if (updatedData.order !== undefined) updatedData.order = Number(updatedData.order);

    if (updatedData.stats) {
      const parsedStats = typeof updatedData.stats === 'string'
        ? JSON.parse(updatedData.stats)
        : updatedData.stats;
      updatedData.stats = {
        appearances: Number(parsedStats.appearances) || 0,
        goals: Number(parsedStats.goals) || 0,
        assists: Number(parsedStats.assists) || 0,
        yellowCards: Number(parsedStats.yellowCards) || 0,
        redCards: Number(parsedStats.redCards) || 0,
      };
    }

    const updatedPlayer = await Player.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true,
    });

    res.json(updatedPlayer);
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const deletePlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ message: 'اللاعب غير موجود' });

    await player.deleteOne();
    res.json({ message: 'تم حذف اللاعب بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  getPlayers,
  getPlayerById,
  getPlayersByPosition,
  getTeamStats,
  createPlayer,
  updatePlayer,
  deletePlayer,
};