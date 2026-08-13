// Fail the lint run if a utility class is glued to a ${...} interpolation.
//
// Tailwind v4's scanner stops at the `$`, so `class="… rounded-t-2xl${cond ? …}"`
// never yields `rounded-t-2xl` - the rule is simply not generated and the element
// renders unstyled with no error anywhere. Tailwind v3 extracted it, so this
// became a live bug the moment the project moved to v4 (#94): every area and
// device box on the board lost its rounded top corners.
//
// Cheap to check, invisible if you don't: hence a lint step.
import fs from 'fs';
import path from 'path';

const ROOTS = ['public/js', 'public'];
const files = [];
for (const root of ROOTS) {
  for (const f of fs.readdirSync(root, { withFileTypes: true })) {
    if (!f.isFile()) continue;
    if (/\.(js|html)$/.test(f.name)) files.push(path.join(root, f.name));
  }
}

const ATTR = /class="([^"]*)"/g;
const GLUED = /([A-Za-z0-9_\-[\].:/%]+)\$\{/g;
const hits = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(ATTR)) {
    for (const g of m[1].matchAll(GLUED)) {
      hits.push({ file, line: src.slice(0, m.index).split('\n').length, token: g[1] });
    }
  }
}

if (hits.length) {
  console.error(`\n${hits.length} class token(s) glued to a template interpolation:\n`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  \`${h.token}\` is swallowed by the following \${`);
  }
  console.error('\nPut a space before the ${ so Tailwind can see the class.\n');
  process.exit(1);
}
console.log('no glued class tokens');
