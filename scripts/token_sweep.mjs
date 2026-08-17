import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// ─── Design-token sweep, over the AST ─────────────────────────────────────────
// Two regex attempts got this wrong in the same way: both misread which element
// a className belongs to, because `onClick={() => …}` contains a ">" and a
// backwards scan treats that as the tag closing. Every button in the app then
// looked like a container.
//
// The parser knows. A JSXAttribute hangs off its JSXOpeningElement, so the
// element name is simply read, never inferred — the failure mode is gone by
// construction rather than patched.

const CONTROL = new Set(['button', 'input', 'select', 'textarea', 'label']);

const RADIUS = {
  'rounded-3xl': 'card', 'rounded-2xl': 'card',
  'rounded-xl': 'either', 'rounded-lg': 'either', 'rounded-md': 'either',
};
const TEXT = {
  'text-[8px]': 't-micro', 'text-[9px]': 't-micro', 'text-[10px]': 't-micro',
  'text-[11px]': 't-meta', 'text-[12px]': 't-body', 'text-[13px]': 't-body',
  'text-[14px]': 't-lead', 'text-[15px]': 't-lead',
};

/** Rewrite one class string given the element it sits on. */
function rewrite(value, elementName, stats) {
  const isControl = CONTROL.has(elementName);
  const out = value.split(/(\s+)/).map(tok => {
    const kind = RADIUS[tok];
    if (kind) {
      // The ELEMENT decides, never the old class. An <input> that happened to
      // be written rounded-2xl is still a control, and letting the old value
      // win is exactly how the inputs ended up with card corners last time.
      // Link/NavLink are excluded from CONTROL for this reason: a tappable
      // card is still a card, and those wrap whole panels far more often than
      // they wrap buttons.
      const t = isControl ? 'r-control' : 'r-card';
      stats[t] = (stats[t] ?? 0) + 1;
      return t;
    }
    if (TEXT[tok]) { stats.text = (stats.text ?? 0) + 1; return TEXT[tok]; }
    return tok;
  });
  return out.join('');
}

export function sweepFile(path) {
  const src = readFileSync(path, 'utf8');
  const ast = parser.parse(src, {
    sourceType: 'module', plugins: ['jsx', 'typescript'],
  });

  // Collect edits with absolute offsets, then apply back-to-front so earlier
  // offsets stay valid.
  const edits = [];
  const stats = {};

  traverse(ast, {
    JSXAttribute(p) {
      if (p.node.name.name !== 'className') return;
      const el = p.parent;                       // the JSXOpeningElement
      const nameNode = el.name;
      const elementName = nameNode.type === 'JSXIdentifier' ? nameNode.name
        : nameNode.type === 'JSXMemberExpression' ? nameNode.property.name : '';

      const v = p.node.value;
      const strings = [];
      if (v?.type === 'StringLiteral') strings.push(v);
      else if (v?.type === 'JSXExpressionContainer') {
        // Template literals and conditionals — every string piece inside.
        p.traverse({
          StringLiteral(sp) { strings.push(sp.node); },
          TemplateElement(tp) { strings.push(tp.node); },
        });
      }

      for (const s of strings) {
        const raw = s.type === 'TemplateElement' ? s.value.raw : s.value;
        const next = rewrite(raw, elementName, stats);
        if (next === raw) continue;
        // Replace only the literal's inner text, leaving quotes/backticks.
        const start = s.type === 'TemplateElement' ? s.start : s.start + 1;
        const end = s.type === 'TemplateElement' ? s.end : s.end - 1;
        edits.push({ start, end, next });
      }
    },
  });

  if (!edits.length) return { changed: false, stats };
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.next + out.slice(e.end);
  writeFileSync(path, out);
  return { changed: true, stats };
}

const files = process.argv.slice(2);
for (const f of files) {
  const { changed, stats } = sweepFile(f);
  console.log(`${changed ? 'updated ' : 'unchanged'} ${f.padEnd(34)} ${JSON.stringify(stats)}`);
}
