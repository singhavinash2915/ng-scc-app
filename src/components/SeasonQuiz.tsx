import { useState, useMemo } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import type { Award, ClubWrapped } from '../hooks/useSeasonFinale';
import type { Member } from '../types';

interface Props {
  awards: Award[];
  clubWrapped: ClubWrapped;
  members: Member[];
  season: string;
  onClose: () => void;
}

interface Q { q: string; options: string[]; answer: number; }

function shuffle<T>(a: T[]): T[] { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

function buildQuiz(awards: Award[], cw: ClubWrapped, members: Member[]): Q[] {
  const names = members.map(m => m.name);
  const pick3 = (exclude: string) => shuffle(names.filter(n => n !== exclude)).slice(0, 3);
  const mc = (q: string, correct: string, distract: string[]): Q => {
    const options = shuffle([correct, ...distract]);
    return { q, options, answer: options.indexOf(correct) };
  };

  const qs: Q[] = [];
  // Award-winner questions (skip MVP a little to vary)
  awards.filter(a => a.member).slice(0, 6).forEach(a => {
    qs.push(mc(`${a.emoji} Who won ${a.title}?`, a.member!.name, pick3(a.member!.name)));
  });
  // Club Wrapped questions
  if (cw.topScorer) qs.push(mc(`🏏 Who scored the most runs (${cw.topScorer.runs})?`, cw.topScorer.name, pick3(cw.topScorer.name)));
  if (cw.topWicket) qs.push(mc(`🎯 Who took the most wickets (${cw.topWicket.wkts})?`, cw.topWicket.name, pick3(cw.topWicket.name)));
  if (cw.mostMom) qs.push(mc(`👑 Who won the most Man-of-the-Match awards (${cw.mostMom.count})?`, cw.mostMom.name, pick3(cw.mostMom.name)));
  qs.push(mc(`📊 What was SCC's win rate this season?`, `${cw.winPct}%`, shuffle([`${Math.max(0, cw.winPct - 11)}%`, `${Math.min(100, cw.winPct + 9)}%`, `${Math.min(100, cw.winPct + 18)}%`])));
  qs.push(mc(`✅ How many matches did SCC win?`, String(cw.won), shuffle([String(cw.won + 4), String(Math.max(0, cw.won - 6)), String(cw.won + 11)])));

  return shuffle(qs).slice(0, 8);
}

/**
 * "How well do you know SCC's season?" — a quick data-driven quiz to play live
 * at the awards party. Questions are generated from the season's real stats.
 */
export function SeasonQuiz({ awards, clubWrapped, members, season, onClose }: Props) {
  const quiz = useMemo(() => buildQuiz(awards, clubWrapped, members), [awards, clubWrapped, members]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const cur = quiz[i];

  const choose = (oi: number) => {
    if (picked != null) return;
    setPicked(oi);
    if (oi === cur.answer) setScore(s => s + 1);
  };
  const nextQ = () => {
    if (i < quiz.length - 1) { setI(i + 1); setPicked(null); }
    else setDone(true);
  };
  const restart = () => { setI(0); setPicked(null); setScore(0); setDone(false); };

  const verdict = score === quiz.length ? 'Perfect! 🏆 True SCC superfan'
    : score >= quiz.length * 0.7 ? 'Brilliant! 🔥 You know your cricket'
    : score >= quiz.length * 0.4 ? 'Not bad! 👏 Solid effort'
    : 'Time to watch more SCC games! 🏏';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-white"
      style={{ background: 'radial-gradient(1000px circle at 50% -10%, rgba(56,189,248,0.18), transparent 50%), radial-gradient(800px circle at 100% 110%, rgba(16,185,129,0.22), transparent 50%), #06080f' }}>
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-5 text-white/70">
        <span className="text-xs font-black uppercase tracking-[3px]">🧠 SCC Season Quiz · {season}</span>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X className="w-6 h-6" /></button>
      </div>

      {!done ? (
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between text-xs text-white/50 font-bold mb-3">
            <span>Question {i + 1} / {quiz.length}</span>
            <span>Score {score}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-6">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${((i + (picked != null ? 1 : 0)) / quiz.length) * 100}%` }} />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight mb-6">{cur.q}</h2>
          <div className="grid gap-3">
            {cur.options.map((opt, oi) => {
              const isCorrect = oi === cur.answer;
              const isPicked = oi === picked;
              const show = picked != null;
              return (
                <button key={oi} onClick={() => choose(oi)} disabled={show}
                  className={`flex items-center justify-between gap-3 px-5 py-4 rounded-2xl text-left font-bold border transition-all ${
                    show && isCorrect ? 'bg-emerald-500/25 border-emerald-400 text-white'
                    : show && isPicked ? 'bg-red-500/20 border-red-400/60 text-white'
                    : 'bg-white/[0.06] border-white/15 hover:bg-white/[0.12]'}`}>
                  <span>{opt}</span>
                  {show && isCorrect && <Check className="w-5 h-5 text-emerald-300 shrink-0" />}
                </button>
              );
            })}
          </div>
          {picked != null && (
            <button onClick={nextQ} className="mt-6 w-full py-3.5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 font-black text-lg">
              {i < quiz.length - 1 ? 'Next question →' : 'See result 🏁'}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center animate-[pop_.5s_cubic-bezier(.34,1.56,.64,1)]">
          <p className="text-6xl mb-3">{score >= quiz.length * 0.7 ? '🏆' : '🏏'}</p>
          <p className="font-display text-5xl font-extrabold tabular-nums">{score}<span className="text-white/40 text-3xl">/{quiz.length}</span></p>
          <p className="text-lg font-bold text-cyan-300 mt-3">{verdict}</p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <button onClick={restart} className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 border border-white/20 font-bold"><RotateCcw className="w-4 h-4" /> Play again</button>
            <button onClick={onClose} className="px-5 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 font-bold">Done</button>
          </div>
        </div>
      )}
      <style>{`@keyframes pop { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
