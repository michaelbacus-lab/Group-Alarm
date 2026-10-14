import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Play,
  Copy,
  Check,
  Users,
  Music,
  Settings,
  Edit3,
} from 'lucide-react';
import { Group, Schedule, AppUser, GroupMember, Acknowledgement } from '../types';
import { listenGroupAllAcknowledgements, stopActiveAlarm } from '../services/scheduleService';
import { syncGroupMemberCount } from '../services/groupService';
import { GroupMembersModal } from './GroupMembersModal';
import { EditGroupModal } from './EditGroupModal';

interface ScheduleListProps {
  group: Group;
  schedules: Schedule[];
  members: GroupMember[];
  currentUser: AppUser;
  onBack: () => void;
  onOpenCreateSchedule: () => void;
  onSelectSchedule: (schedule: Schedule) => void;
  onTriggerAlarm: (schedule: Schedule, targetUserIds?: string[]) => void;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  group,
  schedules,
  members,
  currentUser,
  onBack,
  onOpenCreateSchedule,
  onSelectSchedule,
  onTriggerAlarm,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [copiedCode, setCopiedCode] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'occurrences'>('cards');
  const [acksMap, setAcksMap] = useState<Record<string, Acknowledgement[]>>({});
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);

  // Auto-sync group.memberCount in Firestore if out of sync with actual roster length
  useEffect(() => {
    if (members.length > 0 && group.memberCount !== members.length) {
      syncGroupMemberCount(group.id).catch(() => {});
    }
  }, [group.id, group.memberCount, members.length]);

  const copyInvite = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Listen to real-time acknowledgements for all schedules in this group
  useEffect(() => {
    const scheduleIds = schedules.map((s) => s.id);
    const unsub = listenGroupAllAcknowledgements(group.id, scheduleIds, (loadedAcks) => {
      setAcksMap(loadedAcks);
    });
    return () => unsub();
  }, [group.id, schedules]);

  // Helper to calculate exact counts and pending user IDs from real group members
  const getScheduleStats = (scheduleId: string) => {
    const acks = acksMap[scheduleId] || [];
    const validMemberIds = new Set(members.map((m) => m.userId));

    const comingCount = acks.filter(
      (a) => a.status === 'coming' && validMemberIds.has(a.userId)
    ).length;
    const dismissedCount = acks.filter(
      (a) => a.status === 'dismissed' && validMemberIds.has(a.userId)
    ).length;
    const pendingCount = Math.max(0, members.length - comingCount - dismissedCount);

    const respondedUserIds = new Set(
      acks
        .filter((a) => (a.status === 'coming' || a.status === 'dismissed') && validMemberIds.has(a.userId))
        .map((a) => a.userId)
    );
    const pendingUserIds = members
      .map((m) => m.userId)
      .filter((uid) => !respondedUserIds.has(uid));

    return { comingCount, dismissedCount, pendingCount, pendingUserIds, totalMembers: members.length };
  };

  // Build occurrences for multi-day and recurring events with real attendance numbers
  const occurrences = useMemo(() => {
    const list: Array<{
      id: string;
      schedule: Schedule;
      title: string;
      dayOfWeek: string;
      dayNumber: number;
      monthShort: string;
      timeStr: string;
      location: string;
      comingCount: number;
      pendingCount: number;
      totalMembers: number;
      ownershipLabel: 'Created by me' | 'Joined';
    }> = [];

    schedules.forEach((sch) => {
      const { comingCount, pendingCount, totalMembers } = getScheduleStats(sch.id);
      const isCreator = sch.creatorId === currentUser.id;
      const ownershipLabel: 'Created by me' | 'Joined' = isCreator ? 'Created by me' : 'Joined';

      const baseDate = new Date(sch.startDate + 'T00:00:00');
      const timeStr = sch.startTime;
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      if (sch.scheduleType === 'single') {
        list.push({
          id: sch.id,
          schedule: sch,
          title: sch.title,
          dayOfWeek: dayNames[baseDate.getDay()] || 'SUN',
          dayNumber: baseDate.getDate() || 1,
          monthShort: monthNames[baseDate.getMonth()] || 'JUL',
          timeStr,
          location: sch.location || 'Group Venue',
          comingCount,
          pendingCount,
          totalMembers,
          ownershipLabel,
        });
      } else if (sch.scheduleType === 'range' && sch.endDate) {
        // Multi-day sessions
        const start = new Date(sch.startDate + 'T00:00:00');
        const end = new Date(sch.endDate + 'T00:00:00');
        let current = new Date(start);
        let dayCounter = 1;

        while (current <= end && dayCounter <= 7) {
          const dayIdx = current.getDay();
          if (!sch.repeatDays || sch.repeatDays.includes(dayIdx)) {
            list.push({
              id: `${sch.id}_day_${dayCounter}`,
              schedule: sch,
              title: `${sch.title} — Day ${dayCounter}`,
              dayOfWeek: dayNames[dayIdx],
              dayNumber: current.getDate(),
              monthShort: monthNames[current.getMonth()],
              timeStr,
              location: sch.location || 'Retreat Hall',
              comingCount,
              pendingCount,
              totalMembers,
              ownershipLabel,
            });
          }
          current.setDate(current.getDate() + 1);
          dayCounter++;
        }
      } else {
        // Recurring
        const start = new Date();
        for (let i = 0; i < 14; i++) {
          const testDate = new Date();
          testDate.setDate(start.getDate() + i);
          const dayIdx = testDate.getDay();
          if (!sch.repeatDays || sch.repeatDays.includes(dayIdx)) {
            list.push({
              id: `${sch.id}_rec_${i}`,
              schedule: sch,
              title: sch.title,
              dayOfWeek: dayNames[dayIdx],
              dayNumber: testDate.getDate(),
              monthShort: monthNames[testDate.getMonth()],
              timeStr,
              location: sch.location || 'Main Hall',
              comingCount,
              pendingCount,
              totalMembers,
              ownershipLabel,
            });
            if (list.filter((x) => x.schedule.id === sch.id).length >= 2) break;
          }
        }
      }
    });

    return list;
  }, [schedules, acksMap, members, currentUser.id]);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const currentTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const isSchedulePast = (sch: Schedule) => {
    if (sch.scheduleType === 'single') {
      if (sch.startDate < todayDateStr) return true;
      if (sch.startDate === todayDateStr && sch.startTime < currentTimeStr) return true;
      return false;
    }
    if (sch.endDate && sch.endDate < todayDateStr) {
      return true;
    }
    return false;
  };

  const upcomingSchedules = useMemo(() => {
    return schedules.filter((s) => !isSchedulePast(s));
  }, [schedules, todayDateStr, currentTimeStr]);

  const pastSchedules = useMemo(() => {
    return schedules.filter((s) => isSchedulePast(s));
  }, [schedules, todayDateStr, currentTimeStr]);

  const activeSchedules = activeTab === 'upcoming' ? upcomingSchedules : pastSchedules;
  const myMember = members.find((m) => m.userId === currentUser.id);
  const isCoLeader = myMember?.role === 'co-leader';
  const isLeader = group.ownerId === currentUser.id;
  const canManageSchedules = isLeader || isCoLeader || currentUser.role === 'admin';

  return (
    <div className="relative flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Top Group Banner */}
      <div className="bg-[#1D4ED8] text-white p-4 sm:p-5 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Back to group list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Group Logo / Badge in Banner - Clickable for Leaders / Co-Leaders to Edit */}
          <button
            type="button"
            onClick={() => canManageSchedules && setIsEditGroupOpen(true)}
            disabled={!canManageSchedules}
            title={canManageSchedules ? "Click to edit group settings & replace logo badge" : group.name}
            className={`relative group/badge ${canManageSchedules ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'} transition-transform shrink-0`}
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white font-black text-xs flex items-center justify-center overflow-hidden border border-white/30 shadow-2xs">
              {group.imageUrl ? (
                <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <span className="truncate px-0.5">{group.avatarInitials || group.name.slice(0, 4).toUpperCase()}</span>
              )}
            </div>
            {canManageSchedules && (
              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover/badge:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Edit3 className="w-3.5 h-3.5" />
              </div>
            )}
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black truncate leading-tight">
              {group.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-blue-200 mt-0.5 flex-wrap">
              <span className="font-semibold text-white">
                {members.length} / {group.maxMembers || 10} members
              </span>
              <span>•</span>
              <button
                onClick={copyInvite}
                className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer font-bold text-white bg-white/15 px-2 py-0.5 rounded-md text-[11px]"
                title="Copy group invite code"
              >
                <span>Code: {group.inviteCode}</span>
                {copiedCode ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Edit Group Settings Button */}
          {canManageSchedules && (
            <button
              onClick={() => setIsEditGroupOpen(true)}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              title="Edit group settings and logo badge"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}
          <button
            onClick={() => setIsMembersModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            title="View group members roster"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Members</span>
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'cards' ? 'occurrences' : 'cards')}
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition-colors cursor-pointer min-h-[44px]"
          >
            {viewMode === 'cards' ? 'Timeline' : 'Cards'}
          </button>
        </div>
      </div>

      {/* Tabs: Upcoming & Past */}
      <div className="flex bg-white border-b border-slate-200 text-xs font-bold text-slate-500">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'upcoming'
              ? 'text-[#1D4ED8] border-[#1D4ED8]'
              : 'border-transparent hover:text-slate-700'
          }`}
        >
          Upcoming ({upcomingSchedules.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer min-h-[44px] ${
            activeTab === 'past'
              ? 'text-[#1D4ED8] border-[#1D4ED8]'
              : 'border-transparent hover:text-slate-700'
          }`}
        >
          Past ({pastSchedules.length})
        </button>
      </div>

      {/* Schedule Items List */}
      <div className="flex-1 overflow-y-auto pb-24">
        {activeSchedules.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {activeTab === 'upcoming' ? 'No Upcoming Schedules' : 'No Past Schedules'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4">
              {activeTab === 'upcoming'
                ? canManageSchedules
                  ? "Add your group's upcoming services, practices, or alarm events to sync alarms."
                  : 'Your group leader has not scheduled any upcoming events yet.'
                : 'Completed and past events will appear here.'}
            </p>
            {canManageSchedules && activeTab === 'upcoming' && (
              <button
                onClick={onOpenCreateSchedule}
                className="py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer min-h-[44px]"
              >
                + Create Schedule
              </button>
            )}
          </div>
        ) : viewMode === 'occurrences' ? (
          /* Multi-Day Occurrences View */
          <div className="divide-y divide-slate-100">
            {occurrences.map((occ) => (
              <div
                key={occ.id}
                onClick={() => onSelectSchedule(occ.schedule)}
                className="flex items-center gap-3.5 p-4 hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer group min-h-[56px]"
              >
                {/* Date Block */}
                <div className="w-12 h-12 rounded-xl bg-[#1D4ED8] text-white flex flex-col items-center justify-center shrink-0 shadow-xs">
                  <span className="text-[9px] font-extrabold opacity-90 leading-tight">
                    {occ.dayOfWeek}
                  </span>
                  <span className="text-[16px] font-black leading-none">
                    {occ.dayNumber}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {occ.title}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        occ.ownershipLabel === 'Created by me'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {occ.ownershipLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {occ.timeStr} · {occ.location}
                  </p>
                </div>

                {/* Attendance Badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#E4F6EE] text-[#1D9A6C] whitespace-nowrap">
                    {occ.comingCount} coming
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Cards View */
          <div className="p-4 space-y-3">
            {activeSchedules.map((sch) => {
              const { comingCount, dismissedCount, pendingCount, pendingUserIds, totalMembers } = getScheduleStats(sch.id);
              const isCreator = sch.creatorId === currentUser.id;
              const isLeader = group.ownerId === currentUser.id;
              const canRing = isLeader || isCoLeader || currentUser.role === 'admin';
              const ownershipLabel = isCreator ? 'Created by me' : 'Joined';
              const hasCurrentUserResponded = !pendingUserIds.includes(currentUser.id);
              const isAllMembersResponded = totalMembers > 0 && pendingCount === 0;
              const isAlarmRecent = (sch.activeAlarmTimestamp || 0) > 0 && (Date.now() - (sch.activeAlarmTimestamp || 0) < 180000);
              const isActivelyRinging = isAlarmRecent && !isAllMembersResponded;

              // Auto-heal alarm timestamp in Firestore if all members have responded
              if ((sch.activeAlarmTimestamp || 0) > 0 && isAllMembersResponded) {
                stopActiveAlarm(group.id, sch.id).catch(() => {});
              }

              return (
                <div
                  key={sch.id}
                  onClick={() => onSelectSchedule(sch)}
                  className="p-4 rounded-2xl bg-[#F4F7FD] border border-slate-200 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden"
                >
                  {/* Active alarm banner only if ringing AND not all members responded */}
                  {isActivelyRinging && (
                    <div className="mb-2 py-1 px-2.5 rounded-lg bg-red-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-between animate-pulse">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        ALARM ACTIVELY RINGING
                      </span>
                      <span>
                        {hasCurrentUserResponded ? `${comingCount} COMING · ${pendingCount} PENDING` : 'TAP TO RESPOND'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#1D4ED8] transition-colors leading-snug">
                        {sch.title}
                      </h3>
                      {/* Required Ownership Label */}
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isCreator
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {ownershipLabel}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-[#1D4ED8] bg-[#DCEAFE] px-2.5 py-0.5 rounded-full shrink-0">
                      {sch.reminderMinutes === 0
                        ? 'At start'
                        : sch.reminderMinutes >= 60
                        ? `${sch.reminderMinutes / 60}h before`
                        : `${sch.reminderMinutes}m before`}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-2">
                    <span>
                      {sch.startDate} · {sch.startTime}
                    </span>
                    {sch.location && (
                      <>
                        <span>·</span>
                        <span className="truncate">{sch.location}</span>
                      </>
                    )}
                  </p>

                  {/* Attendance & Smart Ring */}
                  <div className="flex items-center justify-between gap-2 mt-3.5 pt-3 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E4F6EE] text-[#1D9A6C]">
                        ✓ {comingCount} coming
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        ⏳ {pendingCount} pending
                      </span>
                      {dismissedCount > 0 && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          ✕ {dismissedCount} Can't make it
                        </span>
                      )}
                    </div>

                    {/* Smart Ring Button: only leader and admin */}
                    {canRing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canRing) {
                            alert("You don't have permission to do this.");
                            return;
                          }
                          if (pendingCount === 0) {
                            alert('Everyone has responded to this alarm.');
                            return;
                          }
                          const { pendingUserIds } = getScheduleStats(sch.id);
                          onTriggerAlarm(sch, pendingUserIds);
                        }}
                        disabled={pendingCount === 0}
                        title={pendingCount === 0 ? 'Everyone has responded' : `Ring ${pendingCount} pending members`}
                        className={`min-h-[44px] p-1.5 px-3 rounded-xl transition-all shrink-0 flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                          pendingCount === 0
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{pendingCount === 0 ? 'Everyone responded' : `Ring ${pendingCount} pending`}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB with Bell icon) - Leader and Admin ONLY */}
      {canManageSchedules && (
        <button
          onClick={onOpenCreateSchedule}
          aria-label="New Schedule"
          className="absolute right-5 bottom-6 w-13 h-13 rounded-2xl bg-[#1D4ED8] hover:bg-blue-800 text-white flex items-center justify-center shadow-lg shadow-blue-800/35 hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
        >
          <Bell className="w-6 h-6 stroke-[2.2]" />
        </button>
      )}

      {/* Group Members & Leave Modal */}
      {isMembersModalOpen && (
        <GroupMembersModal
          group={group}
          members={members}
          currentUser={currentUser}
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
          onLeftGroup={onBack}
        />
      )}

      {/* Group Settings & Logo Badge Modal */}
      {isEditGroupOpen && (
        <EditGroupModal
          group={group}
          currentUser={currentUser}
          isOpen={isEditGroupOpen}
          onClose={() => setIsEditGroupOpen(false)}
        />
      )}
    </div>
  );
};
