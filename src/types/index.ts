export interface Member {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  join_date: string;
  status: 'active' | 'inactive';
  balance: number;
  matches_played: number;
  avatar_url: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  date: string;
  venue: string;
  opponent: string | null;
  result: 'won' | 'lost' | 'draw' | 'upcoming' | 'cancelled';
  our_score: string | null;
  opponent_score: string | null;
  match_fee: number;
  ground_cost: number;
  other_expenses: number;
  notes: string | null;
  created_at: string;
  players?: MatchPlayer[];
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  member_id: string;
  fee_paid: boolean;
  member?: Member;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'deposit' | 'match_fee' | 'expense' | 'refund';
  amount: number;
  member_id: string | null;
  match_id: string | null;
  description: string | null;
  created_at: string;
  member?: Member;
  match?: Match;
}

export interface MemberRequest {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  experience: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface AppSettings {
  key: string;
  value: Record<string, unknown>;
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalFunds: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
  pendingRequests: number;
}
