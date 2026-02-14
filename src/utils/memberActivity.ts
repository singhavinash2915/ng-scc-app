import type { Match } from '../types';

/**
 * Get IDs of members who played in the last N matches.
 * A member is considered "active" if they participated in any of the last 10 matches.
 */
export function getActiveMemberIds(matches: Match[], lastN: number = 10): Set<string> {
  // Get the last N matches (excluding cancelled ones)
  const recentMatches = matches
    .filter(m => m.result !== 'cancelled')
    .slice(0, lastN);

  const activeMemberIds = new Set<string>();

  recentMatches.forEach(match => {
    match.players?.forEach(player => {
      activeMemberIds.add(player.member_id);
    });
  });

  return activeMemberIds;
}

/**
 * Check if a specific member is active (played in last N matches)
 */
export function isActiveMember(
  memberId: string,
  activeMemberIds: Set<string>
): boolean {
  return activeMemberIds.has(memberId);
}
