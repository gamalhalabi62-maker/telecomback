const XLSX = require('xlsx');
const Member = require('../models/Member');
const ElectionAttendance = require('../models/ElectionAttendance');

const MEMBERSHIP_PREFIX = '00101';

const padCompany = (val) => String(val || '').trim().padStart(6, '0');
const padMembership = (val) => String(val || '').trim().padStart(3, '0');

const buildFullNumber = (companyNumber, membershipNumber) => {
  return `${MEMBERSHIP_PREFIX}${padCompany(companyNumber)}${padMembership(membershipNumber)}`;
};

const detectMembershipType = (raw) => {
  const val = String(raw || '').trim();
  if (val.includes('معاش') || val.includes('بالمعاش')) return 'retired';
  if (val.includes('عامل') || val.includes('عاملة')) return 'working';
  return 'working';
};

const detectGender = (raw) => {
  const val = String(raw || '').trim();
  if (val === 'ذكر' || val === 'male') return 'male';
  if (val === 'أنثى' || val === 'انثى' || val === 'female') return 'female';
  return '';
};

const searchMember = async (req, res) => {
  try {
    const { membershipType, input } = req.body;

    if (!membershipType || !input) {
      return res.status(400).json({ message: 'نوع العضوية والرقم مطلوبان' });
    }

    if (!['working', 'retired'].includes(membershipType)) {
      return res.status(400).json({ message: 'نوع العضوية غير صحيح' });
    }

    const cleaned = String(input).replace(/\D/g, '');
    if (cleaned.length !== 6) {
      return res.status(400).json({
        message: 'يجب إدخال 6 أرقام بالضبط — مثال: 000029',
      });
    }

    const member = await Member.findOne({
      companyNumber: cleaned,
      membershipType,
    });

    if (!member) {
      return res.status(404).json({
        message: 'لم يتم العثور على عضو بهذه البيانات. تأكد من نوع العضوية ورقم الشركة.',
        notFound: true,
      });
    }

    const existing = await ElectionAttendance.findOne({ member: member._id });

    res.json({
      member: {
        _id: member._id,
        fullMembershipNumber: member.fullMembershipNumber,
        companyNumber: member.companyNumber,
        membershipNumber: member.membershipNumber,
        membershipType: member.membershipType,
        name: member.name,
        phone: member.phone,
        committeeName: member.committeeName,
        committeeNumber: member.committeeNumber,
      },
      alreadyRegistered: !!existing,
      previousChoice: existing ? existing.willAttend : null,
    });
  } catch (error) {
    console.error('❌ searchMember error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const registerAttendance = async (req, res) => {
  try {
    const { memberId, willAttend } = req.body;

    if (!memberId || willAttend === undefined) {
      return res.status(400).json({ message: 'البيانات ناقصة' });
    }

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'العضو غير موجود' });
    }

    const existing = await ElectionAttendance.findOne({ member: member._id });

    if (existing) {
      return res.status(400).json({
        message: 'لقد قمت بتسجيل حضورك مسبقاً. لا يمكن التعديل.',
        alreadyRegistered: true,
        previousChoice: existing.willAttend,
      });
    }

    const attendance = await ElectionAttendance.create({
      member: member._id,
      fullMembershipNumber: member.fullMembershipNumber,
      membershipType: member.membershipType,
      name: member.name,
      phone: member.phone,
      committeeName: member.committeeName,
      committeeNumber: member.committeeNumber,
      willAttend: willAttend === true || willAttend === 'true',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(201).json({
      message: attendance.willAttend
        ? '✅ تم تسجيل حضورك بنجاح. نتشرف بحضورك!'
        : 'تم تسجيل اعتذارك. شكراً لك.',
      attendance,
    });
  } catch (error) {
    console.error('❌ registerAttendance error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'لقد قمت بتسجيل حضورك مسبقاً' });
    }
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getPublicStats = async (req, res) => {
  try {
    const totalMembers = await Member.countDocuments();
    const attending = await ElectionAttendance.countDocuments({ willAttend: true });
    const notAttending = await ElectionAttendance.countDocuments({ willAttend: false });
    const registered = attending + notAttending;

    res.json({
      totalMembers,
      registered,
      attending,
      notAttending,
      pending: totalMembers - registered,
    });
  } catch (error) {
    console.error('❌ getPublicStats error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getAttendanceList = async (req, res) => {
  try {
    const {
      willAttend, membershipType, committeeNumber, search,
      page = 1, limit = 50,
    } = req.query;

    const query = {};
    if (willAttend !== undefined && willAttend !== '') {
      query.willAttend = willAttend === 'true';
    }
    if (membershipType) query.membershipType = membershipType;
    if (committeeNumber) query.committeeNumber = committeeNumber;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fullMembershipNumber: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const list = await ElectionAttendance.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await ElectionAttendance.countDocuments(query);

    res.json({
      list,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    console.error('❌ getAttendanceList error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const getAttendanceStats = async (req, res) => {
  try {
    const totalMembers = await Member.countDocuments();
    const workingTotal = await Member.countDocuments({ membershipType: 'working' });
    const retiredTotal = await Member.countDocuments({ membershipType: 'retired' });

    const attending = await ElectionAttendance.countDocuments({ willAttend: true });
    const notAttending = await ElectionAttendance.countDocuments({ willAttend: false });

    const attendingWorking = await ElectionAttendance.countDocuments({ willAttend: true, membershipType: 'working' });
    const attendingRetired = await ElectionAttendance.countDocuments({ willAttend: true, membershipType: 'retired' });
    const notAttendingWorking = await ElectionAttendance.countDocuments({ willAttend: false, membershipType: 'working' });
    const notAttendingRetired = await ElectionAttendance.countDocuments({ willAttend: false, membershipType: 'retired' });

    const byCommittee = await ElectionAttendance.aggregate([
      { $match: { willAttend: true, committeeNumber: { $ne: '' } } },
      {
        $group: {
          _id: {
            committeeNumber: '$committeeNumber',
            committeeName: '$committeeName',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      totalMembers,
      workingTotal,
      retiredTotal,
      attending,
      notAttending,
      registered: attending + notAttending,
      pending: totalMembers - (attending + notAttending),
      attendingWorking,
      attendingRetired,
      notAttendingWorking,
      notAttendingRetired,
      byCommittee: byCommittee.map((c) => ({
        committeeNumber: c._id.committeeNumber,
        committeeName: c._id.committeeName,
        count: c.count,
      })),
    });
  } catch (error) {
    console.error('❌ getAttendanceStats error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const exportAttendance = async (req, res) => {
  try {
    const { willAttend, membershipType } = req.query;

    const query = {};
    if (willAttend !== undefined && willAttend !== '') {
      query.willAttend = willAttend === 'true';
    }
    if (membershipType) query.membershipType = membershipType;

    const list = await ElectionAttendance.find(query).sort({ name: 1 });

    const data = list.map((item, index) => ({
      'م': index + 1,
      'رقم العضوية الكامل': item.fullMembershipNumber,
      'الاسم': item.name,
      'نوع العضوية': item.membershipType === 'working' ? 'عامل' : 'بالمعاش',
      'الهاتف': item.phone,
      'رقم اللجنة': item.committeeNumber,
      'مكان اللجنة': item.committeeName,
      'الحالة': item.willAttend ? 'سيحضر' : 'لن يحضر',
      'تاريخ التسجيل': new Date(item.createdAt).toLocaleString('ar-EG'),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    ws['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 30 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 22 },
    ];

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `election-attendance-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('❌ exportAttendance error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const importMembersFromExcel = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'يرجى رفع ملف Excel' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (rows.length === 0) {
      return res.status(400).json({ message: 'الملف فارغ' });
    }

    console.log(`📊 Read ${rows.length} rows from Excel`);
    console.log('First row keys:', Object.keys(rows[0]));

    const findKey = (obj, candidates) => {
      const keys = Object.keys(obj);
      for (const candidate of candidates) {
        const found = keys.find((k) =>
          k.replace(/\s+/g, '').includes(candidate.replace(/\s+/g, ''))
        );
        if (found) return found;
      }
      return null;
    };

    const sampleKeys = Object.keys(rows[0]);

    const keyCompany = findKey(rows[0], ['رقمالشركة', 'رقمالشركه', 'الشركة', 'رقم الشركة']);
    const keyMembership = findKey(rows[0], ['رقمالعضوية', 'رقمالعضويه', 'العضوية', 'رقم العضوية']);
    const keyType = findKey(rows[0], ['النوع', 'نوعالعضوية', 'نوع العضوية']);
    const keyName = findKey(rows[0], ['الاسم', 'الاسم'],
      );
    const keyPhone = findKey(rows[0], ['التليفون', 'الهاتف', 'الموبايل', 'تليفون']);
    const keyAddress = findKey(rows[0], ['العنوان', 'عنوان']);
    const keyGender = findKey(rows[0], ['النوعذكر', 'ذكر', 'الجنس']);
    const keyCommitteeName = findKey(rows[0], ['مكاناللجنة', 'مكان اللجنة', 'اللجنة', 'مكاناللجنه']);
    const keyCommitteeNumber = findKey(rows[0], ['رقماللجنة', 'رقم اللجنة', 'رقماللجنه']);

    if (!keyCompany || !keyMembership || !keyName) {
      return res.status(400).json({
        message: 'تعذّر العثور على أعمدة أساسية (رقم الشركة، رقم العضوية، الاسم)',
        detectedColumns: sampleKeys,
        foundKeys: {
          company: keyCompany,
          membership: keyMembership,
          name: keyName,
          type: keyType,
          phone: keyPhone,
        },
      });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const companyRaw = String(row[keyCompany] || '').trim();
        const membershipRaw = String(row[keyMembership] || '').trim();
        const nameRaw = String(row[keyName] || '').trim();

        if (!companyRaw || !membershipRaw || !nameRaw) {
          skipped++;
          continue;
        }

        if (nameRaw.includes('ايفون') && membershipRaw === '001') {
          // debug skip
        }

        const companyNumber = padCompany(companyRaw);
        const membershipNumber = padMembership(membershipRaw);

        const membershipTypeRaw = keyType ? String(row[keyType] || '').trim() : 'عامل';
        const membershipType = detectMembershipType(membershipTypeRaw);

        const genderRaw = keyGender ? String(row[keyGender] || '').trim() : '';
        let gender = detectGender(genderRaw);
        if (!gender) {
          gender = detectGender(String(row['النوع'] || ''));
        }

        const fullNumber = buildFullNumber(companyNumber, membershipNumber);

        const updateData = {
          companyNumber,
          membershipNumber,
          fullMembershipNumber: fullNumber,
          membershipType,
          name: nameRaw,
          phone: keyPhone ? String(row[keyPhone] || '').trim() : '',
          address: keyAddress ? String(row[keyAddress] || '').trim() : '',
          gender,
        };

        if (keyCommitteeName) updateData.committeeName = String(row[keyCommitteeName] || '').trim();
        if (keyCommitteeNumber) updateData.committeeNumber = String(row[keyCommitteeNumber] || '').trim();

        const existing = await Member.findOne({ fullMembershipNumber: fullNumber });

        if (existing) {
          await Member.updateOne({ _id: existing._id }, { $set: updateData });
          updated++;
        } else {
          await Member.create(updateData);
          created++;
        }
      } catch (rowErr) {
        errors.push({ row: i + 2, error: rowErr.message });
      }
    }

    res.json({
      message: '✅ تم استيراد البيانات بنجاح',
      summary: {
        total: rows.length,
        created,
        updated,
        skipped,
        errorsCount: errors.length,
      },
      detectedColumns: {
        company: keyCompany,
        membership: keyMembership,
        name: keyName,
        type: keyType,
        phone: keyPhone,
        address: keyAddress,
        gender: keyGender,
        committeeName: keyCommitteeName,
        committeeNumber: keyCommitteeNumber,
      },
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('❌ importMembersFromExcel error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const deleteAllMembers = async (req, res) => {
  try {
    const count = await Member.countDocuments();
    await Member.deleteMany({});
    res.json({ message: `تم حذف ${count} عضو`, count });
  } catch (error) {
    console.error('❌ deleteAllMembers error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const resetAttendance = async (req, res) => {
  try {
    const count = await ElectionAttendance.countDocuments();
    await ElectionAttendance.deleteMany({});
    res.json({ message: `تم حذف ${count} تسجيل حضور`, count });
  } catch (error) {
    console.error('❌ resetAttendance error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const attendance = await ElectionAttendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'التسجيل غير موجود' });
    }
    await attendance.deleteOne();
    res.json({ message: 'تم حذف التسجيل بنجاح' });
  } catch (error) {
    console.error('❌ deleteAttendance error:', error);
    res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
};

module.exports = {
  searchMember,
  registerAttendance,
  getPublicStats,
  getAttendanceList,
  getAttendanceStats,
  exportAttendance,
  importMembersFromExcel,
  deleteAllMembers,
  resetAttendance,
  deleteAttendance,
};