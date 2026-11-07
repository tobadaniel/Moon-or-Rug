// Builds dist/moon-or-rug.html: the whole game in one file, so anyone
// (including a judge on a phone) can open it with no server and no build.
// Run: node build-single.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

function stripModuleSyntax(code) {
  return code
    .replace(/import[\s\S]*?from\s+'[^']+';/g, '') // import blocks
    .replace(/^export\s+/gm, ''); // export prefixes
}

const css = readFileSync('style.css', 'utf8');
const js = ['engine.js', 'app.js']
  .map((f) => stripModuleSyntax(readFileSync(f, 'utf8')))
  .join('\n\n');

let html = readFileSync('index.html', 'utf8');
html = html.replace(
  '<link rel="stylesheet" href="style.css">',
  `<style>\n${css}\n</style>`,
);
html = html.replace(
  '<script type="module" src="app.js"></script>',
  `<script type="module">\n${js}\n</script>`,
);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/moon-or-rug.html', html);
console.log('Wrote dist/moon-or-rug.html', html.length, 'bytes');
