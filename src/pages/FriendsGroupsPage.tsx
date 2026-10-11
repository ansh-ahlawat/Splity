import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Plus,
  UserPlus,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ShieldCheck,
  Share2,
  X,
  Phone,
  Trash2,
  Search,
  Check,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '../api/httpClient.js';
import { ModalContainer } from '../components/ModalContainer.js';

interface Friend {
  id: string;
  name: string;
  phone?: string;
  createdAt: string;
}

interface FriendGroup {
  id: string;
  name: string;
  description?: string;
  members: string[];
  createdAt: string;
}

interface FriendDebt {
  id: string;
  friendName: string;
  amount: number;
  type: 'YOU_OWE' | 'OWED_TO_YOU';
  description: string;
  settled: boolean;
  date: string;
  groupId?: string | null;
  groupName?: string | null;
  friendPhone?: string | null;
}

export const FriendsGroupsPage: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [debts, setDebts] = useState<FriendDebt[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [debtFriendName, setDebtFriendName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtType, setDebtType] = useState<'YOU_OWE' | 'OWED_TO_YOU'>('OWED_TO_YOU');
  const [debtDesc, setDebtDesc] = useState('');

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('+91 ');

  const handleFriendPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const afterPrefix = raw.replace(/^(\+91|\+9|\+)?\s*/, '');
    const digits = afterPrefix.replace(/\D/g, '').slice(0, 10);
    setFriendPhone(digits ? `+91 ${digits}` : '+91 ');
  };

  const handleFriendPhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    if (
      (e.key === 'Backspace' && target.selectionStart !== null && target.selectionStart <= 4 && target.selectionEnd === target.selectionStart) ||
      (e.key === 'Delete' && target.selectionStart !== null && target.selectionStart < 4)
    ) {
      e.preventDefault();
    }
  };

  const handleKeepCursorRight = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    if (target.selectionStart !== null && target.selectionStart < 4) {
      target.setSelectionRange(4, 4);
    }
  };

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [showAllFriendsModal, setShowAllFriendsModal] = useState(false);
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');
  const [showAllGroupsModal, setShowAllGroupsModal] = useState(false);
  const [groupsSearchQuery, setGroupsSearchQuery] = useState('');

  // Selected details modal state
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<FriendGroup | null>(null);
  const [selectedFriendDetail, setSelectedFriendDetail] = useState<Friend | null>(null);
  const [debtGroupId, setDebtGroupId] = useState('');
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'YOU_OWE' | 'OWED_TO_YOU'>('ALL');

  const handleDeleteFriend = async (friendId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from your friends?`)) return;
    try {
      await apiRequest(`/api/friends/${friendId}`, { method: 'DELETE' });
      fetchFriends();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to delete friend', err);
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchGroups();
    fetchDebts();
  }, []);

  const fetchFriends = async () => {
    try {
      const fRes = await apiRequest<Friend[]>('/api/friends');
      setFriends(fRes || []);
    } catch (err) {
      console.error('Failed to load friends', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const gRes = await apiRequest<FriendGroup[]>('/api/friend-groups');
      setGroups(gRes || []);
    } catch (err) {
      console.error('Failed to load groups', err);
    }
  };

  const fetchDebts = async () => {
    try {
      const dRes = await apiRequest<FriendDebt[]>('/api/debts');
      setDebts(dRes || []);
    } catch (err) {
      console.error('Failed to load debts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLogSplitForGroup = (group: FriendGroup) => {
    setDebtGroupId(group.id);
    setDebtFriendName(group.members[0] || '');
    setShowAddDebt(true);
  };

  const handleOpenLogSplitForFriend = (friend: Friend) => {
    setDebtGroupId('');
    setDebtFriendName(friend.name);
    setShowAddDebt(true);
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtFriendName || !debtAmount) return;

    try {
      await apiRequest('/api/debts', {
        method: 'POST',
        body: JSON.stringify({
          friendName: debtFriendName,
          amount: Number(debtAmount),
          type: debtType,
          description: debtDesc || 'Shared expense',
          groupId: debtGroupId || undefined,
        }),
      });

      setShowAddDebt(false);
      setDebtFriendName('');
      setDebtAmount('');
      setDebtDesc('');
      setDebtGroupId('');
      fetchDebts();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to create debt', err);
    }
  };

  const handleCreateFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = friendPhone.replace(/^(\+91|\+)?\s*/, '').replace(/\D/g, '');
    if (!friendName || !digits || digits.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      const formattedPhone = `+91 ${digits}`;
      await apiRequest('/api/friends', {
        method: 'POST',
        body: JSON.stringify({ name: friendName, phone: formattedPhone }),
      });

      setShowAddFriend(false);
      setFriendName('');
      setFriendPhone('+91 ');
      fetchFriends();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to create friend', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || selectedMembers.length === 0) return;

    try {
      await apiRequest('/api/friend-groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, members: selectedMembers, description: groupDesc }),
      });

      setShowAddGroup(false);
      setGroupName('');
      setGroupDesc('');
      setSelectedMembers([]);
      fetchGroups();
    } catch (err) {
      console.error('Failed to create group', err);
    }
  };

  const handleSettleDebt = async (debtId: string) => {
    try {
      setDebts((prev) => prev.map((d) => (d.id === debtId ? { ...d, settled: true } : d)));
      await apiRequest(`/api/debts/${debtId}/settle`, { method: 'POST' });
      fetchDebts();
      window.dispatchEvent(new CustomEvent('splity:refresh'));
    } catch (err) {
      console.error('Failed to settle debt', err);
      fetchDebts();
    }
  };

  const activeDebts = debts.filter((d) => !d.settled);
  const totalYouOwe = activeDebts.filter((d) => d.type === 'YOU_OWE').reduce((acc, d) => acc + d.amount, 0);
  const totalOwedToYou = activeDebts.filter((d) => d.type === 'OWED_TO_YOU').reduce((acc, d) => acc + d.amount, 0);
  const netPosition = totalOwedToYou - totalYouOwe;
  const displayedActiveDebts = debtFilter === 'ALL'
    ? activeDebts
    : activeDebts.filter((d) => d.type === debtFilter);

  // Group details computed data
  const groupDebts = selectedGroupDetail
    ? debts.filter(
        (d) =>
          d.groupId === selectedGroupDetail.id ||
          (d.groupName && d.groupName.toLowerCase() === selectedGroupDetail.name.toLowerCase())
      )
    : [];
  const activeGroupDebts = groupDebts.filter((d) => !d.settled);
  const groupYouOwe = activeGroupDebts
    .filter((d) => d.type === 'YOU_OWE')
    .reduce((acc, d) => acc + d.amount, 0);
  const groupOwedToYou = activeGroupDebts
    .filter((d) => d.type === 'OWED_TO_YOU')
    .reduce((acc, d) => acc + d.amount, 0);
  const groupNet = groupOwedToYou - groupYouOwe;

  // Friend details computed data
  const friendDebts = selectedFriendDetail
    ? debts.filter(
        (d) =>
          d.friendName.toLowerCase() === selectedFriendDetail.name.toLowerCase() ||
          (d.friendPhone &&
            selectedFriendDetail.phone &&
            d.friendPhone.replace(/\D/g, '') === selectedFriendDetail.phone.replace(/\D/g, ''))
      )
    : [];
  const activeFriendDebts = friendDebts.filter((d) => !d.settled);
  const friendYouOwe = activeFriendDebts
    .filter((d) => d.type === 'YOU_OWE')
    .reduce((acc, d) => acc + d.amount, 0);
  const friendOwedToYou = activeFriendDebts
    .filter((d) => d.type === 'OWED_TO_YOU')
    .reduce((acc, d) => acc + d.amount, 0);
  const friendNet = friendOwedToYou - friendYouOwe;
  const sharedGroupsWithFriend = selectedFriendDetail
    ? groups.filter((g) =>
        g.members.some((m) => m.toLowerCase() === selectedFriendDetail.name.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header with action buttons placed little more above in front of title */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
            Friends & Split Hub
          </h1>
          <p className="text-xs sm:text-[13px] text-gray-500 font-light mt-0.5 tracking-tight">
            Manage peer debts, shared dining bills, and settlement records.
          </p>
        </div>

        {/* Action Buttons: Add Friend, New Group, Split Expense - Positioned higher up in line with top of header */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap overflow-x-auto no-scrollbar -mt-1 sm:-mt-2 pt-0.5">
          <button
            type="button"
            onClick={() => {
              setFriendPhone('+91 ');
              setShowAddFriend(true);
            }}
            className="btn-secondary whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 text-green-700" />
            <span>Add Friend</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddGroup(true)}
            className="btn-secondary whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-green-700" />
            <span>New Group</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddDebt(true)}
            className="btn-primary whitespace-nowrap hover:transform-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Split Expense</span>
          </button>
        </div>
      </div>

      {/* Layout with enhanced spacing between left portion and right ratio portion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left portion: Balance Cards, Action Buttons, Active Balances */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: You Owe (Payable) */}
            <div
              onClick={() => setDebtFilter((prev) => (prev === 'YOU_OWE' ? 'ALL' : 'YOU_OWE'))}
              className={`card-base p-4 flex flex-col justify-between space-y-2 cursor-pointer transition-all relative select-none ${
                debtFilter === 'YOU_OWE'
                  ? 'border-2 border-red-500 bg-red-50/25 shadow-sm'
                  : 'border border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between -mr-1 -mt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1.5 pl-0.5">
                  You Owe (Payable)
                </span>
                <div className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center bg-red-50 text-red-600 shrink-0">
                  <ArrowUpRight className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-mono-num font-bold text-red-600 tracking-tight">₹{totalYouOwe.toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {debtFilter === 'YOU_OWE' ? 'Filtered: click to reset' : 'Total pending paybacks'}
                </p>
              </div>
            </div>

            {/* Card 2: Owed To You */}
            <div
              onClick={() => setDebtFilter((prev) => (prev === 'OWED_TO_YOU' ? 'ALL' : 'OWED_TO_YOU'))}
              className={`card-base p-4 flex flex-col justify-between space-y-2 cursor-pointer transition-all relative select-none ${
                debtFilter === 'OWED_TO_YOU'
                  ? 'border-2 border-[#166534] bg-green-50/25 shadow-sm'
                  : 'border border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between -mr-1 -mt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1.5 pl-0.5">
                  Owed To You
                </span>
                <div className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center bg-[#edf4ed] text-green-800 shrink-0">
                  <ArrowDownLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-mono-num font-bold text-green-700 tracking-tight">₹{totalOwedToYou.toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {debtFilter === 'OWED_TO_YOU' ? 'Filtered: click to reset' : 'Receivable from peers'}
                </p>
              </div>
            </div>

            {/* Card 3: Net Position */}
            <div
              onClick={() => setDebtFilter('ALL')}
              className={`card-base p-4 flex flex-col justify-between space-y-2 cursor-pointer transition-all select-none ${
                debtFilter === 'ALL' ? 'hover:border-gray-300' : 'hover:border-gray-300 opacity-90'
              }`}
              title="Click to reset filters and view all"
            >
              <div className="flex items-start justify-between -mr-1 -mt-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pt-1.5 pl-0.5">
                  Net Position
                </span>
                <div className="w-9 h-9 sm:w-9.5 sm:h-9.5 rounded-full flex items-center justify-center bg-[#edf4ed] text-green-800 shrink-0">
                  <Wallet className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={1.5} />
                </div>
              </div>
              <div>
                <p className={`text-2xl font-mono-num font-bold tracking-tight ${netPosition >= 0 ? 'text-gray-950' : 'text-red-600'}`}>
                  {netPosition >= 0 ? '+' : '-'}₹{Math.abs(netPosition).toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {debtFilter !== 'ALL' ? 'Click to show all balances' : netPosition >= 0 ? 'Overall net positive balance' : 'Net liabilities to settle'}
                </p>
              </div>
            </div>
          </div>

          {/* Active Balances Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Active Balances</h3>
                <span className="text-[11px] font-mono-num text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {displayedActiveDebts.length}
                </span>
                {debtFilter !== 'ALL' && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    debtFilter === 'YOU_OWE'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-green-50 text-green-800 border-green-200'
                  }`}>
                    Filtered: {debtFilter === 'YOU_OWE' ? 'You Owe' : 'Owed To You'}
                  </span>
                )}
              </div>
              {debtFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setDebtFilter('ALL')}
                  className="text-xs text-green-700 hover:text-green-800 font-medium cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>
            {displayedActiveDebts.length === 0 ? (
              <div className="card-base p-8 text-center max-w-md mx-auto space-y-2.5 mt-4 select-none rounded-[24px] border border-[#edf2ee]">
                <div className="w-11 h-11 rounded-2xl bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] flex items-center justify-center mx-auto mb-1.5 shadow-none">
                  <ShieldCheck className="w-5 h-5 text-[#166534]" />
                </div>
                <h2 className="text-sm font-semibold text-gray-950 tracking-tight">
                  {debtFilter === 'ALL' ? 'All settled — zero dues' : `No ${debtFilter === 'YOU_OWE' ? 'payable' : 'receivable'} dues`}
                </h2>
                <p className="text-xs text-gray-400 font-light leading-relaxed">
                  {debtFilter === 'ALL'
                    ? friends.length > 0
                      ? `Zero pending dues across all ${friends.length} friend${friends.length === 1 ? '' : 's'}. All accounts balanced!`
                      : 'Zero pending dues. Add friends or record shared expenses to track splits.'
                    : 'No split balances match the selected filter. Click "Clear filter" to view all.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedActiveDebts.map((debt) => (
                  <div
                    key={debt.id}
                    className="card-base p-4 space-y-3 flex flex-col justify-between rounded-[22px]"
                  >
                    <div className="flex items-start justify-between -mt-1">
                      <div>
                        <span
                          className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            debt.type === 'YOU_OWE'
                              ? 'bg-red-500/10 text-red-700 border-red-500/20'
                              : 'bg-green-500/10 text-green-700 border-green-500/20'
                          }`}
                        >
                          {debt.type === 'YOU_OWE' ? 'You owe' : 'Owes you'}
                        </span>
                        <h4 className="text-sm font-semibold text-gray-950 mt-2">{debt.friendName}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{debt.description}</p>
                      </div>
                      <div className="text-right -mt-0.5">
                        <p
                          className={`text-lg font-mono-num font-semibold ${
                            debt.type === 'YOU_OWE' ? 'text-red-600' : 'text-green-700'
                          }`}
                        >
                          ₹{debt.amount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono-num mt-0.5">{debt.date}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-gray-100">
                      {debt.friendPhone ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono-num">
                          <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{debt.friendPhone}</span>
                        </div>
                      ) : (
                        <div />
                      )}
                      <button
                        onClick={() => handleSettleDebt(debt.id)}
                        className="btn-primary flex-1 sm:flex-initial text-xs py-1.5 px-3.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Settled</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right ratio portion: Friends and Groups with generous vertical separation */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-8 sm:space-y-10">
          {/* Friends Section: Single container with accounts separated by lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Friends Directory</h3>
                <span className="text-[11px] font-mono-num text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {friends.length}
                </span>
              </div>
              {friends.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllFriendsModal(true)}
                  className="text-xs text-green-700 hover:text-green-800 font-medium cursor-pointer"
                >
                  See All
                </button>
              )}
            </div>

            {/* Single container for friends separated by lines (max 3 displayed) */}
            <div className="card-base overflow-hidden rounded-[24px] border border-[#edf2ee] bg-white shadow-none divide-y divide-[#edf2ee]">
              {friends.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No friends added yet. Click &ldquo;Add Friend&rdquo; above.
                </div>
              ) : (
                friends.slice(0, 3).map((friend) => (
                  <div
                    key={friend.id}
                    onClick={() => setSelectedFriendDetail(friend)}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/70 transition-colors cursor-pointer group/row"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] font-semibold text-xs select-none">
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-gray-900 group-hover/row:text-[#166534] transition-colors truncate">{friend.name}</h4>
                        <p className="text-[11px] font-mono-num text-gray-400 truncate">{friend.phone || '+91'}</p>
                      </div>
                    </div>
                    {/* Delete friend button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFriend(friend.id, friend.name);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      title={`Remove ${friend.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Groups Section: Single container with groups separated by lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Shared Groups</h3>
                <span className="text-[11px] font-mono-num text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {groups.length}
                </span>
              </div>
              {groups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllGroupsModal(true)}
                  className="text-xs text-green-700 hover:text-green-800 font-medium cursor-pointer"
                >
                  See All
                </button>
              )}
            </div>

            {/* Single container for groups separated by lines (max 3 displayed) */}
            <div className="card-base overflow-hidden rounded-[24px] border border-[#edf2ee] bg-white shadow-none divide-y divide-[#edf2ee]">
              {groups.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No groups created yet. Click &ldquo;New Group&rdquo; above.
                </div>
              ) : (
                groups.slice(0, 3).map((group) => (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupDetail(group)}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/70 transition-colors cursor-pointer group/row"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] select-none">
                        <Users className="w-3.5 h-3.5 text-[#166534]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-gray-900 group-hover/row:text-[#166534] transition-colors truncate">{group.name}</h4>
                        <p className="text-[11px] text-gray-500 truncate">{group.description || 'Shared bills'}</p>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-gray-500 bg-gray-100/80 px-2.5 py-0.5 rounded-full shrink-0">
                      {group.members.length} members
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Modal: Log Split / Debt */}
      <ModalContainer
        isOpen={showAddDebt}
        onClose={() => {
          setShowAddDebt(false);
          setDebtGroupId('');
        }}
        title="Log Split / Debt"
        subtitle="Record peer spending, bill splits, or informal liabilities"
      >
        <form onSubmit={handleCreateDebt} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700 block">Friend Name</label>
                {debtFriendName && (
                  <button
                    type="button"
                    onClick={() => setDebtFriendName('')}
                    className="text-[11px] text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={debtFriendName}
                onChange={(e) => setDebtFriendName(e.target.value)}
                placeholder="Type name or select from suggestions below..."
                className="input-base w-full font-light"
              />

              {/* Suggested options: if friend exists user can select directly */}
              {friends.length > 0 && (
                <div className="pt-1.5">
                  <span className="text-[11px] font-light text-gray-400 block mb-1.5">
                    Suggested Friends:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                    {friends.map((f) => {
                      const isSelected = debtFriendName.trim().toLowerCase() === f.name.trim().toLowerCase();
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setDebtFriendName(f.name)}
                          className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[rgba(22,101,52,0.08)] border-[rgba(22,101,52,0.25)] text-[#166534] font-medium'
                              : 'bg-white border-[#edf2ee] hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="font-light">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-gray-700 block">Direction</label>
                {/* Clickable Direction Toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDebtType('OWED_TO_YOU')}
                    className={`h-10 px-4 rounded-full text-xs transition-all cursor-pointer border flex-1 ${
                      debtType === 'OWED_TO_YOU'
                        ? 'bg-[rgba(22,101,52,0.08)] border-[rgba(22,101,52,0.25)] text-[#166534] font-medium'
                        : 'bg-white border-[#edf2ee] hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Friend owes me
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtType('YOU_OWE')}
                    className={`h-10 px-4 rounded-full text-xs transition-all cursor-pointer border flex-1 ${
                      debtType === 'YOU_OWE'
                        ? 'bg-[rgba(22,101,52,0.08)] border-[rgba(22,101,52,0.25)] text-[#166534] font-medium'
                        : 'bg-white border-[#edf2ee] hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    I owe friend
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 block">Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-base w-full font-mono-num font-light"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-xs font-medium text-gray-700 block">Description / Memo</label>
                <input
                  type="text"
                  value={debtDesc}
                  onChange={(e) => setDebtDesc(e.target.value)}
                  placeholder="Dinner, Uber share..."
                  className="input-base w-full font-light"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-xs font-medium text-gray-700 block">Shared Group (Optional)</label>
                <select
                  value={debtGroupId}
                  onChange={(e) => setDebtGroupId(e.target.value)}
                  className="input-base w-full font-light text-xs"
                >
                  <option value="">Direct Peer Split (No Group)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#edf2ee]">
            <button
              type="button"
              onClick={() => setShowAddDebt(false)}
              className="btn-secondary px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-5 py-2"
            >
              Record Split
            </button>
          </div>
        </form>
      </ModalContainer>

      {/* Modal: Add Friend */}
      <ModalContainer
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        title="Add New Friend"
        subtitle="Save friend details to log shared bills and split balances"
      >
        <form onSubmit={handleCreateFriend} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 block">Friend Name</label>
              <input
                type="text"
                required
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="input-base w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 block">Mobile Number (+91)</label>
              <input
                type="text"
                required
                value={friendPhone}
                onChange={handleFriendPhoneChange}
                onKeyDown={handleFriendPhoneKeyDown}
                onClick={handleKeepCursorRight}
                onFocus={handleKeepCursorRight}
                onKeyUp={handleKeepCursorRight}
                placeholder="+91 98765 43210"
                className="input-base w-full font-mono-num font-light"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#edf2ee]">
            <button
              type="button"
              onClick={() => setShowAddFriend(false)}
              className="btn-secondary px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-5 py-2"
            >
              Save Friend
            </button>
          </div>
        </form>
      </ModalContainer>

      {/* Modal: New Group */}
      <ModalContainer
        isOpen={showAddGroup}
        onClose={() => setShowAddGroup(false)}
        title="Create Shared Group"
        subtitle="Group friends for shared trips, apartment rent, or dining outings"
        maxHeightClass="max-h-[92vh] sm:max-h-[640px]"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 block">Group Name</label>
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Flatmates, Goa Trip"
                className="input-base w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 block">Description</label>
              <input
                type="text"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="Shared groceries, rent, etc."
                className="input-base w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700 block">
                Select Members {selectedMembers.length > 0 && `(${selectedMembers.length} selected)`}
              </label>
              {selectedMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMembers([])}
                  className="text-[11px] text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Clear selection
                </button>
              )}
            </div>

            {/* Member search bar with visible icon and clear spacing */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                value={groupMemberSearch}
                onChange={(e) => setGroupMemberSearch(e.target.value)}
                placeholder="Search friends by name or mobile number..."
                className="input-base has-left-icon !pl-11 w-full py-1.5 text-xs font-light"
              />
            </div>

            {/* 2-column grid of members with colored light-themed selection (no checkbox) */}
            <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-0.5">
              {friends.length === 0 ? (
                <div className="p-5 text-center text-xs text-gray-400 border border-[#edf2ee] rounded-2xl bg-white">
                  No friends added yet. Add friends first.
                </div>
              ) : friends.filter((f) =>
                  f.name.toLowerCase().includes(groupMemberSearch.toLowerCase()) ||
                  (f.phone && f.phone.includes(groupMemberSearch))
                ).length === 0 ? (
                <div className="p-5 text-center text-xs text-gray-400 border border-[#edf2ee] rounded-2xl bg-white">
                  No friends found matching &ldquo;{groupMemberSearch}&rdquo;.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {friends
                    .filter((f) =>
                      f.name.toLowerCase().includes(groupMemberSearch.toLowerCase()) ||
                      (f.phone && f.phone.includes(groupMemberSearch))
                    )
                    .map((f) => {
                      const isSelected = selectedMembers.includes(f.name);
                      return (
                        <div
                          key={f.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMembers(selectedMembers.filter((m) => m !== f.name));
                            } else {
                              setSelectedMembers([...selectedMembers, f.name]);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-[rgba(22,101,52,0.08)] border-[rgba(22,101,52,0.25)] text-[#166534] shadow-none'
                              : 'bg-white border-[#edf2ee] hover:border-gray-300 hover:bg-gray-50/70 text-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] select-none"
                            >
                              {f.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate leading-tight">{f.name}</div>
                              {f.phone && (
                                <div className="text-[10px] font-mono-num text-gray-400 truncate mt-0.5">
                                  {f.phone}
                                </div>
                              )}
                            </div>
                          </div>

                          {isSelected ? (
                            <span className="text-[10px] font-semibold bg-[rgba(22,101,52,0.12)] border border-[rgba(22,101,52,0.2)] text-[#166534] px-2.5 py-0.5 rounded-full shrink-0">
                              Selected
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-light px-2 py-0.5 rounded-full border border-gray-200 shrink-0">
                              Add
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#edf2ee]">
            <button
              type="button"
              onClick={() => setShowAddGroup(false)}
              className="btn-secondary px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedMembers.length === 0}
              className="btn-primary px-5 py-2"
            >
              Create Group
            </button>
          </div>
        </form>
      </ModalContainer>

      {/* Modal: Full Friends Directory (See All) */}
      <ModalContainer
        isOpen={showAllFriendsModal}
        onClose={() => {
          setShowAllFriendsModal(false);
          setFriendsSearchQuery('');
        }}
        title={`All Friends (${friends.length})`}
        subtitle="Manage peer contact cards and split connections"
        headerRight={
          <button
            type="button"
            onClick={() => {
              setShowAllFriendsModal(false);
              setShowAddFriend(true);
            }}
            className="btn-primary text-xs py-1.5 px-3"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Friend</span>
          </button>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={friendsSearchQuery}
              onChange={(e) => setFriendsSearchQuery(e.target.value)}
              placeholder="Search friends by name or phone..."
              className="input-base has-left-icon !pl-11 w-full font-light"
            />
          </div>

          {/* Single container for all friends separated by lines */}
          <div className="card-base overflow-hidden rounded-[24px] border border-[#edf2ee] bg-white divide-y divide-[#edf2ee]">
            {friends
              .filter(
                (f) =>
                  !friendsSearchQuery ||
                  f.name.toLowerCase().includes(friendsSearchQuery.toLowerCase()) ||
                  (f.phone && f.phone.includes(friendsSearchQuery))
              )
              .map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => {
                    setShowAllFriendsModal(false);
                    setSelectedFriendDetail(friend);
                  }}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/70 transition-colors cursor-pointer group/row"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] font-semibold text-xs select-none">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-gray-900 group-hover/row:text-[#166534] transition-colors truncate">{friend.name}</h4>
                      <p className="text-[11px] font-mono-num text-gray-400 truncate">{friend.phone || '+91'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFriend(friend.id, friend.name);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    title={`Remove ${friend.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </ModalContainer>

      {/* Modal: Full Shared Groups Directory (See All) */}
      <ModalContainer
        isOpen={showAllGroupsModal}
        onClose={() => {
          setShowAllGroupsModal(false);
          setGroupsSearchQuery('');
        }}
        title={`All Shared Groups (${groups.length})`}
        subtitle="Manage group shared expenses, trips, and apartment bills"
        headerRight={
          <button
            type="button"
            onClick={() => {
              setShowAllGroupsModal(false);
              setShowAddGroup(true);
            }}
            className="btn-primary text-xs py-1.5 px-3"
          >
            <Users className="w-3.5 h-3.5" />
            <span>New Group</span>
          </button>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={groupsSearchQuery}
              onChange={(e) => setGroupsSearchQuery(e.target.value)}
              placeholder="Search groups by name or memo..."
              className="input-base has-left-icon !pl-11 w-full font-light"
            />
          </div>

          <div className="card-base overflow-hidden rounded-[24px] border border-[#edf2ee] bg-white divide-y divide-[#edf2ee]">
            {groups
              .filter(
                (g) =>
                  !groupsSearchQuery ||
                  g.name.toLowerCase().includes(groupsSearchQuery.toLowerCase()) ||
                  (g.description && g.description.toLowerCase().includes(groupsSearchQuery.toLowerCase()))
              )
              .map((group) => (
                <div
                  key={group.id}
                  onClick={() => {
                    setShowAllGroupsModal(false);
                    setSelectedGroupDetail(group);
                  }}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/70 transition-colors cursor-pointer group/row"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] select-none">
                      <Users className="w-3.5 h-3.5 text-[#166534]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-gray-900 group-hover/row:text-[#166534] transition-colors truncate">{group.name}</h4>
                      <p className="text-[11px] text-gray-500 truncate">{group.description || 'Shared bills'}</p>
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-gray-500 bg-gray-100/80 px-2.5 py-0.5 rounded-full shrink-0">
                    {group.members.length} members
                  </div>
                </div>
              ))}
          </div>
        </div>
      </ModalContainer>

      {/* Modal: Group Details & Shared Ledger */}
      <ModalContainer
        isOpen={Boolean(selectedGroupDetail)}
        onClose={() => setSelectedGroupDetail(null)}
        title={selectedGroupDetail?.name || 'Group Details'}
        subtitle="Group details, all members, and complete shared transactions"
        maxWidthClass="max-w-2xl"
        headerRight={
          selectedGroupDetail && (
            <button
              type="button"
              onClick={() => {
                const grp = selectedGroupDetail;
                setSelectedGroupDetail(null);
                handleOpenLogSplitForGroup(grp);
              }}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Split</span>
            </button>
          )
        }
      >
        {selectedGroupDetail && (
          <div className="space-y-4">
            {/* Description card */}
            <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-[#edf2ee] space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                Group Description
              </span>
              <p className="text-xs text-gray-700 leading-relaxed font-light">
                {selectedGroupDetail.description || 'No description provided for this group.'}
              </p>
              <p className="text-[10px] text-gray-400 font-light pt-0.5">
                Created on {new Date(selectedGroupDetail.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* Financial Ledger Summary for Group */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-white border border-[#edf2ee] shadow-none">
                <span className="text-[10px] uppercase font-semibold text-gray-400 block">You Owe</span>
                <span className="text-sm sm:text-base font-mono-num font-bold text-red-600 mt-1 block">
                  ₹{groupYouOwe.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#edf2ee] shadow-none">
                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Owed to You</span>
                <span className="text-sm sm:text-base font-mono-num font-bold text-green-700 mt-1 block">
                  ₹{groupOwedToYou.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#edf2ee] shadow-none">
                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Net Balance</span>
                <span className={`text-sm sm:text-base font-mono-num font-bold mt-1 block ${groupNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {groupNet >= 0 ? '+' : '-'}₹{Math.abs(groupNet).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Members Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-900 tracking-tight flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#166534]" />
                  <span>All Members ({selectedGroupDetail.members.length})</span>
                </h4>
                <span className="text-[11px] text-gray-400 font-light">Click member to view profile</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5">
                {selectedGroupDetail.members.map((mem, idx) => {
                  const matchedFriend = friends.find((f) => f.name.toLowerCase() === mem.toLowerCase());
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (matchedFriend) {
                          setSelectedGroupDetail(null);
                          setSelectedFriendDetail(matchedFriend);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                        matchedFriend
                          ? 'bg-white border-[#edf2ee] hover:border-gray-300 hover:bg-gray-50/70 cursor-pointer group/mem'
                          : 'bg-white border-[#edf2ee] text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[rgba(22,101,52,0.08)] border border-[rgba(22,101,52,0.14)] text-[#166534] font-semibold text-xs select-none">
                          {mem.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-900 group-hover/mem:text-[#166534] transition-colors truncate leading-tight">
                            {mem}
                          </div>
                          <div className="text-[10px] font-mono-num text-gray-400 truncate">
                            {matchedFriend?.phone || 'Group member'}
                          </div>
                        </div>
                      </div>
                      {matchedFriend && (
                        <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover/mem:text-gray-600 transition-colors shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transactions Section */}
            <div className="space-y-2.5 pt-2 border-t border-[#edf2ee]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-900 tracking-tight">
                  Group Transactions ({groupDebts.length})
                </h4>
                {activeGroupDebts.length > 0 && (
                  <span className="text-[10px] font-mono-num text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                    {activeGroupDebts.length} active dues
                  </span>
                )}
              </div>

              {groupDebts.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-[#edf2ee] rounded-2xl bg-white">
                  No transactions recorded for this group yet. Click &ldquo;Log Split&rdquo; above to record an expense.
                </div>
              ) : (
                <div className="card-base overflow-hidden rounded-[20px] border border-[#edf2ee] bg-white divide-y divide-[#edf2ee] max-h-72 overflow-y-auto">
                  {groupDebts.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-gray-50/70 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              d.type === 'YOU_OWE'
                                ? 'bg-red-500/10 text-red-700 border-red-500/20'
                                : 'bg-green-500/10 text-green-700 border-green-500/20'
                            }`}
                          >
                            {d.type === 'YOU_OWE' ? 'You owe' : 'Owes you'}
                          </span>
                          {d.settled ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                              Settled
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Pending
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 font-mono-num">{d.date}</span>
                        </div>
                        <h5 className="text-xs font-semibold text-gray-900 leading-snug">{d.description}</h5>
                        <p className="text-[11px] text-gray-500">
                          With member: <span className="font-medium text-gray-700">{d.friendName}</span>
                        </p>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-1 sm:pt-0">
                        <span
                          className={`text-sm font-mono-num font-bold ${
                            d.type === 'YOU_OWE' ? 'text-red-600' : 'text-green-700'
                          }`}
                        >
                          ₹{d.amount.toLocaleString('en-IN')}
                        </span>
                        {!d.settled && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSettleDebt(d.id)}
                              className="btn-primary text-[11px] py-1 px-2.5 h-auto rounded-lg"
                            >
                              <Check className="w-3 h-3" />
                              <span>Mark Settled</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </ModalContainer>

      {/* Modal: Friend Details & Ledger */}
      <ModalContainer
        isOpen={Boolean(selectedFriendDetail)}
        onClose={() => setSelectedFriendDetail(null)}
        title={selectedFriendDetail?.name || 'Friend Details'}
        subtitle="Friend details, shared groups, and complete split history"
        maxWidthClass="max-w-2xl"
        headerRight={
          selectedFriendDetail && (
            <button
              type="button"
              onClick={() => {
                const fr = selectedFriendDetail;
                setSelectedFriendDetail(null);
                handleOpenLogSplitForFriend(fr);
              }}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Split</span>
            </button>
          )
        }
      >
        {selectedFriendDetail && (
          <div className="space-y-4">
            {/* Contact & Shared groups card */}
            <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-[#edf2ee] space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-700 font-mono-num font-medium">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>{selectedFriendDetail.phone || 'No phone number saved'}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-light">
                  Added on {new Date(selectedFriendDetail.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              <div className="pt-2 border-t border-[#edf2ee]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Shared Groups ({sharedGroupsWithFriend.length})
                </div>
                {sharedGroupsWithFriend.length === 0 ? (
                  <p className="text-xs text-gray-400 font-light">Not part of any shared groups yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sharedGroupsWithFriend.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedFriendDetail(null);
                          setSelectedGroupDetail(g);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-[#edf2ee] hover:border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        title={`Open ${g.name} details`}
                      >
                        <Users className="w-3 h-3 text-[#166534]" />
                        <span>{g.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Financial Ledger Summary for Friend */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-white border border-[#edf2ee] shadow-none">
                <span className="text-[10px] uppercase font-semibold text-gray-400 block">You Owe</span>
                <span className="text-sm sm:text-base font-mono-num font-bold text-red-600 mt-1 block">
                  ₹{friendYouOwe.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#edf2ee] shadow-none">
                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Owed to You</span>
                <span className="text-sm sm:text-base font-mono-num font-bold text-green-700 mt-1 block">
                  ₹{friendOwedToYou.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#edf2ee] shadow-none">
                <span className="text-[10px] uppercase font-semibold text-gray-400 block">Net Position</span>
                <span className={`text-sm sm:text-base font-mono-num font-bold mt-1 block ${friendNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {friendNet >= 0 ? '+' : '-'}₹{Math.abs(friendNet).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Transactions Section */}
            <div className="space-y-2.5 pt-2 border-t border-[#edf2ee]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-900 tracking-tight">
                  All Transactions with {selectedFriendDetail.name} ({friendDebts.length})
                </h4>
                {activeFriendDebts.length > 0 && (
                  <span className="text-[10px] font-mono-num text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                    {activeFriendDebts.length} active dues
                  </span>
                )}
              </div>

              {friendDebts.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 border border-[#edf2ee] rounded-2xl bg-white">
                  No transactions recorded with {selectedFriendDetail.name} yet. Click &ldquo;Log Split&rdquo; above to record an expense.
                </div>
              ) : (
                <div className="card-base overflow-hidden rounded-[20px] border border-[#edf2ee] bg-white divide-y divide-[#edf2ee] max-h-72 overflow-y-auto">
                  {friendDebts.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-gray-50/70 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              d.type === 'YOU_OWE'
                                ? 'bg-red-500/10 text-red-700 border-red-500/20'
                                : 'bg-green-500/10 text-green-700 border-green-500/20'
                            }`}
                          >
                            {d.type === 'YOU_OWE' ? 'You owe' : 'Owes you'}
                          </span>
                          {d.settled ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                              Settled
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Pending
                            </span>
                          )}
                          {d.groupName && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                              {d.groupName}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 font-mono-num">{d.date}</span>
                        </div>
                        <h5 className="text-xs font-semibold text-gray-900 leading-snug">{d.description}</h5>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-1 sm:pt-0">
                        <span
                          className={`text-sm font-mono-num font-bold ${
                            d.type === 'YOU_OWE' ? 'text-red-600' : 'text-green-700'
                          }`}
                        >
                          ₹{d.amount.toLocaleString('en-IN')}
                        </span>
                        {!d.settled && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSettleDebt(d.id)}
                              className="btn-primary text-[11px] py-1 px-2.5 h-auto rounded-lg"
                            >
                              <Check className="w-3 h-3" />
                              <span>Mark Settled</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </ModalContainer>
    </div>
  );
};
