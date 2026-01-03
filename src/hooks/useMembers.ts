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

  const addFunds = async (memberId: string, amount: number, description: string, date?: string) => {
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
        date: date || new Date().toISOString().split('T')[0],
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

  const uploadAvatar = async (memberId: string, file: File) => {
    try {
      const member = members.find(m => m.id === memberId);
      if (!member) throw new Error('Member not found');

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${memberId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Delete old avatar if exists
      if (member.avatar_url) {
        const oldPath = member.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`avatars/${oldPath}`]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update member with avatar URL
      await updateMember(memberId, { avatar_url: publicUrl });

      return publicUrl;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to upload avatar');
    }
  };

  const removeAvatar = async (memberId: string) => {
    try {
      const member = members.find(m => m.id === memberId);
      if (!member) throw new Error('Member not found');

      // Delete avatar from storage if exists
      if (member.avatar_url) {
        const fileName = member.avatar_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('avatars').remove([`avatars/${fileName}`]);
        }
      }

      // Update member to remove avatar URL
      await updateMember(memberId, { avatar_url: null });
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove avatar');
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
    uploadAvatar,
    removeAvatar,
  };
}
