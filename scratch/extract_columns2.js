const fs = require('fs');
let content = fs.readFileSync('src/pages/ReturnsPage.jsx', 'utf8');

const searchStr = "columns={[";
let startIdx = content.indexOf(searchStr);

if (startIdx === -1) {
    console.log("Could not find start");
    process.exit(1);
}

// We know the columns array ends right before `]} />` and the `</div>`
const endMarker = "              ]}";
let endIdx = content.indexOf(endMarker, startIdx);

if (endIdx === -1) {
    console.log("Could not find end");
    process.exit(1);
}

// The exact string to replace
let fullMatch = content.substring(startIdx, endIdx + endMarker.length);
// The content inside the array
let arrayContent = content.substring(startIdx + "columns=".length, endIdx + endMarker.length);

content = content.replace(fullMatch, "columns={historyTableColumns}");

// Insert right before the return statement of ReturnsPage
const insertTarget = "  const checkedCount = Object.values(custChecked)";
let insertIdx = content.indexOf(insertTarget);

if (insertIdx === -1) {
    console.log("Could not find insert target");
    process.exit(1);
}

content = content.substring(0, insertIdx) + "const historyTableColumns = " + arrayContent + ";\n\n" + content.substring(insertIdx);

fs.writeFileSync('src/pages/ReturnsPage.jsx', content, 'utf8');
console.log("Success");
