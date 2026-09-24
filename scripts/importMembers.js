const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Member = require('../models/Member');

const MEMBERSHIP_PREFIX = '00101';
const padCompany = (val) => String(val || '').trim().padStart(6, '0');
const padMembership = (val) => String(val || '').trim().padStart(3, '0');

const detectGender = (raw) => {
  const val = String(raw || '').trim();
  if (val === 'ذكر' || val === 'male') return 'male';
  if (val === 'أنثى' || val === 'انثى' || val === 'female') return 'female';
  return '';
};

const detectMembershipType = (raw) => {
  const val = String(raw || '').trim();
  if (val.includes('معاش')) return 'retired';
  return 'working';
};

const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).trim();
  const match = str.match(/\d+/);
  return match ? match[0] : '';
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const filePath = process.argv[2];
    if (!filePath) {
      console.error('❌ Usage: node scripts/importMembers.js <path-to-excel>');
      process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log(`📊 Total rows in file: ${allRows.length}\n`);

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
      const row = allRows[i];
      if (!row) continue;
      const rowStr = row.map(c => String(c || '')).join('|');
      if (rowStr.includes('الاسم') && (rowStr.includes('رقم العضوية') || rowStr.includes('رقم العضو'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.error('❌ لم يُعثر على صف العناوين');
      process.exit(1);
    }

    console.log(`📌 Header row found at index ${headerRowIndex}`);
    console.log(`   Headers:`, allRows[headerRowIndex]);
    console.log('');

    const dataRows = allRows
      .slice(headerRowIndex + 1)
      .map((row, idx) => ({ row, originalIndex: headerRowIndex + 1 + idx }))
      .filter(({ row }) => {
        if (!row || row.length === 0) return false;
        const name = String(row[6] || '').trim();
        return name.length >= 2;
      });

    console.log(`📊 Data rows to process: ${dataRows.length}\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    const typeCounts = { working: 0, retired: 0 };

    for (const { row, originalIndex } of dataRows) {
      try {
        const typeRaw = String(row[2] || '').trim();
        const companyRaw = cleanNumber(row[3]);
        const membershipRaw = cleanNumber(row[5]);
        const nameRaw = String(row[6] || '').trim();
        const addressRaw = String(row[7] || '').trim();
        const genderRaw = String(row[8] || '').trim();
        const phoneRaw = String(row[9] || '').trim();

        if (!companyRaw || !membershipRaw || !nameRaw || nameRaw.length < 2) {
          skipped++;
          continue;
        }

        const companyNumber = padCompany(companyRaw);
        const membershipNumber = padMembership(membershipRaw);
        const fullNumber = `${MEMBERSHIP_PREFIX}${companyNumber}${membershipNumber}`;
        const membershipType = detectMembershipType(typeRaw);

        const data = {
          companyNumber,
          membershipNumber,
          fullMembershipNumber: fullNumber,
          membershipType,
          name: nameRaw,
          phone: phoneRaw === '0' ? '' : phoneRaw,
          address: addressRaw === '0' ? '' : addressRaw,
          gender: detectGender(genderRaw),
        };

        const existing = await Member.findOne({ fullMembershipNumber: fullNumber });

        if (existing) {
          await Member.updateOne({ _id: existing._id }, { $set: data });
          updated++;
        } else {
          await Member.create(data);
          created++;
        }

        typeCounts[membershipType]++;

        if ((created + updated) % 50 === 0) {
          console.log(`   ⏳ Progress: ${created + updated}/${dataRows.length}`);
        }
      } catch (rowErr) {
        errors.push({ row: originalIndex + 1, error: rowErr.message });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Import complete!');
    console.log('='.repeat(60));
    console.log(`📊 Total rows processed: ${dataRows.length}`);
    console.log(`✨ Created: ${created}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log('='.repeat(60));
    console.log(`\n📊 Breakdown by type:`);
    console.log(`   👷 عامل: ${typeCounts.working}`);
    console.log(`   👴 بالمعاش: ${typeCounts.retired}`);
    console.log('='.repeat(60) + '\n');

    const dbWorking = await Member.countDocuments({ membershipType: 'working' });
    const dbRetired = await Member.countDocuments({ membershipType: 'retired' });
    console.log(`📊 Database totals:`);
    console.log(`   👷 عامل: ${dbWorking}`);
    console.log(`   👴 بالمعاش: ${dbRetired}`);
    console.log(`   📊 الإجمالي: ${dbWorking + dbRetired}\n`);

    if (errors.length > 0) {
      console.log('First 5 errors:');
      errors.slice(0, 5).forEach(e => console.log(`  Row ${e.row}: ${e.error}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

run();