import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Calendar,
  Bell,
  CheckCircle2,
  XCircle,
  Play,
  Trash2,
  Users,
  Edit3,
  MessageSquare,
  Music,
} from 'lucide-react';
import { alarmAudio } from '../lib/alarmAudio';
import { Schedule, Acknowledgement, AppUser, GroupMember, Group } from '../types';
import {
  listenAcknowledgements,
  setScheduleAcknowledgement,
  triggerActiveAlarm,
  deleteSchedule,
} from '../services/scheduleService';
import { ScheduleEditModal } from './ScheduleEditModal';

interface ScheduleDetailModalProps {
  schedule: Schedule;
  currentUser: AppUser;
  members: GroupMember[];
  group?: Group;
  isOpen: boolean;
  onClose: () => void;
  onTestAlarm: (schedule: Schedule) => void;
}

const DISMISS_REASONS = [
  'Work / Class conflict',
  'Family emergency',
  'Not feeling well',
  'Out of town',
  'Prior commitment',
];

export const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  schedule,
  currentUser,
  members,
  group,
  isOpen,
  onClose,
  onTestAlarm,
}) => {
  const [acks, setAcks] = useState<Acknowledgement[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Dismiss reason state
  const [showDismissPrompt, setShowDismissPrompt] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const unsub = listenAcknowledgements(schedule.groupId, schedule.id, (loadedAcks) => {
      setAcks(loadedAcks);
    });
    return () => unsub();
  }, [schedule.groupId, schedule.id, isOpen]);

  if (!isOpen) return null;

  const validMemberIds = new Set(members.map((m) => m.userId));
  const comingMembers = acks.filter(
    (a) => a.status === 'coming' && validMemberIds.has(a.userId)
  );
  const dismissedMembers = acks.filter(
    (a) => a.status === 'dismissed' && validMemberIds.has(a.userId)
  );

  // Pending members are real group members who haven't responded yet
  const respondedUids = new Set(
    acks.filter((a) => validMemberIds.has(a.userId)).map((a) => a.userId)
  );
  const pendingMembers = members.filter((m) => !respondedUids.has(m.userId));

  const myAck = acks.find((a) => a.userId === currentUser.id);

  const userMember = members.find((m) => m.userId === currentUser.id);
  const isGroupLeader =
    (group ? group.ownerId === currentUser.id : false) || userMember?.role === 'owner';
  const isCoLeader = userMember?.role === 'co-leader';
  const isAppAdmin = currentUser.role === 'admin';
  const canManageSchedule = isGroupLeader || isCoLeader || isAppAdmin;

  const handleRSVPComing = async () => {
    try {
      await setScheduleAcknowledgement(schedule.groupId, schedule.id, currentUser, 'coming');
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmDismiss = async () => {
    const finalReason = customReason.trim() || selectedReason || undefined;
    try {
      await setScheduleAcknowledgement(
        schedule.groupId,
        schedule.id,
        currentUser,
        'dismissed',
        finalReason
      );
      setShowDismissPrompt(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBroadcastAlarm = async () => {
    if (!canManageSchedule) {
      alert("You don't have permission to do this.");
      return;
    }
    const pendingIds = pendingMembers.map((m) => m.userId);
    if (pendingIds.length === 0) {
      alert('Everyone has responded to this alarm.');
      return;
    }
    try {
      await triggerActiveAlarm(schedule.groupId, schedule.id, pendingIds);
      onTestAlarm(schedule);
    } catch (e: unknown) {
      console.error(e);
      alert((e as Error)?.message || "You don't have permission to do this.");
    }
  };

  const handleDelete = async () => {
    if (!canManageSchedule) {
      alert("You don't have permission to do this.");
      return;
    }
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    setDeleting(true);
    try {
      await deleteSchedule(schedule.groupId, schedule.id);
      onClose();
    } catch (e) {
      console.error(e);
      alert("You don't have permission to do this.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Top Bar */}
          <div className="bg-[#1D4ED8] text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-blue-200 shrink-0" />
              <h2 className="text-base font-bold truncate">
                {schedule.title}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {canManageSchedule && (
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Edit Schedule Details (Leader/Admin only)"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4 text-slate-800">
            {/* Metadata Card */}
            <div className="bg-[#F4F7FD] p-4 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Event Schedule</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {(() => {
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const formatD = (dStr: string) => {
                      try {
                        const parts = dStr.split('-');
                        if (parts.length === 3) {
                          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }
                        return dStr;
                      } catch {
                        return dStr;
                      }
                    };

                    if (schedule.scheduleType === 'single') {
                      return `One-time · ${formatD(schedule.startDate)}`;
                    } else if (schedule.scheduleType === 'recurring') {
                      const days = (schedule.repeatDays || []).map((idx) => dayNames[idx]).join(', ');
                      const range = schedule.endDate ? ` · ${formatD(schedule.startDate)} – ${formatD(schedule.endDate)}` : ` · From ${formatD(schedule.startDate)}`;
                      return days ? `${days}${range}` : `Recurring${range}`;
                    } else {
                      const range = schedule.endDate ? `Daily · ${formatD(schedule.startDate)} – ${formatD(schedule.endDate)}` : `Daily · ${formatD(schedule.startDate)}`;
                      return range;
                    }
                  })()}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-800 font-medium">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  {schedule.startDate}
                  {schedule.endDate ? ` to ${schedule.endDate}` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-800 font-medium">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  {schedule.startTime} ({schedule.reminderMinutes} min before reminder)
                </span>
              </div>

              {schedule.location && (
                <div className="flex items-center gap-2 text-sm text-slate-800 font-medium">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{schedule.location}</span>
                </div>
              )}

              {schedule.description && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-700 block mb-0.5">Notes</span>
                  <p className="text-xs text-slate-600">
                    {schedule.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700 truncate pr-2">
                  <Music className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-slate-500">Ringtone:</span>
                  <span className="font-bold text-blue-800 truncate">
                    {schedule.alarmSoundType === 'custom'
                      ? (schedule.customSoundName || 'Custom Uploaded Ringtone')
                      : (schedule.alarmSoundType ? schedule.alarmSoundType.toUpperCase() : 'CLASSIC CHIMES')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    alarmAudio.playSoundBurst(schedule.alarmSoundType || 'chime', schedule.customSoundData)
                  }
                  className="px-3 py-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 active:scale-95 text-blue-800 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 min-h-[36px]"
                  title="Test play this schedule's alarm sound"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {/* Attendance RSVP Card for Current User */}
            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Your Attendance RSVP:</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  myAck?.status === 'coming'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : myAck?.status === 'dismissed'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {myAck?.status === 'coming' ? "✓ I'm Coming" : myAck?.status === 'dismissed' ? "✕ Can't make it" : "⏳ Pending"}
                </span>
              </div>

              {myAck?.status === 'dismissed' && myAck.reason && canManageSchedule && (
                <div className="text-xs text-rose-800 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                  <span className="font-bold">Your reason:</span> {myAck.reason}
                </div>
              )}

              {/* Equal prominence RSVP buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleRSVPComing}
                  className={`min-h-[44px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                    myAck?.status === 'coming'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-500 ring-offset-1'
                      : 'bg-white border-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I'm Coming</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDismissPrompt(true)}
                  className={`min-h-[44px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                    myAck?.status === 'dismissed'
                      ? 'bg-rose-600 text-white ring-2 ring-rose-500 ring-offset-1'
                      : 'bg-white border-2 border-rose-300 text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Can't make it</span>
                </button>
              </div>
            </div>

            {/* Member Can't Make It Reason Input Sheet */}
            {showDismissPrompt && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-slate-900 font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    Reason for Not Attending
                  </span>
                  <button
                    onClick={() => setShowDismissPrompt(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DISMISS_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setSelectedReason(r);
                        setCustomReason('');
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center text-center ${
                        selectedReason === r && !customReason
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value);
                    setSelectedReason('');
                  }}
                  placeholder="Or write custom reason..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDismissPrompt(false)}
                    className="min-h-[44px] flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 font-semibold hover:bg-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDismiss}
                    className="min-h-[44px] flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs cursor-pointer"
                  >
                    Send reason
                  </button>
                </div>
              </div>
            )}

            {/* Member Attendance Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Member Attendance ({members.length} / {group?.maxMembers || 10} members)
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {comingMembers.length} coming
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {pendingMembers.length} pending
                  </span>
                </div>
              </div>

              {/* Coming List */}
              {comingMembers.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-emerald-800">Coming ({comingMembers.length}):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {comingMembers.map((m) => (
                      <span
                        key={m.userId}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium"
                      >
                        ✓ {m.userName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Can't make it List with Reason only for Leader/Admin */}
              {dismissedMembers.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-rose-800">
                    Can't make it ({dismissedMembers.length}):
                  </div>
                  <div className="space-y-1">
                    {dismissedMembers.map((m) => (
                      <div
                        key={m.userId}
                        className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                      >
                        <span className="font-bold text-rose-900">
                          ✕ {m.userName}
                        </span>
                        {/* Reasons shown ONLY to group leader and Admin */}
                        {canManageSchedule && (
                          m.reason ? (
                            <span className="text-xs font-medium text-rose-800 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                              Reason: "{m.reason}"
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No reason provided</span>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending List in neutral/amber */}
              {pendingMembers.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-amber-800">Pending Response ({pendingMembers.length}):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingMembers.map((m) => (
                      <span
                        key={m.userId}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium"
                      >
                        ⏳ {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Leader / Admin Controls: Smart Ring Button and Delete */}
            {canManageSchedule && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  onClick={handleBroadcastAlarm}
                  disabled={pendingMembers.length === 0}
                  className={`w-full min-h-[44px] py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                    pendingMembers.length === 0
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-80'
                      : 'bg-blue-700 hover:bg-blue-800 text-white'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {pendingMembers.length === 0
                      ? 'Everyone has responded'
                      : `Ring ${pendingMembers.length} pending`}
                  </span>
                </button>

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl text-rose-700 hover:bg-rose-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Schedule</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Edit Modal */}
      {isEditOpen && (
        <ScheduleEditModal
          schedule={schedule}
          currentUser={currentUser}
          isLeader={isGroupLeader}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
        />
      )}
    </>
  );
};
