import { useMemo } from 'react';
import type { Match, Member } from '../types';

export interface MatchHighlight {
  matchId: string;
  date: string;
  opponent: string;
  result: string;
  venue: string;
  highlights: HighlightItem[];
}

export interface HighlightItem {
  emoji: string;
  label: string;
  value: string;
  type: 'top_scorer' | 'best_bowler' | 'mom' | 'result' | 'team_score';
}

/**
 * Generates auto-generated highlight cards for each completed match.
 * Uses match data + scorecard info embedded in the match object.
 */
export function useMatchHighlights(
  matches: Match[],
  members: Member[],
): MatchHighlight[] {
  return useMemo(() => {
    const memberById = Object.fromEntries(members.map(m => [m.id, m]));

    return matches
      .filter(m => ['won', 'lost', 'draw'].includes(m.result))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .map(match => {
        const highlights: HighlightItem[] = [];

        // Result
        if (match.result === 'won') {
          highlights.push({ emoji: '🏆', label: 'Result', value: `Won vs ${match.opponent || 'opponent'}`, type: 'result' });
        } else if (match.result === 'lost') {
          highlights.push({ emoji: '😤', label: 'Result', value: `Lost vs ${match.opponent || 'opponent'}`, type: 'result' });
        } else {
          highlights.push({ emoji: '🌧️', label: 'Result', value: `No Result vs ${match.opponent || 'opponent'}`, type: 'result' });
        }

        // Team scores
        if (match.our_score) {
          highlights.push({
            emoji: '🏏', label: 'SCC Score', value: match.our_score, type: 'team_score',
          });
        }
        if (match.opponent_score) {
          highlights.push({
            emoji: '🎯', label: `${match.opponent || 'Opponent'}`, value: match.opponent_score, type: 'team_score',
          });
        }

        // Man of the Match
        if (match.man_of_match_id) {
          const momMember = match.man_of_match || memberById[match.man_of_match_id];
          if (momMember) {
            highlights.push({ emoji: '⭐', label: 'Man of the Match', value: momMember.name, type: 'mom' });
          }
        }

        return {
          matchId: match.id,
          date: match.date,
          opponent: match.opponent || 'Unknown',
          result: match.result,
          venue: match.venue || '',
          highlights,
        };
      })
      .filter(h => h.highlights.length > 0);
  }, [matches, members]);
}
