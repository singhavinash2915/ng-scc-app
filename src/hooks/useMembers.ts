import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Member } from '../types';

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name');

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (member: Omit<Member, 'id' | 'created_at' | 'matches_played'>) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .insert([{ ...member, matches_played: 0 }])
        .select()
        .single();

      if (error) throw error;
      setMembers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add member');
    }
  };

  const updateMember = async (id: string, updates: Partial<Member>) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === id ? data : m));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update member');
    }
  };

  const deleteMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete member');
    }
  };

  const addFunds = async (memberId: string, amount: number, description: string) => {
    try {
      const member = members.find(m => m.id === memberId);
      if (!member) throw new Error('Member not found');

      // Update member balance
      const newBalance = member.balance + amount;
      await updateMember(memberId, { balance: newBalance });

      // Create transaction record
      await supabase.from('transactions').insert([{
        type: 'deposit',
        amount,
        member_id: memberId,
        description,
      }]);

      return newBalance;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add funds');
    }
  };

  const deductFunds = async (memberId: string, amount: number, description: string, matchId?: string) => {
    try {
      const member = members.find(m => m.id === memberId);
      if (!member) throw new Error('Member not found');

      // Update member balance
      const newBalance = member.balance - amount;
      await updateMember(memberId, { balance: newBalance });

      // Create transaction record
      await supabase.from('transactions').insert([{
        type: 'match_fee',
        amount: -amount,
        member_id: memberId,
        match_id: matchId || null,
        description,
      }]);

      return newBalance;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to deduct funds');
    }
  };

  return {
    members,
    loading,
    error,
    fetchMembers,
    addMember,
    updateMember,
    deleteMember,
    addFunds,
    deductFunds,
  };
}
