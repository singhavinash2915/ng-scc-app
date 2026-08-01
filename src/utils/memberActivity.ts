import type { Match } from '../types';

/**
 * Get IDs of members who played in the last N matches.
 * A member is considered "active" if they participated in any of the last 10 matches.
 */
export function getActiveMemberIds(matches: Match[], lastN: number = 10): Set<string> {
  // Only matches that were actually PLAYED count. Fixtures booked months ahead
  // (result 'upcoming') have no squad yet — before this filter, a freshly synced
  // season of fixtures would fill the whole window and wipe out the active list.
  const recentMatches = matches
    .filter(m => m.result !== 'cancelled' && m.result !== 'upcoming')
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
