const fs = require('fs');
let content = fs.readFileSync('src/pages/ReturnsPage.jsx', 'utf8');

// Find the history tab's DataTable columns definition
const searchStr = `columns={[
                { key: 'return_id'`;

const startIdx = content.indexOf(searchStr);
if (startIdx === -1) {
  console.log("Could not find the start of the columns array");
  process.exit(1);
}

// Find the end of this array
const endMarker = `                  );
                }}
              ]}`;
const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) {
  console.log("Could not find the end of the columns array");
  process.exit(1);
}

const fullArrayMatch = content.substring(startIdx, endIdx + endMarker.length);
const arrayInside = fullArrayMatch.substring(`columns=`.length);

// Replace it with columns={historyTableColumns}
content = content.replace(fullArrayMatch, `columns={historyTableColumns}`);

// Now insert the variable declaration right above `return (`
const returnStr = `  return (
    <>
      <style>{\``;

const insertIdx = content.indexOf(returnStr);
if (insertIdx === -1) {
  console.log("Could not find return statement");
  process.exit(1);
}

content = content.slice(0, insertIdx) + `const historyTableColumns = ` + arrayInside + `;\n\n` + content.slice(insertIdx);

fs.writeFileSync('src/pages/ReturnsPage.jsx', content, 'utf8');
console.log("Extracted historyTableColumns successfully.");
