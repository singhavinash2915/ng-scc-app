#!/usr/bin/env python3
"""
One-off cleanup: merge duplicate matches created by the sync script.

For each (date, manual-entry, sync-entry) pair:
  - Copy ch_match_id + man_of_match_id from the sync entry to the manual entry
    (only where the manual entry has them unset).
  - Delete the sync entry.

Genuine doubleheaders (two different teams on the same date) are preserved by
comparing normalized opponent names — only pairs whose normalized names match
are merged.
"""
import json, urllib.request, urllib.error, sys, re, datetime

SUPABASE_URL = "https://zrrmpaatydhlkntfpcmw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpycm1wYWF0eWRobGtudGZwY213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTIzNDcsImV4cCI6MjA4Mjc4ODM0N30.kHot4i6MNPjt2neNzJ_tMAplJi_9CiYNgFzAzmEgdeg"

# Common filler words that don't disambiguate teams
FILLERS = {'xi', '11', 'x1', 'cricket', 'club', 'the'}

def normalize(name):
    """Lowercase, strip punctuation/parens, collapse spaces, drop filler words."""
    if not name:
        return ''
    # Strip parentheticals like "(YNR)"
    s = re.sub(r'\([^)]*\)', ' ', name.lower())
    # Replace non-alphanumeric with spaces
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    # Drop filler words
    tokens = [t for t in s.split() if t and t not in FILLERS]
    return ' '.join(tokens).strip()

def lev(a, b):
    """Levenshtein edit distance."""
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        cur = [i + 1]
        for j, cb in enumerate(b):
            cur.append(min(prev[j + 1] + 1, cur[j] + 1, prev[j] + (ca != cb)))
        prev = cur
    return prev[-1]

def initials(s):
    """First letter of each word in normalized string (fillers kept)."""
    return ''.join(w[0] for w in s.split() if w)

def raw_initials(name):
    """Initials from the original name — don't drop filler words like 'Club'/'XI',
    but strip parentheticals so 'Yashwin Night Riders(YNR)' doesn't yield 'YNRY'."""
    if not name:
        return ''
    s = re.sub(r'\([^)]*\)', ' ', name)
    words = re.sub(r'[^a-zA-Z ]+', ' ', s).split()
    return ''.join(w[0].lower() for w in words if w)

def same_team(a, b):
    """Are these two opponent names the same team? Combines several fuzzy checks."""
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return False
    # 1. Exact
    if na == nb:
        return True
    # 2. One contains the other (e.g. "game changers" ⊂ "riviera game changers")
    if na in nb or nb in na:
        return True
    # 3. One is the initials of the other ("ynr" ↔ "yashwin night riders",
    #    "yucc" ↔ "Yashwin United Cricket Club")
    short, long = (a, b) if len(a) < len(b) else (b, a)
    short_raw = re.sub(r'[^a-z]', '', short.lower())
    if 2 <= len(short_raw) <= 6 and raw_initials(long) == short_raw:
        return True
    # 4. Edit distance — tolerate small typos
    d = lev(na, nb)
    if d <= 2 and min(len(na), len(nb)) >= 4:
        return True
    if d / max(len(na), len(nb)) <= 0.25:
        return True
    # 5. Primary token prefix match ≥4 chars (catches "deadly boys" vs "deadly boyz")
    pa = na.split()[0] if na.split() else ''
    pb = nb.split()[0] if nb.split() else ''
    if pa and pb and pa[:4] == pb[:4] and len(pa) >= 4:
        return True
    return False

def sb(method, path, body=None, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}{('?' + params) if params else ''}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode() if body else None,
        headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json", "Prefer": "return=representation",
        }, method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            resp = r.read()
            return r.status, json.loads(resp) if resp else None
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def main():
    dry_run = '--apply' not in sys.argv
    print("🔍 DEDUPE MATCHES\n" + ('-' * 50))
    if dry_run:
        print("[DRY RUN] Pass --apply to actually delete. Showing what would happen...\n")

    code, matches = sb("GET", "matches",
                       params="select=id,date,opponent,ch_match_id,man_of_match_id,created_at,"
                              "players:match_players(member_id)&"
                              "date=gte.2025-09-01&order=date.asc")
    if code != 200:
        print(f"❌ Failed to fetch matches: {code}")
        sys.exit(1)

    from collections import defaultdict
    by_date = defaultdict(list)
    for m in matches:
        by_date[m['date']].append(m)

    merged = kept = 0
    for date, ms in sorted(by_date.items()):
        if len(ms) <= 1:
            continue

        # Process all pairs
        handled = set()
        for i, a in enumerate(ms):
            if a['id'] in handled:
                continue
            for j, b in enumerate(ms):
                if i >= j or b['id'] in handled:
                    continue
                if not same_team(a['opponent'], b['opponent']):
                    continue

                # Choose "keeper" — prefer the one with players; else older created_at
                a_players = len(a.get('players') or [])
                b_players = len(b.get('players') or [])
                if a_players != b_players:
                    keeper, victim = (a, b) if a_players > b_players else (b, a)
                else:
                    keeper, victim = (a, b) if a['created_at'] < b['created_at'] else (b, a)

                # Build patch: copy ch_match_id/MOM from victim to keeper if keeper lacks them
                patch = {}
                if not keeper.get('ch_match_id') and victim.get('ch_match_id'):
                    patch['ch_match_id'] = victim['ch_match_id']
                if not keeper.get('man_of_match_id') and victim.get('man_of_match_id'):
                    patch['man_of_match_id'] = victim['man_of_match_id']

                print(f"  {date}")
                print(f"    KEEP   id={keeper['id'][:8]}  opp={keeper['opponent'][:35]:<35} players={len(keeper.get('players') or [])}")
                print(f"    DELETE id={ victim['id'][:8]}  opp={ victim['opponent'][:35]:<35} players={len(victim.get('players') or [])}")
                if patch:
                    print(f"    PATCH  {patch}")

                if not dry_run:
                    if patch:
                        # Clear victim's ch_match_id first to avoid unique constraint conflict
                        if 'ch_match_id' in patch:
                            sb("PATCH", "matches", body={'ch_match_id': None},
                               params=f"id=eq.{victim['id']}")
                        sb("PATCH", "matches", body=patch,
                           params=f"id=eq.{keeper['id']}")
                    sb("DELETE", "matches", params=f"id=eq.{victim['id']}")

                handled.add(a['id'])
                handled.add(b['id'])
                merged += 1
                break

        # Remaining unhandled on this date = genuine doubleheader entries
        kept += sum(1 for m in ms if m['id'] not in handled)

    print(f"\n{'='*50}")
    print(f"  Merged {merged} duplicate pair{'s' if merged != 1 else ''}")
    print(f"  Preserved {kept} genuine doubleheader entries")
    if dry_run:
        print(f"\n  ℹ️  Re-run with --apply to actually merge")
    else:
        print(f"\n  ✅ Cleanup complete")

if __name__ == '__main__':
    main()
