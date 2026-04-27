
const fs = require('fs');
const content = fs.readFileSync('src/pages/Productspage.jsx', 'utf8');

const stack = [];
const tagRegex = /<(div|\/div|[a-zA-Z0-9]*|\/[a-zA-Z0-9]*)(?:\s+[^>]*?)?(\/?)>/g;
let match;

while ((match = tagRegex.exec(content)) !== null) {
    const tagName = match[1];
    const isClosing = tagName.startsWith('/');
    const isSelfClosing = match[2] === '/' || ['img', 'br', 'hr', 'input', 'link', 'meta'].includes(tagName.toLowerCase());

    if (isSelfClosing && !isClosing) continue;

    if (tagName === '') {
        // Opening fragment <>
        const line = content.substring(0, match.index).split('\n').length;
        stack.push({ line, tag: '<>' });
    } else if (tagName === '/') {
        // Closing fragment </>
        if (stack.length === 0) {
            console.log(`Unexpected </> at index ${match.index}`);
        } else {
            const last = stack.pop();
            if (last.tag !== '<>') {
                console.log(`Mismatched fragment: expected </${last.tag}> but found </> at index ${match.index} (Line ${content.substring(0, match.index).split('\n').length})`);
            }
        }
    } else if (isClosing) {
        const expected = tagName.substring(1);
        if (stack.length === 0) {
            console.log(`Unexpected </${expected}> at index ${match.index}`);
        } else {
            const last = stack.pop();
            if (last.tag !== expected) {
                console.log(`Mismatched tag: expected </${last.tag}> but found </${expected}> at index ${match.index} (Line ${content.substring(0, match.index).split('\n').length})`);
            }
        }
    } else {
        const line = content.substring(0, match.index).split('\n').length;
        stack.push({ line, tag: tagName });
    }
}

if (stack.length > 0) {
    console.log('Unclosed tags:');
    stack.forEach(s => console.log(`Line ${s.line}: ${s.tag}`));
} else {
    console.log('All tags balanced');
}
