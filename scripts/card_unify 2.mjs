import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// ─── div → Card ───────────────────────────────────────────────────────────────
// 170 hand-rolled containers across 52 files, each re-deciding its own border,
// background and shadow. This converts the ones that are unambiguously cards.
//
// AST, not regex, for one specific reason: the CLOSING tag has to be the one
// that matches this opening tag, and only a parser knows which that is. A
// regex would happily close the wrong div and produce markup that still
// compiles while nesting everything wrong.
//
// Conservative on purpose — it converts only a plain <div> whose className is a
// single string literal carrying r-card AND a border. Anything with a template
// literal, a conditional, or a ref/style/handler is left alone: those are the
// ones where a human needs to look, and a wrong "fix" there is worse than none.

const PROVIDED = [
  /^r-card$/, /^border$/, /^border-2$/, /^border-slate-\d+$/, /^border-gray-\d+$/,
  /^dark:border-white\/\d+$/, /^dark:border-gray-\d+$/,
  /^bg-white$/, /^dark:bg-white\/\d+$/, /^dark:bg-gray-\d+$/,
  /^shadow-sm$/, /^shadow$/,
];

export function unify(path, { dryRun = false } = {}) {
  const src = readFileSync(path, 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const edits = [];

  traverse(ast, {
    JSXElement(p) {
      const open = p.node.openingElement;
      const close = p.node.closingElement;
      if (!close) return;                                  // self-closing
      if (open.name.type !== 'JSXIdentifier' || open.name.name !== 'div') return;

      const attrs = open.attributes;
      // Only a lone className — anything else is hand-tuned and stays.
      if (attrs.length !== 1) return;
      const a = attrs[0];
      if (a.type !== 'JSXAttribute' || a.name.name !== 'className') return;
      if (a.value?.type !== 'StringLiteral') return;

      const tokens = a.value.value.split(/\s+/).filter(Boolean);
      const hasCard = tokens.includes('r-card');
      const hasBorder = tokens.some(t => t === 'border' || t === 'border-2');
      if (!hasCard || !hasBorder) return;

      // Drop what Card already provides; keep layout and padding.
      const keep = tokens.filter(t => !PROVIDED.some(re => re.test(t)));
      const cls = keep.join(' ');

      edits.push({
        start: open.start, end: open.end,
        next: cls ? `<Card className="${cls}">` : '<Card>',
      });
      edits.push({ start: close.start, end: close.end, next: '</Card>' });
    },
  });

  if (!edits.length) return { changed: false, count: 0 };
  if (dryRun) return { changed: true, count: edits.length / 2 };

  edits.sort((x, y) => y.start - x.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.next + out.slice(e.end);

  // Make sure Card is imported.
  if (!/import\s*\{[^}]*\bCard\b[^}]*\}\s*from\s*['"].*ui\/Card['"]/.test(out)) {
    const depth = path.includes('/components/') && !path.includes('/components/ui/') ? './ui/Card'
      : path.includes('/pages/') ? '../components/ui/Card' : './ui/Card';
    out = out.replace(/^(import .*\n)/, `$1import { Card } from '${depth}';\n`);
  }
  writeFileSync(path, out);
  return { changed: true, count: edits.length / 2 };
}

for (const f of process.argv.slice(2)) {
  const dry = process.env.DRY === '1';
  const r = unify(f, { dryRun: dry });
  console.log(`${r.changed ? `${dry ? 'would convert' : 'converted'} ${r.count}` : 'no candidates'}  ${f}`);
}
