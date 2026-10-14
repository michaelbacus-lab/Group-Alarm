import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, AlignLeft, AlertCircle, Edit3 } from 'lucide-react';
import { ScheduleType, AppUser, Schedule, AlarmSoundType } from '../types';
import { updateSchedule } from '../services/scheduleService';
import { SoundPicker } from './SoundPicker';

interface ScheduleEditModalProps {
  schedule: Schedule;
  currentUser: AppUser;
  isLeader?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export const ScheduleEditModal: React.FC<ScheduleEditModalProps> = ({
  schedule,
  currentUser,
  isLeader = false,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [title, setTitle] = useState(schedule.title);
  const [location, setLocation] = useState(schedule.location || '');
  const [description, setDescription] = useState(schedule.description || '');
  const [scheduleType, setScheduleType] = useState<ScheduleType>(schedule.scheduleType);
  const [startDate, setStartDate] = useState(schedule.startDate);
  const [endDate, setEndDate] = useState(schedule.endDate || '');
  const [startTime, setStartTime] = useState(schedule.startTime);
  const [repeatDays, setRepeatDays] = useState<number[]>(schedule.repeatDays || [1, 3, 5]);
  const [reminderMinutes, setReminderMinutes] = useState<number>(schedule.reminderMinutes);

  // Sound state
  const [alarmSoundType, setAlarmSoundType] = useState<AlarmSoundType>(
    schedule.alarmSoundType || 'chime'
  );
  const [customSoundName, setCustomSoundName] = useState<string>(
    schedule.customSoundName || ''
  );
  const [customSoundData, setCustomSoundData] = useState<string>(
    schedule.customSoundData || ''
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    if (repeatDays.includes(day)) {
      if (repeatDays.length > 1) {
        setRepeatDays(repeatDays.filter((d) => d !== day));
      }
    } else {
      setRepeatDays([...repeatDays, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isAllowed = isLeader || currentUser.role === 'admin';
    if (!isAllowed) {
      setError("You don't have permission to do this.");
      alert("You don't have permission to do this.");
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      await updateSchedule(schedule.groupId, schedule.id, {
        title: title.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        scheduleType,
        startDate,
        endDate: scheduleType !== 'single' && endDate.trim() ? endDate : undefined,
        startTime,
        repeatDays: scheduleType !== 'single' ? repeatDays : undefined,
        reminderMinutes,
        alarmSoundType,
        customSoundName: customSoundName || undefined,
        customSoundData: customSoundData || undefined,
        activeAlarmTimestamp: 0,
        status: 'upcoming',
      });

      if (onUpdated) onUpdated();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as Error)?.message || '';
      if (msg.includes("don't have permission")) {
        setError("You don't have permission to do this.");
        alert("You don't have permission to do this.");
      } else {
        setError('Failed to update schedule.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1D4ED8] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-blue-200" />
            <h2 className="text-base font-bold">Edit Schedule</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-slate-800">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F4F7FD] text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Main Hall, Room 2"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F4F7FD] text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlignLeft className="w-3.5 h-3.5" />
              Notes / Instructions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F4F7FD] text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white resize-none"
            />
          </div>

          {/* Schedule Type Segmented Control */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Schedule Type
            </label>
            <div className="flex bg-[#F4F7FD] p-1 rounded-xl border border-slate-200">
              {(['single', 'range', 'recurring'] as ScheduleType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setScheduleType(type)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                    scheduleType === type
                      ? 'bg-[#1D4ED8] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'single' ? 'Single day' : type === 'range' ? 'Date range' : 'Recurring'}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time fields */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                {scheduleType === 'single' ? 'Date' : 'Start date'}
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="font-bold text-blue-700 bg-transparent border-0 focus:outline-hidden text-right"
              />
            </div>

            {scheduleType !== 'single' && (
              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  End date
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="font-bold text-blue-700 bg-transparent border-0 focus:outline-hidden text-right"
                />
              </div>
            )}

            <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Event Time
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="font-bold text-blue-700 bg-transparent border-0 focus:outline-hidden text-right"
              />
            </div>
          </div>

          {/* Repeat days chips */}
          {scheduleType !== 'single' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Repeat on which days?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = repeatDays.includes(day.value);
                  return (
                    <button
                      type="button"
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        isSelected
                          ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                          : 'bg-white text-blue-700 border-blue-300 hover:border-blue-500'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reminder Offset */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Alarm Reminder Time
            </label>
            <select
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F4F7FD] text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            >
              <option value={0}>At event start time</option>
              <option value={5}>5 minutes before</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={120}>2 hours before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>

          {/* Alarm Sound & Custom Upload Picker */}
          <SoundPicker
            selectedSound={alarmSoundType}
            customSoundName={customSoundName}
            customSoundData={customSoundData}
            onSelectSound={(snd) => setAlarmSoundType(snd)}
            onUploadCustomSound={(name, dataUrl) => {
              setCustomSoundName(name);
              setCustomSoundData(dataUrl);
              setAlarmSoundType('custom');
            }}
            onRemoveCustomSound={() => {
              setCustomSoundName('');
              setCustomSoundData('');
              setAlarmSoundType('chime');
            }}
          />

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-blue-800/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
