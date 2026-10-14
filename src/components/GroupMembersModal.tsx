import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  ShieldPlus,
  UserMinus,
  LogOut,
  Trash2,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { Group, GroupMember, AppUser, MemberRole } from '../types';
import { leaveGroup, removeGroupMember, deleteGroup, updateGroupMemberRole } from '../services/groupService';
import { listenAllUsers } from '../services/userService';
import { useOnlineStatus } from '../lib/useOnlineStatus';

interface GroupMembersModalProps {
  group: Group;
  members: GroupMember[];
  currentUser: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onLeftGroup: () => void;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  isDanger?: boolean;
  onConfirm: () => Promise<void>;
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const networkOnline = useOnlineStatus();
  const [usersPresence, setUsersPresence] = useState<Record<string, { isOnline: boolean; lastSeen?: string }>>({});

  useEffect(() => {
    if (!isOpen) return;
    const unsub = listenAllUsers(
      (allUsers) => {
        const presence: Record<string, { isOnline: boolean; lastSeen?: string }> = {};
        const now = Date.now();
        allUsers.forEach((u) => {
          const lastSeenMs = u.lastSeen ? new Date(u.lastSeen).getTime() : 0;
          // Consider online if flag is true and updated within the last 2.5 minutes
          const isRecent = now - lastSeenMs < 150000;
          presence[u.id] = {
            isOnline: Boolean(u.isOnline && isRecent),
            lastSeen: u.lastSeen,
          };
        });
        setUsersPresence(presence);
      },
      () => {
        // Fallback: silent ignore
      }
    );
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const isOriginalLeader = group.ownerId === currentUser.id;
  const isAppAdmin = currentUser.role === 'admin';
  const myMember = members.find((m) => m.userId === currentUser.id);
  const isCoLeaderSelf = myMember?.role === 'co-leader';

  // Data privacy: Standard users must NOT see the gmails/emails of other users; ONLY the admin can see it
  const canViewOtherEmails = isAppAdmin;
  const canToggleCoLeader = isOriginalLeader || isAppAdmin; // Only original creator or Admin can assign/remove co-leaders
  const canDeleteGroup = isOriginalLeader || isAppAdmin; // Co-leader CANNOT delete the group, only original leader!

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const promptToggleCoLeader = (memberId: string, memberName: string, currentRole: MemberRole) => {
    if (!canToggleCoLeader) {
      alert("Only the original group leader can manage co-leaders.");
      return;
    }
    const isCurrentlyCoLeader = currentRole === 'co-leader';
    const newRole: MemberRole = isCurrentlyCoLeader ? 'member' : 'co-leader';

    setConfirmDialog({
      title: isCurrentlyCoLeader ? 'Demote Co-leader' : 'Promote to Co-leader',
      message: isCurrentlyCoLeader
        ? `Are you sure you want to demote "${memberName}" back to a regular member?`
        : `Promote "${memberName}" to Co-leader? They will be able to create, edit, and trigger group alarms, but cannot delete the group.`,
      confirmLabel: isCurrentlyCoLeader ? 'Demote to Member' : 'Promote to Co-leader',
      isDanger: isCurrentlyCoLeader,
      onConfirm: async () => {
        setProcessing(true);
        try {
          await updateGroupMemberRole(group.id, memberId, newRole, currentUser);
          setConfirmDialog(null);
        } catch (err: unknown) {
          console.error(err);
          alert((err as Error)?.message || 'Failed to update member role.');
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const promptRemoveMember = (memberId: string, memberName: string) => {
    setConfirmDialog({
      title: 'Remove Member',
      message: `Are you sure you want to remove "${memberName}" from "${group.name}"? They will stop receiving this group's alarms.`,
      confirmLabel: 'Remove Member',
      isDanger: true,
      onConfirm: async () => {
        setProcessing(true);
        try {
          await removeGroupMember(group.id, memberId);
          setConfirmDialog(null);
        } catch (err) {
          console.error(err);
          alert('Failed to remove member.');
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const promptLeaveGroup = () => {
    setConfirmDialog({
      title: 'Leave Group',
      message: `Are you sure you want to leave "${group.name}"? You will stop receiving this group's alarms.`,
      confirmLabel: 'Leave Group',
      isDanger: true,
      onConfirm: async () => {
        setProcessing(true);
        try {
          await leaveGroup(group.id, currentUser.id);
          setConfirmDialog(null);
          onClose();
          onLeftGroup();
        } catch (err) {
          console.error(err);
          alert('Failed to leave group.');
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const promptDeleteGroup = () => {
    if (!canDeleteGroup) {
      alert("Only the original leader who created the group can delete it.");
      return;
    }
    setConfirmDialog({
      title: 'Delete Entire Group',
      message: `Are you sure you want to delete group "${group.name}" and all its scheduled alarms? This action is permanent and cannot be undone.`,
      confirmLabel: 'Delete Forever',
      isDanger: true,
      onConfirm: async () => {
        setProcessing(true);
        try {
          await deleteGroup(group.id, currentUser);
          setConfirmDialog(null);
          onClose();
          onLeftGroup();
        } catch (err: unknown) {
          console.error(err);
          alert((err as Error)?.message || 'Failed to delete group.');
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
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
                Members Roster ({members.length})
              </span>
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-emerald-400 inline-block animate-pulse" />
                  <span>Online</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-300 ring-1 ring-slate-300 inline-block" />
                  <span>Offline</span>
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/40">
              {members.map((m) => {
                const isSelf = m.userId === currentUser.id;
                const isMemberOriginalLeader = m.userId === group.ownerId || m.role === 'owner';
                const isMemberCoLeader = m.role === 'co-leader';
                const isMemberOnline = isSelf
                  ? networkOnline
                  : Boolean(usersPresence[m.userId]?.isOnline);
                const roleLabel = isMemberOriginalLeader
                  ? 'Leader'
                  : isMemberCoLeader
                  ? 'Co-leader'
                  : 'Member';

                const canRemoveThisMember =
                  !isSelf &&
                  !isMemberOriginalLeader &&
                  (isOriginalLeader || isAppAdmin || (isCoLeaderSelf && !isMemberCoLeader));

                return (
                  <div
                    key={m.userId}
                    className="p-3 flex items-center justify-between gap-2 bg-white hover:bg-slate-50 transition-colors min-h-[56px]"
                  >
                    {/* Left: Avatar + Details */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Profile Photo with initials fallback & online/offline green/normal outline */}
                      <div
                        className={`w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden transition-all ${
                          isMemberOnline
                            ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white'
                            : 'ring-1 ring-slate-200'
                        }`}
                        title={`${m.name}: ${isMemberOnline ? 'Online' : 'Offline'}`}
                      >
                        {m.avatar ? (
                          <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{m.name.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Name & Role Badge (never truncated or blocked) */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[130px] sm:max-w-[190px]">
                            {m.name}
                          </span>
                          {/* Small status indicator (online/offline) dot */}
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isMemberOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                            }`}
                            title={isMemberOnline ? 'Status: Online' : 'Status: Offline'}
                          />
                          {isSelf && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 shrink-0">
                              You
                            </span>
                          )}
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full shrink-0 flex items-center gap-0.5 ${
                              isMemberOriginalLeader
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isMemberCoLeader
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isMemberOriginalLeader && <Shield className="w-2.5 h-2.5 text-amber-700" />}
                            {isMemberCoLeader && <ShieldCheck className="w-2.5 h-2.5 text-indigo-700" />}
                            <span>{roleLabel}</span>
                          </span>
                        </div>

                        {/* Email row - Data privacy: Only app admin can see other users' emails */}
                        {(canViewOtherEmails || isSelf) && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {m.email}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Compact Icon Buttons with confirmations */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Co-Leader Toggle Icon Button (Compact 40x40 touch target) */}
                      {canToggleCoLeader && !isMemberOriginalLeader && (
                        <button
                          type="button"
                          onClick={() => promptToggleCoLeader(m.userId, m.name, m.role)}
                          disabled={processing}
                          title={isMemberCoLeader ? 'Remove Co-leader role' : 'Promote to Co-leader'}
                          className={`min-h-[40px] min-w-[40px] w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                            isMemberCoLeader
                              ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                              : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent'
                          }`}
                        >
                          {isMemberCoLeader ? (
                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <ShieldPlus className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      )}

                      {/* Remove member icon button */}
                      {canRemoveThisMember && (
                        <button
                          type="button"
                          onClick={() => promptRemoveMember(m.userId, m.name)}
                          disabled={processing}
                          title={`Remove ${m.name} from group`}
                          className="min-h-[40px] min-w-[40px] w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
                onClick={promptLeaveGroup}
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
                onClick={promptDeleteGroup}
                disabled={processing}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-500 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer min-h-[44px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Group</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirmation In-Modal Dialog */}
        {confirmDialog && (
          <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl border border-slate-200 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    confirmDialog.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  {confirmDialog.title}
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  disabled={processing}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 min-h-[40px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmDialog.onConfirm()}
                  disabled={processing}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white shadow-sm min-h-[40px] cursor-pointer flex items-center justify-center ${
                    confirmDialog.isDanger
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {processing ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    confirmDialog.confirmLabel
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
