const XLSX = require('c:/Users/markv/Desktop/tirshop/node_modules/xlsx');
const path = 'c:/Users/markv/Desktop/tirshop/System_test.xlsx';

// Load the workbook
const wb = XLSX.readFile(path);

// ─── 1. SUPPLIER_MASTER ───────────────────────────────────────────────────────
const supSheet = wb.Sheets['SUPPLIER_MASTER'];
if (!supSheet) {
  console.error('Sheet SUPPLIER_MASTER not found!');
  process.exit(1);
}

// Convert to array-of-arrays to preserve exact structure
const supData = XLSX.utils.sheet_to_json(supSheet, { header: 1 });
console.log('SUPPLIER_MASTER header row:', supData[0]);
console.log('Current row count:', supData.length);

// New supplier rows — order matches header columns:
// supplier_id, supplier_code, supplier_name, supplier_type, contact_person,
// contact_number, email_address, address, default_payment_terms_days, active_status,
// created_at, created_by
const newSuppliers = [
  ['SUP-006', 'IRC-PH',  'IRC Tires Philippines',       'TIRE',    'Mark Sy',  '028886789', 'mark@irc.ph',          'Quezon City', 30, 1, '2026-01-01', 'SYSTEM'],
  ['SUP-007', 'FARO-PH', 'Faros Tires Philippines',     'TIRE',    'Lea Cruz', '028887890', 'lea@faros.ph',         'Manila',      30, 1, '2026-01-01', 'SYSTEM'],
  ['SUP-008', 'METZ-PH', 'Metzeler Philippines',        'TIRE',    'Dan Park', '028888901', 'dan@metzeler.ph',      'Makati City', 30, 1, '2026-01-01', 'SYSTEM'],
  ['SUP-009', 'PNCS-PH', 'PunctureSafe Philippines',    'SEALANT', 'Roy Tan',  '028889012', 'roy@puncturesafe.ph',  'Pasig City',  30, 1, '2026-01-01', 'SYSTEM'],
];

newSuppliers.forEach(row => supData.push(row));
console.log('New SUPPLIER_MASTER row count:', supData.length);

// Write back into the workbook
const newSupSheet = XLSX.utils.aoa_to_sheet(supData);
wb.Sheets['SUPPLIER_MASTER'] = newSupSheet;

// ─── 2. ITEM_MASTER — add supplier_id column ──────────────────────────────────
const itemSheet = wb.Sheets['ITEM_MASTER'];
if (!itemSheet) {
  console.error('Sheet ITEM_MASTER not found!');
  process.exit(1);
}

const itemData = XLSX.utils.sheet_to_json(itemSheet, { header: 1 });
console.log('\nITEM_MASTER header row:', itemData[0]);
console.log('ITEM_MASTER row count:', itemData.length);

// Brand → supplier_id map
const brandMap = {
  'Bridgestone':  'SUP-001',
  'Michelin':     'SUP-002',
  'Toyo':         'SUP-003',
  'Continental':  'SUP-004',
  'Hankook':      'SUP-005',
  'IRC':          'SUP-006',
  'Faros':        'SUP-007',
  'Metzeler':     'SUP-008',
  'PunctureSafe': 'SUP-009',
  'Generic':      '',
};

// Find the index of the "brand" column (case-insensitive search)
const headerRow = itemData[0];
const brandColIdx = headerRow.findIndex(h => h && h.toString().toLowerCase() === 'brand');
if (brandColIdx === -1) {
  console.error('Could not find "brand" column in ITEM_MASTER header:', headerRow);
  process.exit(1);
}
console.log(`"brand" column is at index ${brandColIdx}`);

// Append "supplier_id" to the header
itemData[0].push('supplier_id');

// For each data row, look up the brand and append the supplier_id
for (let i = 1; i < itemData.length; i++) {
  const row = itemData[i];
  const brand = row[brandColIdx] ? row[brandColIdx].toString().trim() : '';
  const supplierId = brandMap.hasOwnProperty(brand) ? brandMap[brand] : '';
  if (brand && !brandMap.hasOwnProperty(brand)) {
    console.warn(`  Row ${i + 1}: unknown brand "${brand}" — leaving supplier_id blank`);
  }
  row.push(supplierId);
}

const newItemSheet = XLSX.utils.aoa_to_sheet(itemData);
wb.Sheets['ITEM_MASTER'] = newItemSheet;

// ─── Save ─────────────────────────────────────────────────────────────────────
const outPath = 'c:/Users/markv/Desktop/tirshop/System_test_EDITED.xlsx';
XLSX.writeFile(wb, outPath);
console.log('\nFile saved successfully to', outPath);
