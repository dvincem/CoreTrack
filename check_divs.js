
const fs = require('fs');
const content = fs.readFileSync('src/pages/Productspage.jsx', 'utf8');

const stack = [];
const tagRegex = /<(div|\/div)(?:\s+[^>]*?)?(\/?)>/g;
let match;

while ((match = tagRegex.exec(content)) !== null) {
    const tagName = match[1];
    const isClosing = tagName.startsWith('/');
    const isSelfClosing = match[2] === '/';

    if (isSelfClosing) {
        continue;
    }

    if (isClosing) {
        if (stack.length === 0) {
            console.log(`Unexpected </div> at index ${match.index}`);
        } else {
            stack.pop();
        }
    } else {
        const line = content.substring(0, match.index).split('\n').length;
        stack.push({ line, text: match[0].substring(0, 40) });
    }
}

if (stack.length > 0) {
    console.log('Unclosed div tags:');
    stack.forEach(s => console.log(`Line ${s.line}: ${s.text}`));
} else {
    console.log('All div tags balanced');
}
