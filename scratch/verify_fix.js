const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/ReturnsPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The file currently has:
//   return (
//     ...
//   );
// const historyTableColumns = [ ... ];
// <EOF>

const columnsIndex = content.indexOf('const historyTableColumns = [');
if (columnsIndex === -1) {
  console.log("Could not find historyTableColumns");
  process.exit(1);
}

const columnsCode = content.slice(columnsIndex);
content = content.slice(0, columnsIndex); // Remove it from the bottom

// Find where to insert it (before the final return statement)
// Look for `const checkedCount = Object.values(custChecked).filter((c) => c.checked).length;`
const insertTarget = 'const checkedCount = Object.values(custChecked).filter((c) => c.checked).length;';
const insertIndex = content.indexOf(insertTarget);

if (insertIndex === -1) {
  console.log("Could not find insertTarget");
  process.exit(1);
}

content = content.slice(0, insertIndex) + columnsCode + '\n\n  ' + content.slice(insertIndex);

// Add the closing brace for the ReturnsPage function
if (!content.trim().endsWith('}')) {
  content = content.trim() + '\n}\n';
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Fixed ReturnsPage.jsx successfully.");
