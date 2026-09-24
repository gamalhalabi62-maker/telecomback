    const Match = require('../models/Match');


const getMatches = async (req, res) => {
  try {
    const { status, competition, page = 1, limit = 20 } = req.query;
    let query = {};

    if (status) query.status = status;
    if (competition) query.competition = competition;

    const matches = await Match.find(query)
      .populate('author', 'name')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Match.countDocuments(query);

    res.json({
      matches,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      total: count,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getUpcomingMatches = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const matches = await Match.find({
      status: 'upcoming',
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .limit(Number(limit));

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getFinishedMatches = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const matches = await Match.find({ status: 'finished' })
      .sort({ date: -1 })
      .limit(Number(limit));

    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getLiveMatches = async (req, res) => {
  try {
    const matches = await Match.find({ status: 'live' }).sort({ date: -1 });
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id).populate('author', 'name');
    if (!match) return res.status(404).json({ message: 'المباراة غير موجودة' });

    match.views += 1;
    await match.save();

    const related = await Match.find({
      _id: { $ne: match._id },
      competition: match.competition,
    })
      .sort({ date: -1 })
      .limit(4)
      .select('opponent opponentLogo date status ourScore opponentScore competition venue');

    res.json({ ...match.toObject(), related });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const getMatchStats = async (req, res) => {
  try {
    const total = await Match.countDocuments();
    const wins = await Match.countDocuments({ status: 'finished', $expr: { $gt: ['$ourScore', '$opponentScore'] } });
    const draws = await Match.countDocuments({ status: 'finished', $expr: { $eq: ['$ourScore', '$opponentScore'] } });
    const losses = await Match.countDocuments({ status: 'finished', $expr: { $lt: ['$ourScore', '$opponentScore'] } });
    const upcoming = await Match.countDocuments({ status: 'upcoming' });
    const live = await Match.countDocuments({ status: 'live' });

    const goals = await Match.aggregate([
      { $match: { status: 'finished' } },
      { $group: {
        _id: null,
        ourGoals: { $sum: '$ourScore' },
        opponentGoals: { $sum: '$opponentScore' },
      }},
    ]);

    res.json({
      total,
      wins,
      draws,
      losses,
      upcoming,
      live,
      ourGoals: goals[0]?.ourGoals || 0,
      opponentGoals: goals[0]?.opponentGoals || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const createMatch = async (req, res) => {
  try {
    const {
      opponent, opponentLogo, competition, competitionName, round,
      date, venue, stadium, status, ourScore, opponentScore, minute,
      lineup, notes, featured, events,
    } = req.body;

    if (!opponent || !date) {
      return res.status(400).json({ message: 'اسم الفريق والتاريخ مطلوبان' });
    }

    const match = await Match.create({
      opponent,
      opponentLogo: opponentLogo || '',
      competition: competition || 'league',
      competitionName: competitionName || '',
      round: round || '',
      date,
      venue: venue || 'home',
      stadium: stadium || '',
      status: status || 'upcoming',
      ourScore: ourScore !== undefined && ourScore !== '' ? Number(ourScore) : null,
      opponentScore: opponentScore !== undefined && opponentScore !== '' ? Number(opponentScore) : null,
      minute: Number(minute) || 0,
      lineup: lineup || '',
      notes: notes || '',
      featured: featured === 'true' || featured === true,
      events: events ? (typeof events === 'string' ? JSON.parse(events) : events) : [],
      author: req.user._id,
    });

    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const updateMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'المباراة غير موجودة' });

    const updatedData = { ...req.body };

    // تحويلات
    if (updatedData.ourScore !== undefined && updatedData.ourScore !== '')
      updatedData.ourScore = Number(updatedData.ourScore);
    if (updatedData.opponentScore !== undefined && updatedData.opponentScore !== '')
      updatedData.opponentScore = Number(updatedData.opponentScore);
    if (updatedData.minute !== undefined) updatedData.minute = Number(updatedData.minute);
    if (updatedData.featured !== undefined)
      updatedData.featured = updatedData.featured === 'true' || updatedData.featured === true;
    if (updatedData.events) {
      updatedData.events = typeof updatedData.events === 'string'
        ? JSON.parse(updatedData.events)
        : updatedData.events;
    }

    const updatedMatch = await Match.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true,
    });

    res.json(updatedMatch);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const updateScore = async (req, res) => {
  try {
    const { ourScore, opponentScore, minute, status } = req.body;
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'المباراة غير موجودة' });

    if (ourScore !== undefined) match.ourScore = Number(ourScore);
    if (opponentScore !== undefined) match.opponentScore = Number(opponentScore);
    if (minute !== undefined) match.minute = Number(minute);
    if (status) match.status = status;

    await match.save();
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};


const deleteMatch = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'المباراة غير موجودة' });

    await match.deleteOne();
    res.json({ message: 'تم حذف المباراة بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  getMatches,
  getUpcomingMatches,
  getFinishedMatches,
  getLiveMatches,
  getMatchById,
  getMatchStats,
  createMatch,
  updateMatch,
  updateScore,
  deleteMatch,
};