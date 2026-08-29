import { Fragment } from 'react';

// ─── Just enough markdown ─────────────────────────────────────────────────────
// The model answers in markdown, and rendering it as plain text put literal
// asterisks on screen — "**SCC Agni**" — which reads as broken rather than bold.
//
// A full markdown library is a lot of bundle for a chat panel that needs bold,
// bullets and headings. This handles those three and leaves everything else as
// written, which is the honest failure mode: unstyled but readable.

/** **bold** and *italic*, applied within one line. */
function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return <strong key={`${key}-${i}`} className="font-black">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <em key={`${key}-${i}`}>{p.slice(1, -1)}</em>;
    }
    return <Fragment key={`${key}-${i}`}>{p}</Fragment>;
  });
}

export function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-1.5" />;

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          return (
            <p key={i} className="font-black text-slate-900 dark:text-white pt-1">
              {inline(heading[2], String(i))}
            </p>
          );
        }

        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">•</span>
              <span>{inline(bullet[1], String(i))}</span>
            </div>
          );
        }

        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (numbered) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-slate-400 shrink-0 tabular-nums">{numbered[1]}.</span>
              <span>{inline(numbered[2], String(i))}</span>
            </div>
          );
        }

        return <p key={i}>{inline(line, String(i))}</p>;
      })}
    </div>
  );
}
