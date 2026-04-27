
const fs = require('fs');
const content = fs.readFileSync('src/pages/Productspage.jsx', 'utf8');

const stack = [];
const tagRegex = /<(\/?[a-zA-Z0-9]*)(?:\s+[^>]*?)?(\/?)>/g;
let match;

while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = tagName.startsWith('/');
    const isSelfClosing = match[2] === '/' || ['img', 'br', 'hr', 'input', 'link', 'meta'].includes(tagName.toLowerCase());

    if (tagName === '' && !isClosing) {
        // Opening fragment <>
        stack.push('<>');
    } else if (tagName === '/' && isClosing) {
        // Closing fragment </>
        const openedTag = stack.pop();
        if (openedTag !== '<>') {
            console.log(`Mismatched fragment: expected </${openedTag}> but found </> at index ${match.index}`);
        }
    } else if (isSelfClosing && !isClosing) {
        // Self-closing tag, do nothing
    } else if (isClosing) {
        const openedTag = stack.pop();
        const expectedTagName = tagName.substring(1);
        if (openedTag !== expectedTagName) {
            console.log(`Mismatched tag: expected </${openedTag}> but found <${tagName}> at index ${match.index}`);
        }
    } else {
        stack.push(tagName);
    }
}

if (stack.length > 0) {
    console.log('Unclosed tags:', stack);
} else {
    console.log('All tags balanced (roughly)');
}
