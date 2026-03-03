import { useMemo } from 'react';
import type { Match, Member, Transaction } from '../types';

export interface MatchFeeStatus {
  match: Match;
  totalPlayers: number;
  paidCount: number;
  unpaidCount: number;
  collectionRate: number;
  totalExpected: number;
  totalCollected: number;
  unpaidMembers: Member[];
  paidMembers: Member[];
}

export interface MemberBalanceInfo {
  member: Member;
  lastDepositDate: string | null;
  matchesSinceDeposit: number;
  status: 'healthy' | 'low' | 'critical';
}

export function useFeeTracking(
  matches: Match[],
  members: Member[],
  transactions: Transaction[]
) {
  const matchFeeStatuses = useMemo((): MatchFeeStatus[] => {
    // Get matches that have players assigned (upcoming + recent completed)
    const relevantMatches = matches
      .filter(m => m.players && m.players.length > 0)
      .slice(0, 15); // Last 15 matches

    return relevantMatches.map(match => {
      const players = match.players || [];
      const paidPlayers = players.filter(p => p.fee_paid);
      const unpaidPlayers = players.filter(p => !p.fee_paid);

      const memberMap = new Map(members.map(m => [m.id, m]));

      return {
        match,
        totalPlayers: players.length,
        paidCount: paidPlayers.length,
        unpaidCount: unpaidPlayers.length,
        collectionRate: players.length > 0
          ? Math.round((paidPlayers.length / players.length) * 100)
          : 0,
        totalExpected: players.length * match.match_fee,
        totalCollected: paidPlayers.length * match.match_fee,
        unpaidMembers: unpaidPlayers
          .map(p => memberMap.get(p.member_id))
          .filter((m): m is Member => !!m),
        paidMembers: paidPlayers
          .map(p => memberMap.get(p.member_id))
          .filter((m): m is Member => !!m),
      };
    });
  }, [matches, members]);

  const memberBalances = useMemo((): MemberBalanceInfo[] => {
    const activeMembers = members.filter(m => m.status === 'active');

    return activeMembers.map(member => {
      // Find the most recent deposit
      const memberDeposits = transactions
        .filter(t => t.member_id === member.id && t.type === 'deposit')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const lastDepositDate = memberDeposits.length > 0 ? memberDeposits[0].date : null;

      // Count matches played since last deposit
      let matchesSinceDeposit = 0;
      if (lastDepositDate) {
        const depositTime = new Date(lastDepositDate).getTime();
        const matchFeeTransactions = transactions.filter(
          t => t.member_id === member.id &&
               t.type === 'match_fee' &&
               new Date(t.date).getTime() >= depositTime
        );
        matchesSinceDeposit = matchFeeTransactions.length;
      }

      let status: 'healthy' | 'low' | 'critical' = 'healthy';
      if (member.balance <= 0) {
        status = 'critical';
      } else if (member.balance < 500) {
        status = 'low';
      }

      return {
        member,
        lastDepositDate,
        matchesSinceDeposit,
        status,
      };
    }).sort((a, b) => a.member.balance - b.member.balance);
  }, [members, transactions]);

  const stats = useMemo(() => {
    const activeMembers = members.filter(m => m.status === 'active');
    const totalFunds = activeMembers.reduce((sum, m) => sum + m.balance, 0);
    const avgBalance = activeMembers.length > 0
      ? Math.round(totalFunds / activeMembers.length)
      : 0;

    const criticalCount = memberBalances.filter(m => m.status === 'critical').length;
    const lowCount = memberBalances.filter(m => m.status === 'low').length;
    const healthyCount = memberBalances.filter(m => m.status === 'healthy').length;

    // Total deposits and match fees this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTransactions = transactions.filter(
      t => new Date(t.date) >= monthStart
    );
    const monthDeposits = monthTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const monthMatchFees = monthTransactions
      .filter(t => t.type === 'match_fee')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Overall collection rate for recent matches with players
    const recentWithPlayers = matchFeeStatuses.filter(
      s => s.match.result !== 'cancelled'
    );
    const overallCollectionRate = recentWithPlayers.length > 0
      ? Math.round(
          recentWithPlayers.reduce((sum, s) => sum + s.collectionRate, 0) /
          recentWithPlayers.length
        )
      : 100;

    return {
      totalFunds,
      avgBalance,
      criticalCount,
      lowCount,
      healthyCount,
      monthDeposits,
      monthMatchFees,
      overallCollectionRate,
    };
  }, [members, memberBalances, transactions, matchFeeStatuses]);

  return {
    matchFeeStatuses,
    memberBalances,
    stats,
  };
}
