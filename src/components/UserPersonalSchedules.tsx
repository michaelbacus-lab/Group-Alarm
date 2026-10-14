import React, { useEffect, useState } from 'react';
import {
  Bell,
  Search,
  Calendar,
  Clock,
  MapPin,
  Play,
  KeyRound,
  Plus,
  Users,
} from 'lucide-react';
import { Group, Schedule, AppUser, Acknowledgement } from '../types';
import { listenGroupSchedules, listenGroupAllAcknowledgements, stopActiveAlarm } from '../services/scheduleService';
import { listenGroupMembers } from '../services/groupService';

interface UserPersonalSchedulesProps {
  groups: Group[];
  currentUser: AppUser;
  onSelectSchedule: (schedule: Schedule, group: Group) => void;
  onTriggerAlarm: (schedule: Schedule, targetUserIds?: string[]) => void;
  onOpenCreateGroup: () => void;
  onOpenJoinGroup: () => void;
}

interface ScheduleWithGroup extends Schedule {
  group: Group;
}

export const UserPersonalSchedules: React.FC<UserPersonalSchedulesProps> = ({
  groups,
  currentUser,
  onSelectSchedule,
  onTriggerAlarm,
  onOpenCreateGroup,
  onOpenJoinGroup,
}) => {
  const [schedules, setSchedules] = useState<ScheduleWithGroup[]>([]);
  const [search, setSearch] = useState('');
  const [acksMap, setAcksMap] = useState<Record<string, Acknowledgement[]>>({});
  const [groupMembersCount, setGroupMembersCount] = useState<Record<string, number>>({});
  const [userCoLeaderGroups, setUserCoLeaderGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (groups.length === 0) {
      setSchedules([]);
      return;
    }

    const unsubs: (() => void)[] = [];
    const schedulesByGroup: Record<string, Schedule[]> = {};

    groups.forEach((grp) => {
      // Listen to members count and co-leader role for each participating group
      const unsubMembers = listenGroupMembers(grp.id, (m) => {
        setGroupMembersCount((prev) => ({ ...prev, [grp.id]: m.length }));
        const me = m.find((x) => x.userId === currentUser.id);
        setUserCoLeaderGroups((prev) => ({ ...prev, [grp.id]: me?.role === 'co-leader' }));
      });
      unsubs.push(unsubMembers);

      // Listen to schedules for each participating group
      const unsubSched = listenGroupSchedules(grp.id, (scheds) => {
        schedulesByGroup[grp.id] = scheds;

        // Flatten all schedules the user participates in
        const flattened: ScheduleWithGroup[] = [];
        groups.forEach((g) => {
          const list = schedulesByGroup[g.id] || [];
          list.forEach((s) => {
            flattened.push({ ...s, group: g, groupName: g.name });
          });
        });

        // Sort upcoming first
        flattened.sort((a, b) => {
          const dateA = a.startDate + ' ' + a.startTime;
          const dateB = b.startDate + ' ' + b.startTime;
          return dateA.localeCompare(dateB);
        });

        setSchedules(flattened);

        // Listen to acknowledgements
        const schedIds = scheds.map((s) => s.id);
        const unsubAcks = listenGroupAllAcknowledgements(grp.id, schedIds, (acks) => {
          setAcksMap((prev) => ({ ...prev, ...acks }));
        });
        unsubs.push(unsubAcks);
      });
      unsubs.push(unsubSched);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [groups]);

  const filtered = schedules.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.group.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.location && s.location.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your alarm schedules by title, group, or location..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
          {schedules.length} My Alarms
        </span>
      </div>

      {/* Schedules List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {filtered.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center my-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">
              {groups.length === 0 ? 'No Groups Joined Yet' : 'No Scheduled Alarms'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4">
              {groups.length === 0
                ? 'Create a group alarm or enter a join code from a group leader.'
                : 'None of your participating groups have scheduled upcoming alarm events yet.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenJoinGroup}
                className="py-2 px-3.5 rounded-xl border border-blue-300 text-blue-700 font-bold text-xs hover:bg-blue-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Join with Code</span>
              </button>
              <button
                onClick={onOpenCreateGroup}
                className="py-2 px-3.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Group</span>
              </button>
            </div>
          </div>
        ) : (
          filtered.map((sch) => {
            const isCreator = sch.creatorId === currentUser.id;
            const isLeader = sch.group.ownerId === currentUser.id;
            const isCoLeader = Boolean(userCoLeaderGroups[sch.groupId]);
            const canRing = isLeader || isCoLeader || currentUser.role === 'admin';
            const ownershipLabel: 'Created by me' | 'Joined' = isCreator ? 'Created by me' : 'Joined';
            const totalMembers = groupMembersCount[sch.groupId] || sch.group.memberCount || 1;
            const acks = acksMap[sch.id] || [];
            const comingCount = acks.filter((a) => a.status === 'coming').length;
            const dismissedCount = acks.filter((a) => a.status === 'dismissed').length;
            const pendingCount = Math.max(0, totalMembers - comingCount - dismissedCount);
            const hasCurrentUserResponded = acks.some(
              (a) => a.userId === currentUser.id && (a.status === 'coming' || a.status === 'dismissed')
            );
            const isAllMembersResponded = totalMembers > 0 && pendingCount === 0;
            const isAlarmRecent = (sch.activeAlarmTimestamp || 0) > 0 && (Date.now() - (sch.activeAlarmTimestamp || 0) < 180000);
            const isActivelyRinging = isAlarmRecent && !isAllMembersResponded;

            // Auto-heal alarm timestamp in Firestore if all members have responded
            if ((sch.activeAlarmTimestamp || 0) > 0 && isAllMembersResponded) {
              stopActiveAlarm(sch.groupId, sch.id).catch(() => {});
            }

            return (
              <div
                key={sch.id}
                onClick={() => onSelectSchedule(sch, sch.group)}
                className="p-4 rounded-2xl bg-[#F4F7FD] border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group"
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
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 truncate flex items-center gap-1.5">
                        {sch.group.imageUrl ? (
                          <img src={sch.group.imageUrl} alt="" className="w-3.5 h-3.5 rounded-xs object-cover" />
                        ) : sch.group.avatarInitials ? (
                          <span className="font-black text-[10px] bg-blue-200/80 px-1 rounded-xs">{sch.group.avatarInitials}</span>
                        ) : null}
                        <span>{sch.group.name}</span>
                      </span>
                      {/* Required Ownership Label */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCreator
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {ownershipLabel}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-tight truncate">
                      {sch.title}
                    </h3>

                    <div className="flex items-center gap-2.5 text-xs text-slate-500 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        {sch.startDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        {sch.startTime}
                      </span>
                      {sch.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{sch.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-[#1D4ED8] bg-[#DCEAFE] px-2 py-0.5 rounded-full shrink-0">
                    {sch.reminderMinutes === 0
                      ? 'At start'
                      : sch.reminderMinutes >= 60
                      ? `${sch.reminderMinutes / 60}h before`
                      : `${sch.reminderMinutes}m before`}
                  </span>
                </div>

                {/* Attendance Breakdown & Smart Ring */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200/60">
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

                  {canRing && (
                    <button
                      type="button"
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
                        onTriggerAlarm(sch);
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
          })
        )}
      </div>
    </div>
  );
};
