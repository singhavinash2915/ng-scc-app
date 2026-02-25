import { useState, useMemo, useRef } from 'react';
import { Search, Plus, User, Phone, Mail, IndianRupee, MoreVertical, Edit, Trash2, Camera, X, MessageCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { WhatsAppRemindersModal } from '../components/WhatsAppRemindersModal';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useMemberActivity } from '../hooks/useMemberActivity';
import { useAuth } from '../context/AuthContext';
import type { Member } from '../types';

export function Members() {
  const { members, loading, addMember, updateMember, deleteMember, addFunds, uploadAvatar, removeAvatar } = useMembers();
  const { matches } = useMatches();
  const { isActive } = useMemberActivity(members, matches);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'low' | 'critical'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthday: '',
    status: 'active' as 'active' | 'inactive',
    balance: 0,
  });

  const [fundAmount, setFundAmount] = useState('');
  const [fundDescription, setFundDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearch = member.name.toLowerCase().includes(search.toLowerCase()) ||
        member.phone?.toLowerCase().includes(search.toLowerCase()) ||
        member.email?.toLowerCase().includes(search.toLowerCase());

      // Status filter: based on computed active status (played in last 10 matches)
      const memberIsActive = isActive(member.id);
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && memberIsActive) ||
        (statusFilter === 'inactive' && !memberIsActive);

      // Balance filter: 'low' = < 1000, 'critical' = < 500
      let matchesBalance = true;
      if (balanceFilter === 'low') {
        matchesBalance = member.balance < 1000;
      } else if (balanceFilter === 'critical') {
        matchesBalance = member.balance < 500;
      }

      return matchesSearch && matchesStatus && matchesBalance;
    });
  }, [members, search, statusFilter, balanceFilter, isActive]);

  // Count members with low/critical balance for filter badges (active members only)
  const lowBalanceCount = useMemo(() => {
    return members.filter(m => isActive(m.id) && m.balance < 1000 && m.balance >= 500).length;
  }, [members, isActive]);

  const criticalBalanceCount = useMemo(() => {
    return members.filter(m => isActive(m.id) && m.balance < 500).length;
  }, [members, isActive]);

  const lowBalanceMembers = useMemo(() => {
    return members.filter(m => isActive(m.id) && m.balance < 500);
  }, [members, isActive]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSubmitting(true);
    try {
      await addMember({
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        birthday: formData.birthday || null,
        status: 'active', // Initial status - will be computed based on match participation
        balance: formData.balance,
        join_date: new Date().toISOString().split('T')[0],
        avatar_url: null,
      });
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', birthday: '', status: 'active', balance: 0 });
    } catch (error) {
      console.error('Failed to add member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedMember) return;

    setIsSubmitting(true);
    try {
      await updateMember(selectedMember.id, {
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        birthday: formData.birthday || null,
      });
      setShowEditModal(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Failed to update member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this member?')) {
      try {
        await deleteMember(id);
      } catch (error) {
        console.error('Failed to delete member:', error);
      }
    }
    setMenuOpen(null);
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedMember) return;

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      await addFunds(selectedMember.id, amount, fundDescription || 'Fund deposit');
      setShowFundModal(false);
      setSelectedMember(null);
      setFundAmount('');
      setFundDescription('');
    } catch (error) {
      console.error('Failed to add funds:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (member: Member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      phone: member.phone || '',
      email: member.email || '',
      birthday: member.birthday || '',
      status: member.status,
      balance: member.balance,
    });
    setShowEditModal(true);
    setMenuOpen(null);
  };

  const openFundModal = (member: Member) => {
    setSelectedMember(member);
    setShowFundModal(true);
    setMenuOpen(null);
  };

  const openAvatarModal = (member: Member) => {
    setSelectedMember(member);
    setShowAvatarModal(true);
    setMenuOpen(null);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedMember || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setAvatarUploading(true);
    try {
      await uploadAvatar(selectedMember.id, file);
      setShowAvatarModal(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!selectedMember) return;

    if (!window.confirm('Remove this photo?')) return;

    setAvatarUploading(true);
    try {
      await removeAvatar(selectedMember.id);
      setShowAvatarModal(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Failed to remove avatar:', error);
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Members" subtitle={`${members.length} total members`} />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="input w-full sm:w-40"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {isAdmin && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            )}
          </div>

          {/* Balance Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setBalanceFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                balanceFilter === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All Balances
            </button>
            <button
              onClick={() => setBalanceFilter('low')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                balanceFilter === 'low'
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50'
              }`}
            >
              <span>Low Balance (&lt;₹1000)</span>
              {(lowBalanceCount + criticalBalanceCount) > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  balanceFilter === 'low' ? 'bg-white/20' : 'bg-orange-500 text-white'
                }`}>
                  {lowBalanceCount + criticalBalanceCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setBalanceFilter('critical')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                balanceFilter === 'critical'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
              }`}
            >
              <span>Critical (&lt;₹500)</span>
              {criticalBalanceCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  balanceFilter === 'critical' ? 'bg-white/20' : 'bg-red-500 text-white'
                }`}>
                  {criticalBalanceCount}
                </span>
              )}
            </button>
            {isAdmin && (balanceFilter === 'low' || balanceFilter === 'critical') && lowBalanceMembers.length > 0 && (
              <Button
                size="sm"
                onClick={() => setShowWhatsAppModal(true)}
                className="!bg-green-600 hover:!bg-green-700 !text-white"
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                WhatsApp Reminders
              </Button>
            )}
          </div>
        </div>

        {/* Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map(member => (
            <Card key={member.id} className="relative">
              <CardContent className="p-6">
                {isAdmin && (
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                    {menuOpen === member.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                        <button
                          onClick={() => openEditModal(member)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" /> Edit Member
                        </button>
                        <button
                          onClick={() => openFundModal(member)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <IndianRupee className="w-4 h-4" /> Add Funds
                        </button>
                        <button
                          onClick={() => openAvatarModal(member)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Camera className="w-4 h-4" /> {member.avatar_url ? 'Change Photo' : 'Add Photo'}
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 mb-4">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-primary-200 dark:border-primary-800"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                      <User className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                    <Badge variant={isActive(member.id) ? 'success' : 'default'} size="sm">
                      {isActive(member.id) ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {member.phone && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                  {member.email && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Balance</p>
                    <p className={`text-lg font-bold ${
                      member.balance < 500
                        ? 'text-red-600 dark:text-red-400'
                        : member.balance < 1000
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-green-600 dark:text-green-400'
                    }`}>
                      ₹{member.balance.toLocaleString('en-IN')}
                    </p>
                    {member.balance < 500 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
                        Critical
                      </span>
                    )}
                    {member.balance >= 500 && member.balance < 1000 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">
                        Low
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Matches</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{member.matches_played}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No members found</p>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input
            label="Full Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Phone Number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Birthday"
            type="date"
            value={formData.birthday}
            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
          />
          <Input
            label="Initial Balance (₹)"
            type="number"
            value={formData.balance}
            onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Add Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Member Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Member">
        <form onSubmit={handleEditMember} className="space-y-4">
          <Input
            label="Full Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Phone Number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Birthday"
            type="date"
            value={formData.birthday}
            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Funds Modal */}
      <Modal isOpen={showFundModal} onClose={() => setShowFundModal(false)} title="Add Funds">
        <form onSubmit={handleAddFunds} className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500">Adding funds for</p>
            <p className="font-semibold text-gray-900 dark:text-white">{selectedMember?.name}</p>
            <p className="text-sm text-gray-500">
              Current balance: <span className="font-medium">₹{selectedMember?.balance.toLocaleString('en-IN')}</span>
            </p>
          </div>
          <Input
            label="Amount (₹) *"
            type="number"
            min="1"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            required
          />
          <Input
            label="Description"
            placeholder="e.g., Monthly contribution"
            value={fundDescription}
            onChange={(e) => setFundDescription(e.target.value)}
          />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowFundModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Add Funds
            </Button>
          </div>
        </form>
      </Modal>

      {/* Avatar Upload Modal */}
      <Modal isOpen={showAvatarModal} onClose={() => setShowAvatarModal(false)} title="Member Photo">
        <div className="space-y-6">
          {/* Current Avatar Preview */}
          <div className="flex flex-col items-center">
            {selectedMember?.avatar_url ? (
              <img
                src={selectedMember.avatar_url}
                alt={selectedMember.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-primary-200 dark:border-primary-800 shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center border-4 border-primary-200 dark:border-primary-800">
                <User className="w-16 h-16 text-primary-600 dark:text-primary-400" />
              </div>
            )}
            <p className="mt-3 font-semibold text-gray-900 dark:text-white text-lg">{selectedMember?.name}</p>
          </div>

          {/* Upload Area */}
          <div className="space-y-3">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
              id="avatar-upload"
            />
            <label
              htmlFor="avatar-upload"
              className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-800/50"
            >
              {avatarUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  <span className="text-sm text-gray-500">Uploading...</span>
                </div>
              ) : (
                <>
                  <Camera className="w-10 h-10 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Click to upload photo
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    JPG, PNG, GIF up to 5MB
                  </span>
                </>
              )}
            </label>
          </div>

          {/* Remove Photo Button */}
          {selectedMember?.avatar_url && (
            <Button
              type="button"
              variant="danger"
              onClick={handleRemoveAvatar}
              loading={avatarUploading}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Remove Photo
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAvatarModal(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* WhatsApp Reminders Modal */}
      <WhatsAppRemindersModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        members={lowBalanceMembers}
      />
    </div>
  );
}
