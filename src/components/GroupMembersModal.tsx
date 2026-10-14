import React, { useState } from 'react';
import { X, Users, Copy, Check, Shield, UserMinus, LogOut, Trash2, KeyRound } from 'lucide-react';
import { Group, GroupMember, AppUser, MemberRole } from '../types';
import { leaveGroup, removeGroupMember, deleteGroup, updateGroupMemberRole } from '../services/groupService';

interface GroupMembersModalProps {
  group: Group;
  members: GroupMember[];
  currentUser: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onLeftGroup: () => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  group,
  members,
  currentUser,
  isOpen,
  onClose,
  onLeftGroup,
}) => {
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  const isOriginalLeader = group.ownerId === currentUser.id;
  const isAppAdmin = currentUser.role === 'admin';
  const myMember = members.find((m) => m.userId === currentUser.id);
  const isCoLeaderSelf = myMember?.role === 'co-leader';

  // Co-leaders have leader capabilities except deleting the group
  const canViewEmails = isOriginalLeader || isCoLeaderSelf || isAppAdmin;
  const canToggleCoLeader = isOriginalLeader || isAppAdmin; // Only original creator or Admin can assign/remove co-leaders
  const canDeleteGroup = isOriginalLeader || isAppAdmin; // Co-leader CANNOT delete the group, only original leader!

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleCoLeader = async (memberId: string, memberName: string, currentRole: MemberRole) => {
    if (!canToggleCoLeader) {
      alert("Only the original group leader can manage co-leaders.");
      return;
    }
    const newRole: MemberRole = currentRole === 'co-leader' ? 'member' : 'co-leader';
    const actionLabel = newRole === 'co-leader' ? 'promote to Co-leader' : 'demote to regular Member';
    if (!confirm(`Are you sure you want to ${actionLabel} for "${memberName}"?`)) return;

    setProcessing(true);
    try {
      await updateGroupMemberRole(group.id, memberId, newRole);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error)?.message || 'Failed to update member role.');
    } finally {
      setProcessing(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm(`Are you sure you want to leave "${group.name}"? You will stop receiving this group's alarms.`)) {
      return;
    }
    setProcessing(true);
    try {
      await leaveGroup(group.id, currentUser.id);
      onClose();
      onLeftGroup();
    } catch (err) {
      console.error(err);
      alert('Failed to leave group.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from "${group.name}"?`)) return;
    setProcessing(true);
    try {
      await removeGroupMember(group.id, memberId);
    } catch (err) {
      console.error(err);
      alert('Failed to remove member.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!canDeleteGroup) {
      alert("Only the original leader who created the group can delete it.");
      return;
    }
    if (!confirm(`Are you sure you want to delete group "${group.name}" and all its alarms? This cannot be undone.`)) {
      return;
    }
    setProcessing(true);
    try {
      await deleteGroup(group.id);
      onClose();
      onLeftGroup();
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error)?.message || 'Failed to delete group.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1D4ED8] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-base font-bold leading-tight">Group Members</h2>
              <p className="text-[11px] text-blue-200 font-medium">
                {members.length} / {group.maxMembers || 10} members
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800">
          {/* Group Invite Code Card */}
          <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Join Code for New Members</span>
              </div>
              <div className="text-lg font-mono font-black text-blue-800 tracking-wider mt-0.5">
                {group.inviteCode}
              </div>
            </div>
            <button
              onClick={copyCode}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Members list */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Members Roster
              </span>
              {canToggleCoLeader && (
                <span className="text-[11px] text-slate-400 font-medium">
                  Toggle Co-leader below
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/40">
              {members.map((m) => {
                const isSelf = m.userId === currentUser.id;
                const isMemberOriginalLeader = m.userId === group.ownerId || m.role === 'owner';
                const isMemberCoLeader = m.role === 'co-leader';
                const roleLabel = isMemberOriginalLeader
                  ? 'Leader'
                  : isMemberCoLeader
                  ? 'Co-leader'
                  : 'Member';

                return (
                  <div
                    key={m.userId}
                    className="p-3 flex items-center justify-between gap-2.5 bg-white hover:bg-slate-50 transition-colors min-h-[56px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Profile Photo with initials fallback */}
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-slate-200">
                        {m.avatar ? (
                          <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{m.name.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {m.name}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        {/* Emails shown only to leader, co-leader, and Admin */}
                        {canViewEmails && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {m.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Co-Leader Toggle Button for Leader / Admin */}
                      {canToggleCoLeader && !isMemberOriginalLeader && (
                        <button
                          type="button"
                          onClick={() => handleToggleCoLeader(m.userId, m.name, m.role)}
                          disabled={processing}
                          title={isMemberCoLeader ? 'Remove Co-leader role' : 'Make this member a Co-leader'}
                          className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            isMemberCoLeader
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs hover:bg-indigo-700'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {/* Toggle switch icon indicator */}
                          <span
                            className={`w-5 h-3 rounded-full p-0.5 flex items-center transition-colors ${
                              isMemberCoLeader ? 'bg-indigo-300 justify-end' : 'bg-slate-300 justify-start'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
                          </span>
                          <span>{isMemberCoLeader ? 'Co-leader' : 'Make Co-leader'}</span>
                        </button>
                      )}

                      {/* Role Badge (shown when not showing toggle button, or for Leader) */}
                      {(isMemberOriginalLeader || !canToggleCoLeader) && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isMemberOriginalLeader
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isMemberCoLeader
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isMemberOriginalLeader && <Shield className="w-3 h-3 text-amber-700" />}
                          {isMemberCoLeader && <Shield className="w-3 h-3 text-indigo-700" />}
                          <span>{roleLabel}</span>
                        </span>
                      )}

                      {/* Remove member button if leader/admin and not self and not original leader */}
                      {canToggleCoLeader && !isSelf && !isMemberOriginalLeader && (
                        <button
                          onClick={() => handleRemoveMember(m.userId, m.name)}
                          disabled={processing}
                          title="Remove member from group"
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 space-y-2">
            {!isOriginalLeader && (
              <button
                type="button"
                onClick={handleLeaveGroup}
                disabled={processing}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer min-h-[44px]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave this Group</span>
              </button>
            )}

            {/* Delete Group: ONLY the original leader who created it (or admin) can delete the group */}
            {canDeleteGroup && (
              <button
                type="button"
                onClick={handleDeleteGroup}
                disabled={processing}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-500 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer min-h-[44px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Group</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
