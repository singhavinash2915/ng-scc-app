import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Navigation, PartyPopper, Car, Utensils, Trophy, Check,
  Clock, Backpack, Users, Share2, Sparkles, ArrowLeft,
} from 'lucide-react';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';
import { TEAM_OUTING, SEED_ATTENDEES } from '../config/outing';
import { AWARDS_NIGHT } from '../config/awardsNight';
import { useTeamOuting, type OutingStatus, type FoodPref, type DrinkPref } from '../hooks/useTeamOuting';
import { useMembers } from '../hooks/useMembers';
import type { Member } from '../types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

// ─── Countdown to the outing ───────────────────────────────────────────────────
function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return <div className="font-display text-2xl font-extrabold text-white">It's party time! 🥳</div>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const cell = (v: number, l: string) => (
    <div className="text-center bg-white/15 backdrop-blur rounded-2xl px-3 py-2 min-w-[64px]">
      <div className="font-display text-2xl font-extrabold tabular-nums leading-none">{String(v).padStart(2, '0')}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest mt-1 text-white/70">{l}</div>
    </div>
  );
  return <div className="flex gap-2 justify-center">{cell(d, 'Days')}{cell(h, 'Hrs')}{cell(m, 'Min')}{cell(s, 'Sec')}</div>;
}

