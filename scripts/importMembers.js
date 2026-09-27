const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Member = require('../models/Member');

const MEMBERSHIP_PREFIX = '00101';

const padCompany = (val) => String(val || '').trim();
const padMembership = (val) => String(val || '').trim();

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

const cleanString = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str === '0' || str === '#N/A' || str === 'N/A') return '';
  return str;
};

// ═══════════════════════════════════════════════════════════
//  Sheet 1: "معاش" — الأعضاء بالمعاش
//  Columns: B=م نادى | C=نوع | D=رقم العامل | G=الاسم | H=العنوان | I=النوع | J=التليفون
// ═══════════════════════════════════════════════════════════
const parseRetiredSheet = (rows) => {
  const results = [];
  const errors = [];
  let skipped = 0;

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    const str = row.map((c) => String(c || '')).join('|');
    if (str.includes('الاسم') && (str.includes('رقم العضوية') || str.includes('رقم العامل'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { results: [], errors: [{ row: 0, error: 'لم يتم العثور على صف العناوين' }], skipped: 0 };
  }

  console.log(`   📌 [معاش] Header row at index ${headerRowIndex}`);

  const dataRows = rows
    .slice(headerRowIndex + 1)
    .map((row, idx) => ({ row, originalIndex: headerRowIndex + 2 + idx }))
    .filter(({ row }) => {
      if (!row || row.length === 0) return false;
      const name = String(row[6] || '').trim();
      return name.length >= 2;
    });

  console.log(`   📊 [معاش] Data rows: ${dataRows.length}`);

  for (const { row, originalIndex } of dataRows) {
    try {
      const typeRaw = String(row[2] || '').trim();
      const companyRaw = cleanNumber(row[3]);
      const nameRaw = cleanString(row[6]);
      const addressRaw = cleanString(row[7]);
      const genderRaw = String(row[8] || '').trim();
      const phoneRaw = cleanString(row[9]);

      if (!companyRaw || !nameRaw || nameRaw.length < 2) {
        skipped++;
        continue;
      }

      const companyNumber = padCompany(companyRaw);
      const membershipNumber = '001';
      const fullNumber = `${MEMBERSHIP_PREFIX}${companyNumber}${membershipNumber}`;
      const membershipType = detectMembershipType(typeRaw);

      results.push({
        companyNumber,
        membershipNumber,
        fullMembershipNumber: fullNumber,
        membershipType,
        name: nameRaw,
        phone: phoneRaw,
        address: addressRaw,
        gender: detectGender(genderRaw),
        // ⚠️ committeeName و committeeNumber فاضيين — هيتم إضافتهم لاحقاً
      });
    } catch (rowErr) {
      errors.push({ row: originalIndex, error: rowErr.message });
    }
  }

  return { results, errors, skipped };
};

// ═══════════════════════════════════════════════════════════
//  Sheet 2: "Data Emp" — الأعضاء العاملين
//  Columns: B=رقم العامل | C=رقم العضوية | F=الاسم | G=النوع | I=التليفون | N=مكان التواجد
// ⚠️ ملاحظة: "مكان التواجد" (N) هو مكان شغل الموظف — ليس مكان اللجنة
// ═══════════════════════════════════════════════════════════
const parseWorkingSheet = (rows) => {
  const results = [];
  const errors = [];
  let skipped = 0;

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    const str = row.map((c) => String(c || '')).join('|');
    if (str.includes('الاسم') && (str.includes('رقم العضوية') || str.includes('رقم العامل'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { results: [], errors: [{ row: 0, error: 'لم يتم العثور على صف العناوين' }], skipped: 0 };
  }

  console.log(`   📌 [Data Emp] Header row at index ${headerRowIndex}`);

  const dataRows = rows
    .slice(headerRowIndex + 1)
    .map((row, idx) => ({ row, originalIndex: headerRowIndex + 2 + idx }))
    .filter(({ row }) => {
      if (!row || row.length === 0) return false;
      const name = String(row[5] || '').trim();
      return name.length >= 2;
    });

  console.log(`   📊 [Data Emp] Data rows: ${dataRows.length}`);

  for (const { row, originalIndex } of dataRows) {
    try {
      const companyRaw = cleanNumber(row[1]);
      const membershipRaw = cleanNumber(row[2]);
      const nameRaw = cleanString(row[5]);
      const genderRaw = String(row[6] || '').trim();
      const phoneRaw = cleanString(row[8]);
      // ⚠️ العمود N (مكان التواجد) — مش هنستخدمه

      if (!companyRaw || !membershipRaw || !nameRaw || nameRaw.length < 2) {
        skipped++;
        continue;
      }

      const companyNumber = padCompany(companyRaw);
      const membershipNumber = padMembership(membershipRaw);
      const fullNumber = `${MEMBERSHIP_PREFIX}${companyNumber}${membershipNumber}`;
      const membershipType = 'working';

      results.push({
        companyNumber,
        membershipNumber,
        fullMembershipNumber: fullNumber,
        membershipType,
        name: nameRaw,
        phone: phoneRaw,
        address: '',
        gender: detectGender(genderRaw),
        // ⚠️ committeeName و committeeNumber فاضيين — هيتم إضافتهم لاحقاً
      });
    } catch (rowErr) {
      errors.push({ row: originalIndex, error: rowErr.message });
    }
  }

  return { results, errors, skipped };
};

// ═══════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════
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

    console.log(`📚 Workbook sheets: ${workbook.SheetNames.join(' | ')}\n`);

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const allErrors = [];
    const typeCounts = { working: 0, retired: 0 };

    for (const sheetName of workbook.SheetNames) {
      console.log('═'.repeat(60));
      console.log(`📄 Processing sheet: "${sheetName}"`);
      console.log('═'.repeat(60));

      const sheet = workbook.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      console.log(`   📊 Total rows in sheet: ${allRows.length}`);

      let parsed;
      if (sheetName.includes('معاش') || sheetName.toLowerCase().includes('retired')) {
        parsed = parseRetiredSheet(allRows);
      } else if (sheetName.includes('Emp') || sheetName.includes('Data') || sheetName.toLowerCase().includes('working')) {
        parsed = parseWorkingSheet(allRows);
      } else {
        const firstDataRow = allRows.find((r) => r && r.length > 5 && String(r[5] || '').trim().length > 2);
        if (firstDataRow) {
          const col3 = cleanNumber(firstDataRow[3]);
          const col1 = cleanNumber(firstDataRow[1]);
          if (col3 && !col1) {
            parsed = parseRetiredSheet(allRows);
          } else {
            parsed = parseWorkingSheet(allRows);
          }
        } else {
          console.log(`   ⏭️  Skipped unknown sheet: "${sheetName}"`);
          continue;
        }
      }

      const { results, errors, skipped } = parsed;
      console.log(`   ✅ Parsed: ${results.length} valid rows, ${skipped} skipped, ${errors.length} errors`);

      totalSkipped += skipped;
      allErrors.push(...errors.map((e) => ({ ...e, sheet: sheetName })));

      for (const data of results) {
        try {
          const existing = await Member.findOne({ fullMembershipNumber: data.fullMembershipNumber });

          if (existing) {
            continue;
          }

          await Member.create(data);
          totalCreated++;
          typeCounts[data.membershipType]++;

          if (totalCreated % 100 === 0) {
            console.log(`   ⏳ Progress: ${totalCreated} new members created`);
          }
        } catch (err) {
          if (err.code === 11000) {
            continue;
          }
          allErrors.push({ sheet: sheetName, row: 0, error: err.message });
        }
      }

      console.log(`   ✅ Sheet "${sheetName}" done.\n`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Import Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Total new members created: ${totalCreated}`);
    console.log(`🔄 Total skipped (already existed): ${totalUpdated}`);
    console.log(`⏭️  Total skipped (invalid data): ${totalSkipped}`);
    console.log(`❌ Total errors: ${allErrors.length}`);
    console.log('='.repeat(60));
    console.log(`\n📊 Breakdown by type (new members only):`);
    console.log(`   👷 عامل: ${typeCounts.working}`);
    console.log(`   👴 بالمعاش: ${typeCounts.retired}`);
    console.log('='.repeat(60));

    const dbWorking = await Member.countDocuments({ membershipType: 'working' });
    const dbRetired = await Member.countDocuments({ membershipType: 'retired' });
    const dbTotal = await Member.countDocuments();

    console.log(`\n📊 Database totals (after import):`);
    console.log(`   👷 عامل: ${dbWorking}`);
    console.log(`   👴 بالمعاش: ${dbRetired}`);
    console.log(`   📊 الإجمالي: ${dbTotal}\n`);

    if (allErrors.length > 0) {
      console.log('First 10 errors:');
      allErrors.slice(0, 10).forEach((e) => console.log(`  [${e.sheet}] Row ${e.row}: ${e.error}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

run();