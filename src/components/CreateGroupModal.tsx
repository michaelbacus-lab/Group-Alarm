import React, { useState, useRef } from 'react';
import { X, Users, AlertCircle, Camera, Image as ImageIcon, Trash2 } from 'lucide-react';
import { AppUser, Group } from '../types';
import { createGroup } from '../services/groupService';

interface CreateGroupModalProps {
  currentUser: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
}

function resizeImageToDataUrl(file: File, maxDim = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [avatarInitials, setAvatarInitials] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!avatarInitials || avatarInitials.length <= 2) {
      const words = val.trim().split(' ').filter(Boolean);
      if (words.length >= 2) {
        setAvatarInitials((words[0][0] + words[1][0]).toUpperCase());
      } else if (words.length === 1 && words[0].length >= 2) {
        setAvatarInitials(words[0].substring(0, Math.min(4, words[0].length)).toUpperCase());
      }
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImageToDataUrl(file);
      setImageUrl(resized);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not process this image. Please try a different photo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const group = await createGroup(
        name,
        description,
        avatarInitials.slice(0, 4),
        currentUser,
        imageUrl || undefined
      );
      onCreated(group);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to create group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-[#1D4ED8] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-200" />
            <h2 className="text-base font-bold">Create New Group</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-slate-800">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Church Fellowship, Basketball Barkada"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F4F7FD] text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white font-medium"
            />
          </div>

          {/* Badge & Logo section: Image logo OR 4 letters */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Badge / Logo
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Image or up to 4 letters
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              {/* Badge Preview / Image Upload Box */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title={imageUrl ? 'Click to change logo photo' : 'Click to upload group logo image'}
                  className="w-13 h-13 rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-[#F4F7FD] flex items-center justify-center cursor-pointer overflow-hidden transition-all relative group shadow-2xs"
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt="Group Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-blue-700">
                      <span className="text-sm font-black tracking-tight uppercase">
                        {avatarInitials || (name ? name.slice(0, 2).toUpperCase() : 'CF')}
                      </span>
                      <span className="text-[8px] font-semibold text-blue-500 flex items-center gap-0.5">
                        <Camera className="w-2.5 h-2.5" />
                        <span>Logo</span>
                      </span>
                    </div>
                  )}
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-blue-900/60 text-white text-[9px] font-bold flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{imageUrl ? 'Change' : 'Upload'}</span>
                  </div>
                </button>

                {imageUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageUrl('');
                    }}
                    title="Remove logo image and use 4 letters"
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs hover:bg-rose-700 cursor-pointer text-[10px]"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* 4 Letters Input */}
              <div className="w-24 shrink-0">
                <input
                  type="text"
                  maxLength={4}
                  value={avatarInitials}
                  onChange={(e) => setAvatarInitials(e.target.value.toUpperCase())}
                  placeholder="CF"
                  className="w-full px-2.5 py-3 rounded-xl border border-slate-200 bg-[#F4F7FD] text-sm text-center font-black text-blue-700 uppercase focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white tracking-wider"
                  title="Enter 1 to 4 letters for group initials badge"
                />
                <span className="text-[9.5px] text-slate-400 block text-center mt-1">
                  4 letters
                </span>
              </div>

              {/* Description */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Weekly events & alarms"
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-[#F4F7FD] text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
                <span className="text-[9.5px] text-slate-400 block mt-1">
                  Description
                </span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
            <span className="font-semibold">Initial Member Limit</span>
            <span className="font-bold text-slate-800">1 / {currentUser.maxMembersPerGroup || 10} members</span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-800/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
