#!/usr/bin/env bash
# ─── Point the whole app at a different Supabase project ─────────────────────
#
# The project ref and anon key are written into sixteen files — the client, the
# AI hook, the service-worker cache rules in vite.config.ts, and thirteen sync
# scripts. Doing that by hand under time pressure is how one gets missed and the
# nightly sync quietly keeps writing to the old database for a week.
#
#   ./scripts/switch_supabase_project.sh <new-ref> <new-anon-key> [--dry-run]
#
# Everything is a plain text substitution in tracked files, so `git diff` shows
# exactly what changed and `git checkout .` undoes all of it.

set -euo pipefail

OLD_REF="zrrmpaatydhlkntfpcmw"
OLD_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"

NEW_REF="${1:-}"
NEW_KEY="${2:-}"
DRY="${3:-}"

if [[ -z "$NEW_REF" || -z "$NEW_KEY" ]]; then
  echo "usage: $0 <new-project-ref> <new-anon-key> [--dry-run]" >&2
  exit 1
fi
if [[ "$NEW_REF" == "$OLD_REF" ]]; then
  echo "That is the current project ref — nothing to do." >&2
  exit 1
fi

# Tracked files only. Build output under dist/, android/ and ios/ is regenerated
# by the next build, and node_modules is not ours to edit.
FILES=$(git ls-files | grep -vE '^(dist|android|ios)/' | xargs grep -l "$OLD_REF" 2>/dev/null || true)

if [[ -z "$FILES" ]]; then
  echo "No tracked file mentions $OLD_REF. Already switched?" >&2
  exit 1
fi

echo "Files to update:"
echo "$FILES" | sed 's/^/  /'
echo
echo "  ref:  $OLD_REF  ->  $NEW_REF"
echo "  key:  ...${OLD_KEY: -12}  ->  ...${NEW_KEY: -12}"
echo

if [[ "$DRY" == "--dry-run" ]]; then
  echo "(dry run — nothing written)"
  exit 0
fi

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  perl -pi -e "s/\Q$OLD_REF\E/$NEW_REF/g; s/\Q$OLD_KEY\E/$NEW_KEY/g" "$f"
done <<< "$FILES"

echo "Done. Verifying nothing was missed:"
LEFT=$(git ls-files | grep -vE '^(dist|android|ios)/' | xargs grep -l "$OLD_REF" 2>/dev/null || true)
if [[ -n "$LEFT" ]]; then
  echo "  ⚠ still referencing the old project:"; echo "$LEFT" | sed 's/^/    /'
  exit 1
fi
echo "  ✓ no tracked file references the old project"
echo
echo "Next: npm run build, then redeploy. The mobile builds under android/ and"
echo "ios/ carry the old URL in their bundled assets until they are rebuilt."