function Avatar({ member, name, size = 36 }: { member?: Member; name: string; size?: number }) {
  return member?.avatar_url ? (
    <img src={member.avatar_url} alt="" className="rounded-full object-cover border-2 border-white/40" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center font-black text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function TeamOuting() {
  const { members } = useMembers();
  const { myRsvp, loading, tableMissing, submit, going, maybe, food, drinks, needRide, canDrive } = useTeamOuting();

  // Before the table exists, show the 23 confirmed names so the page looks alive.
  const goingList = going.length > 0
    ? going
    : (tableMissing ? SEED_ATTENDEES.map((n, i) => ({ id: `seed-${i}`, name: n })) : []);

  const memberByFirst = useMemo(() => {
    const map: Record<string, Member> = {};
    members.forEach(m => { const f = norm(m.name.split(' ')[0]); if (f && !map[f]) map[f] = m; });
    return map;
  }, [members]);
  const findMember = (name: string) => memberByFirst[norm(name.split(' ')[0])];

  // RSVP form
  const [name, setName] = useState('');
  const [status, setStatus] = useState<OutingStatus>('going');
  const [foodPref, setFoodPref] = useState<FoodPref>('either');
  const [drinkPref, setDrinkPref] = useState<DrinkPref>('none');
  const [needsRide, setNeedsRide] = useState(false);
  const [canDriveMe, setCanDriveMe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (myRsvp) {
      setName(myRsvp.name); setStatus(myRsvp.status);
      setFoodPref(myRsvp.food_pref ?? 'either');
      setDrinkPref(myRsvp.drink_pref ?? 'none');
      setNeedsRide(myRsvp.needs_ride); setCanDriveMe(myRsvp.can_drive);
    }
  }, [myRsvp]);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await submit({ name, status, food_pref: foodPref, drink_pref: drinkPref, needs_ride: needsRide, can_drive: canDriveMe });
    setSaving(false);
    if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  function share() {
    const text = `🎉 SCC Team Outing — ${TEAM_OUTING.dateLabel}\n📍 ${TEAM_OUTING.venue}, ${TEAM_OUTING.venueAddress}\n\nRSVP & details: ${window.location.origin}/outing`;
    if (navigator.share) navigator.share({ title: TEAM_OUTING.title, text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); }
  }

  const foodTotal = Math.max(1, food.veg + food.nonveg + food.either);

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(160deg,#0f172a 0%,#3b0764 40%,#831843 75%,#7c2d12 100%)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Back to app */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Back to app
        </Link>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl p-6 text-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777 55%,#f59e0b)' }}>
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-black/10 blur-3xl" />
          <img src={SCC_LOGO_DATA_URL} alt="SCC" className="w-14 h-14 rounded-2xl mx-auto shadow-lg relative" />
          <div className="inline-flex items-center gap-1.5 mt-4 bg-white/15 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[2px]">
            <PartyPopper className="w-3.5 h-3.5" /> Team Outing
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold mt-2 drop-shadow">Sangria Day Out 🎉</h1>
          <p className="text-white/90 font-semibold mt-1">{TEAM_OUTING.dateLabel} · {TEAM_OUTING.timeRange}</p>
          <p className="text-white/70 text-sm">📍 {TEAM_OUTING.venue} · {TEAM_OUTING.distanceKm} km from {TEAM_OUTING.distanceFrom}</p>
          <div className="mt-5"><Countdown target={TEAM_OUTING.date} /></div>
          <button onClick={share} className="mt-5 inline-flex items-center gap-1.5 bg-white text-slate-900 font-black text-sm rounded-full px-4 py-2">
            <Share2 className="w-4 h-4" /> Share with the squad
          </button>
        </div>

        {tableMissing && (
          <div className="rounded-2xl bg-amber-500/20 border border-amber-400/40 p-3 text-sm text-amber-100 text-center">
            ⚙️ RSVP goes live once the <code>outing_rsvps</code> table is created (run the migration).
          </div>
        )}

        {/* ── WHO'S COMING ─────────────────────────────────────────────────── */}
        <div className="rounded-3xl bg-white/10 backdrop-blur p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-lg flex items-center gap-2"><Users className="w-5 h-5 text-emerald-300" /> Who's coming</h2>
            <div className="text-sm font-bold">
              <span className="text-emerald-300">{goingList.length} going</span>
              {maybe.length > 0 && <span className="text-amber-300"> · {maybe.length} maybe</span>}
            </div>
          </div>
          {loading ? (
            <p className="text-white/50 text-sm">Loading the guest list…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {goingList.map(r => (
                <div key={r.id} className="flex items-center gap-1.5 bg-white/10 rounded-full pl-1 pr-3 py-1">
                  <Avatar member={findMember(r.name)} name={r.name} size={26} />
                  <span className="text-xs font-semibold">{r.name}</span>
                </div>
              ))}
              {maybe.map(r => (
                <div key={r.id} className="flex items-center gap-1.5 bg-white/5 rounded-full pl-1 pr-3 py-1 opacity-70">
                  <Avatar member={findMember(r.name)} name={r.name} size={26} />
                  <span className="text-xs font-semibold">{r.name} <span className="text-amber-300">· maybe</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RSVP ─────────────────────────────────────────────────────────── */}
        <div className="rounded-3xl bg-white/10 backdrop-blur p-5">
          <h2 className="font-black text-lg mb-1">{myRsvp ? 'Update your RSVP' : 'Are you in? 🙌'}</h2>
          <p className="text-white/60 text-sm mb-4">Already on the list? Pick your name to set your prefs — or add yourself.</p>

          {!myRsvp && goingList.length > 0 && (
            <select value="" onChange={e => e.target.value && setName(e.target.value)}
              className="w-full rounded-xl bg-white/90 text-slate-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2">
              <option value="">👋 On the list? Pick your name…</option>
              {goingList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          )}

          <input value={name} onChange={e => setName(e.target.value)} placeholder="…or type your name"
            className="w-full rounded-xl bg-white/90 text-slate-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3" />

          <div className="grid grid-cols-3 gap-2 mb-3">
            {([['going', "I'm in! 🎉", 'bg-emerald-500'], ['maybe', 'Maybe 🤔', 'bg-amber-500'], ['out', "Can't 😔", 'bg-white/15']] as const).map(([v, label, cls]) => (
              <button key={v} onClick={() => setStatus(v)}
                className={`rounded-xl py-2.5 text-xs font-black transition ${status === v ? cls + ' ring-2 ring-white' : 'bg-white/10 text-white/70'}`}>
                {label}
              </button>
            ))}
          </div>

          {status !== 'out' && (
            <>
              <p className="text-[11px] uppercase tracking-wide text-white/50 font-bold mb-1.5">Food preference</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([['veg', '🥗 Veg'], ['nonveg', '🍗 Non-veg'], ['either', '😋 Either']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setFoodPref(v)}
                    className={`rounded-xl py-2 text-xs font-bold transition ${foodPref === v ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white/70'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] uppercase tracking-wide text-white/50 font-bold mb-1.5">Drink preference</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {([['beer', '🍺 Beer'], ['whisky', '🥃 Whisky'], ['soft', '🥤 Soft'], ['none', '🚫 None']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setDrinkPref(v)}
                    className={`rounded-xl py-2 text-[11px] font-bold transition ${drinkPref === v ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white/70'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] uppercase tracking-wide text-white/50 font-bold mb-1.5">Carpool</p>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setNeedsRide(!needsRide)}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${needsRide ? 'bg-sky-400 text-slate-900' : 'bg-white/10 text-white/70'}`}>
                  🙋 Need a ride
                </button>
                <button onClick={() => setCanDriveMe(!canDriveMe)}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${canDriveMe ? 'bg-sky-400 text-slate-900' : 'bg-white/10 text-white/70'}`}>
                  🚗 I can drive
                </button>
              </div>
            </>
          )}

          <button onClick={handleSubmit} disabled={saving || !name.trim() || tableMissing}
            className="w-full rounded-xl bg-white text-slate-900 font-black py-3 text-sm disabled:opacity-40">
            {saved ? '✓ Saved!' : saving ? 'Saving…' : myRsvp ? 'Update RSVP' : 'Count me in →'}
          </button>
        </div>

        {/* ── LOCATION ─────────────────────────────────────────────────────── */}
        <div className="rounded-3xl bg-white/10 backdrop-blur p-5">
          <h2 className="font-black text-lg flex items-center gap-2 mb-2"><MapPin className="w-5 h-5 text-rose-300" /> Location</h2>
          <p className="font-bold text-white">{TEAM_OUTING.venue}</p>
          <p className="text-white/70 text-sm">{TEAM_OUTING.venueAddress}</p>
          <p className="text-white/50 text-xs mt-1">🚗 {TEAM_OUTING.distanceKm} km from {TEAM_OUTING.distanceFrom} · ~1 hr drive</p>
          <a href={TEAM_OUTING.mapsUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 bg-rose-500 text-white font-black text-sm rounded-full px-4 py-2.5">
            <Navigation className="w-4 h-4" /> Open in Google Maps
          </a>
        </div>

        {/* ── ITINERARY ────────────────────────────────────────────────────── */}
        <div className="rounded-3xl bg-white/10 backdrop-blur p-5">
          <h2 className="font-black text-lg flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-violet-300" /> Plan for the day</h2>
          <div className="space-y-3">
            {TEAM_OUTING.itinerary.map((it, i) => (
              <div key={i} className="flex gap-3">
                <div className="text-2xl">{it.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-sm">{it.title}</span>
                    <span className="text-[11px] text-white/50 font-semibold">{it.time}</span>
                  </div>
                  <p className="text-white/60 text-xs">{it.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOD TALLY + CARPOOL ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white/10 backdrop-blur p-5">
            <h2 className="font-black text-base flex items-center gap-2 mb-3"><Utensils className="w-4 h-4 text-amber-300" /> Food count</h2>
            {([['🥗 Veg', food.veg, 'bg-emerald-400'], ['🍗 Non-veg', food.nonveg, 'bg-rose-400'], ['😋 Either', food.either, 'bg-amber-400']] as const).map(([label, n, cls]) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between text-xs font-semibold mb-1"><span>{label}</span><span>{n}</span></div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${cls}`} style={{ width: `${(n / foodTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-white/10 backdrop-blur p-5">
            <h2 className="font-black text-base flex items-center gap-2 mb-3">🍻 Drinks</h2>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="bg-white/10 rounded-full px-2.5 py-1">🍺 Beer {drinks.beer}</span>
              <span className="bg-white/10 rounded-full px-2.5 py-1">🥃 Whisky {drinks.whisky}</span>
              <span className="bg-white/10 rounded-full px-2.5 py-1">🥤 Soft {drinks.soft}</span>
              <span className="bg-white/10 rounded-full px-2.5 py-1">🚫 None {drinks.none}</span>
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 backdrop-blur p-5 sm:col-span-2">
            <h2 className="font-black text-base flex items-center gap-2 mb-3"><Car className="w-4 h-4 text-sky-300" /> Carpool</h2>
            <p className="text-sm"><span className="font-black text-sky-300">{canDrive.length}</span> can drive · <span className="font-black text-amber-300">{needRide.length}</span> need a ride</p>
            {canDrive.length > 0 && <p className="text-[11px] text-white/60 mt-2">🚗 {canDrive.map(r => r.name).join(', ')}</p>}
            {needRide.length > 0 && <p className="text-[11px] text-white/60 mt-1">🙋 {needRide.map(r => r.name).join(', ')}</p>}
            <a href={`https://wa.me/${TEAM_OUTING.whatsappNumber}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500 text-white font-bold text-xs rounded-full px-3 py-2">
              💬 Coordinate on WhatsApp
            </a>
          </div>
        </div>

        {/* ── PACKING ──────────────────────────────────────────────────────── */}
        <div className="rounded-3xl bg-white/10 backdrop-blur p-5">
          <h2 className="font-black text-lg flex items-center gap-2 mb-3"><Backpack className="w-5 h-5 text-emerald-300" /> What to bring</h2>
          <div className="grid grid-cols-2 gap-2">
            {TEAM_OUTING.packing.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                <span className="text-lg">{p.emoji}</span>
                <span className="text-xs font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── AWARDS NIGHT teaser ──────────────────────────────────────────── */}
        <div className="rounded-3xl p-5 text-center" style={{ background: 'linear-gradient(120deg,#78350f,#b45309 55%,#f59e0b)' }}>
          <Trophy className="w-8 h-8 mx-auto text-white drop-shadow" fill="currentColor" />
          <h2 className="font-display text-xl font-extrabold mt-2">🏆 SCC Awards Night</h2>
          <p className="text-white/85 text-sm mt-1">The season awards + People's Awards reveal happen right here at the outing, {AWARDS_NIGHT.label}.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
            <Link to="/vote" className="inline-flex items-center justify-center gap-1.5 bg-white text-slate-900 font-black text-sm rounded-full px-4 py-2.5">
              <Check className="w-4 h-4" /> Cast your People's Award votes
            </Link>
            <Link to="/season" className="inline-flex items-center justify-center gap-1.5 bg-white/20 text-white font-black text-sm rounded-full px-4 py-2.5">
              <Sparkles className="w-4 h-4" /> Season Finale
            </Link>
          </div>
        </div>

        <p className="text-center text-white/40 text-xs pb-6">See you at Barguje Farms! 🏏🔥 · Sangria Cricket Club</p>
      </div>
    </div>
  );
}
