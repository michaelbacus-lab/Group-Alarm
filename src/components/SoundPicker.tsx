import React, { useRef, useState } from 'react';
import { Upload, Play, Square, Music, Volume2, Check, AlertCircle } from 'lucide-react';
import { AlarmSoundType } from '../types';
import { alarmAudio, SOUND_OPTIONS } from '../lib/alarmAudio';

interface SoundPickerProps {
  selectedSound: AlarmSoundType;
  customSoundName?: string;
  customSoundData?: string;
  onSelectSound: (sound: AlarmSoundType) => void;
  onUploadCustomSound: (name: string, dataUrl: string) => void;
  onRemoveCustomSound: () => void;
}

export const SoundPicker: React.FC<SoundPickerProps> = ({
  selectedSound,
  customSoundName,
  customSoundData,
  onSelectSound,
  onUploadCustomSound,
  onRemoveCustomSound,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewingId, setPreviewingId] = useState<AlarmSoundType | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePreview = (soundId: AlarmSoundType) => {
    if (previewingId === soundId) {
      alarmAudio.stopRinging();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(soundId);
    alarmAudio.stopRinging();
    alarmAudio.playSoundBurst(
      soundId,
      soundId === 'custom' ? customSoundData : undefined
    );
    setTimeout(() => {
      setPreviewingId(null);
    }, 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (keep under 600KB for instant Firestore syncing without exceeding 1MB limit)
    if (file.size > 600 * 1024) {
      setUploadError('Audio ringtone should be under 600KB for fast cloud syncing. Please choose a shorter clip.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onUploadCustomSound(file.name, dataUrl);
        onSelectSound('custom');
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read audio file.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-blue-600" />
          <span>Alarm Sound & Ringtone</span>
        </label>
        <span className="text-[10.5px] font-semibold text-blue-600">
          Admin Sound Control
        </span>
      </div>

      {uploadError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Preset Sound Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SOUND_OPTIONS.filter((s) => s.id !== 'custom').map((opt) => {
          const isSelected = selectedSound === opt.id;
          const isPlaying = previewingId === opt.id;

          return (
            <div
              key={opt.id}
              onClick={() => onSelectSound(opt.id)}
              className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500/30'
                  : 'bg-[#F4F7FD] border-slate-200 hover:border-blue-200 hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-base shrink-0">{opt.icon}</span>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {opt.description}
                  </div>
                </div>
              </div>

              {/* Preview Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(opt.id);
                }}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  isPlaying
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200'
                }`}
                title="Preview sound"
              >
                {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Upload Custom Audio File Box */}
      <div
        className={`p-3 rounded-2xl border transition-all ${
          selectedSound === 'custom'
            ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400/20'
            : 'bg-[#F4F7FD] border-dashed border-slate-300 hover:border-blue-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a"
          onChange={handleFileChange}
          className="hidden"
        />

        {customSoundData ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {customSoundName || 'Custom Uploaded Ringtone'}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold">
                  ✓ Custom audio ready to ring
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handlePreview('custom')}
                className="px-2 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer hover:bg-blue-700"
              >
                {previewingId === 'custom' ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                <span>Test</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Change
              </button>

              <button
                type="button"
                onClick={onRemoveCustomSound}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                title="Remove custom audio"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2 text-center cursor-pointer group"
          >
            <Upload className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-blue-700">
              Upload Own Ringtone / Alarm Sound (.mp3, .wav)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
