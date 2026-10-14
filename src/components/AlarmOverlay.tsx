import React, { useEffect, useState } from 'react';
import { Bell, Volume2, VolumeX, Check, X, MapPin, Clock, MessageSquare, ArrowLeft } from 'lucide-react';
import { alarmAudio } from '../lib/alarmAudio';
import { Schedule, AppUser } from '../types';
import { setScheduleAcknowledgement, stopActiveAlarm } from '../services/scheduleService';

interface AlarmOverlayProps {
  schedule: Schedule;
  groupName?: string;
  currentUser: AppUser;
  onClose: () => void;
}

const DISMISS_REASONS = [
  'Work / Class conflict',
  'Family emergency',
  'Not feeling well',
  'Out of town',
  'Prior commitment',
];

export const AlarmOverlay: React.FC<AlarmOverlayProps> = ({
  schedule,
  groupName = 'Group Event',
  currentUser,
  onClose,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showDismissReasonModal, setShowDismissReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);

  useEffect(() => {
    // Attempt starting audio ringing
    alarmAudio.startRinging(schedule.alarmSoundType || 'chime', schedule.customSoundData);

    // Check if the browser blocked audio playback due to autoplay policy
    const timer = setTimeout(() => {
      if (alarmAudio.isAudioBlocked()) {
        setIsAudioBlocked(true);
      }
    }, 400);

    // Trigger device vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([600, 250, 600, 250, 1000]);
      } catch {
        // Ignore vibration errors if blocked
      }
    }

    return () => {
      clearTimeout(timer);
      alarmAudio.stopRinging();
    };
  }, [schedule.alarmSoundType, schedule.customSoundData]);

  const handleUserUnblockAudio = () => {
    alarmAudio.unlockAudio();
    alarmAudio.startRinging(schedule.alarmSoundType || 'chime', schedule.customSoundData);
    setIsAudioBlocked(false);
    setIsMuted(false);
  };

  const handleSilenceSound = () => {
    alarmAudio.stopRinging();
    setIsMuted(true);
  };

  const handleComing = async () => {
    setHasInteracted(true);
    alarmAudio.stopRinging();
    try {
      await setScheduleAcknowledgement(schedule.groupId, schedule.id, currentUser, 'coming');
      if (schedule.creatorId === currentUser.id) {
        await stopActiveAlarm(schedule.groupId, schedule.id);
      }
    } catch (e) {
      console.error('Acknowledgement error:', e);
    } finally {
      onClose();
    }
  };

  const handleOpenDismiss = () => {
    // Stop loud ringing while they type reason
    alarmAudio.stopRinging();
    setShowDismissReasonModal(true);
  };

  const handleConfirmDismiss = async (includeReason = true) => {
    setHasInteracted(true);
    const finalReason = includeReason ? (customReason.trim() || selectedReason || undefined) : undefined;
    try {
      await setScheduleAcknowledgement(
        schedule.groupId,
        schedule.id,
        currentUser,
        'dismissed',
        finalReason
      );
      if (schedule.creatorId === currentUser.id) {
        await stopActiveAlarm(schedule.groupId, schedule.id);
      }
    } catch (e) {
      console.error('Dismiss error:', e);
    } finally {
      onClose();
    }
  };

  const getStartsInText = () => {
    try {
      const [sh, sm] = schedule.startTime.split(':').map(Number);
      const [yr, mo, da] = schedule.startDate.split('-').map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(yr)) {
        const eventDate = new Date(yr, mo - 1, da, sh, sm);
        const diffMin = Math.round((eventDate.getTime() - Date.now()) / 60000);
        if (diffMin > 0) {
          return `Starts in ${diffMin} min · ${schedule.startTime}`;
        } else if (diffMin === 0) {
          return `Starts now · ${schedule.startTime}`;
        } else {
          return `Started ${Math.abs(diffMin)} min ago · ${schedule.startTime}`;
        }
      }
    } catch {
      // fallback
    }
    return schedule.startTime;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0B1220] text-white p-6 sm:p-10 select-none animate-in fade-in duration-300">
      {/* Top Header with Silence Control */}
      <div className="w-full flex items-center justify-between max-w-md pt-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs font-bold tracking-widest text-[#9FB2D9] uppercase">
            GROUP ALARM
          </span>
        </div>
        <button
          onClick={handleSilenceSound}
          className="min-h-[44px] px-3.5 py-2 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-slate-700"
          title="Silence sound without answering"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-amber-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-blue-400 animate-pulse" />
          )}
          <span>{isMuted ? 'Silenced' : 'Silence'}</span>
        </button>
      </div>

      {/* Prominent Tap to Enable Sound Banner for Browser Autoplay Restriction */}
      {isAudioBlocked && (
        <div className="w-full max-w-md my-2">
          <button
            onClick={handleUserUnblockAudio}
            className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 animate-bounce cursor-pointer min-h-[44px]"
          >
            <Volume2 className="w-5 h-5 fill-slate-950" />
            <span>🔊 TAP HERE TO PLAY ALARM SOUND</span>
          </button>
        </div>
      )}

      {/* Main Ringing Center */}
      <div className="flex flex-col items-center text-center my-auto max-w-sm">
        <div className="text-xs font-bold tracking-wider text-[#7C93C4] uppercase mb-4">
          {groupName} • EVENT ALARM
        </div>

        {/* Concentric Pulsing Ring Container */}
        <div className="relative w-36 h-36 my-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-600/35 pulse-ring-anim pointer-events-none" />
          <div className="absolute inset-0 rounded-full bg-blue-500/25 pulse-ring-anim-d2 pointer-events-none" />
          <div className="relative w-24 h-24 rounded-full bg-blue-600 shadow-xl shadow-blue-500/60 flex items-center justify-center text-white z-10">
            <Bell className="w-12 h-12 animate-bounce" />
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-4 tracking-tight">
          {schedule.title}
        </h2>

        {/* Starts in X min · time */}
        <div className="flex items-center gap-3 mt-3 text-[#9FB2D9] text-sm font-semibold">
          {schedule.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-blue-400" />
              {schedule.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>{getStartsInText()}</span>
          </span>
        </div>

        {schedule.description && (
          <p className="text-xs text-slate-400 mt-3 line-clamp-2 px-4 max-w-xs">
            {schedule.description}
          </p>
        )}

        <div className="mt-3 text-[11px] font-semibold text-blue-200 bg-blue-900/40 px-3.5 py-1 rounded-full border border-blue-700/40">
          🎵 Ringtone: {schedule.alarmSoundType === 'custom' ? (schedule.customSoundName || 'Custom Upload') : (schedule.alarmSoundType || 'Classic Chimes')}
        </div>
      </div>

      {/* Action Buttons: Large Primary "I'm Coming" + Smaller Secondary "Can't make it" */}
      <div className="w-full max-w-md flex flex-col gap-3 pb-6">
        <button
          onClick={handleComing}
          disabled={hasInteracted}
          className="w-full min-h-[64px] py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/60 transition-all cursor-pointer ring-2 ring-emerald-400/40"
        >
          <Check className="w-7 h-7 stroke-[3]" />
          <span>I'm Coming</span>
        </button>

        <button
          onClick={handleOpenDismiss}
          disabled={hasInteracted}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
        >
          <X className="w-4 h-4" />
          <span>Can't make it</span>
        </button>
      </div>

      {/* Dismissal Reason Modal: "Reason" dialog */}
      {showDismissReasonModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold">Can't make it</h3>
              </div>
              {/* Back button returns to the alarm screen */}
              <button
                onClick={() => setShowDismissReasonModal(false)}
                className="min-h-[44px] px-2.5 py-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Let your group leader know why you won't be able to attend:
            </p>

            {/* Quick Reason Chips at least 44px tall with selected state */}
            <div className="grid grid-cols-2 gap-2">
              {DISMISS_REASONS.map((r) => {
                const isSelected = selectedReason === r && !customReason;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSelectedReason(r);
                      setCustomReason('');
                    }}
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center text-center ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            {/* Custom Input */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Custom note (optional)
              </label>
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setSelectedReason('');
                }}
                placeholder="e.g. Doctor's appointment, car broke down..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-[#F4F7FD] text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white resize-none"
              />
            </div>

            {/* Buttons: Skip and Send reason (blue primary, not red) */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmDismiss(false)}
                className="min-h-[44px] flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDismiss(true)}
                className="min-h-[44px] flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-900/20 cursor-pointer"
              >
                Send reason
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
