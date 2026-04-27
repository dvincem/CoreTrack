const XLSX = require('c:/Users/markv/Desktop/tirshop/node_modules/xlsx');
const wb = XLSX.readFile('c:/Users/markv/Desktop/tirshop/System_test_EDITED.xlsx');

// Check SUPPLIER_MASTER
const supData = XLSX.utils.sheet_to_json(wb.Sheets['SUPPLIER_MASTER'], { header: 1 });
console.log('=== SUPPLIER_MASTER (last 5 rows) ===');
supData.slice(-5).forEach(r => console.log(r));

// Check ITEM_MASTER header + first/last few data rows
const itemData = XLSX.utils.sheet_to_json(wb.Sheets['ITEM_MASTER'], { header: 1 });
console.log('\n=== ITEM_MASTER header ===');
console.log(itemData[0]);
console.log('\n=== ITEM_MASTER data rows (brand + supplier_id columns) ===');
const brandIdx = itemData[0].indexOf('brand');
const supIdx = itemData[0].indexOf('supplier_id');
for (let i = 1; i < itemData.length; i++) {
  console.log(`Row ${i+1}: brand="${itemData[i][brandIdx]}" => supplier_id="${itemData[i][supIdx]}"`);
}
