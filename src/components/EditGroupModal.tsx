import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, Trash2, Check, AlertCircle } from 'lucide-react';
import { Group, AppUser } from '../types';
import { updateGroupSettings } from '../services/groupService';

interface EditGroupModalProps {
  group: Group;
  currentUser: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (updatedGroup: Group) => void;
}

function resizeImageToDataUrl(file: File, maxDim = 180): Promise<string> {
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

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  group,
  currentUser: _currentUser,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [avatarInitials, setAvatarInitials] = useState(group.avatarInitials || '');
  const [imageUrl, setImageUrl] = useState<string>(group.imageUrl || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever group changes
  useEffect(() => {
    if (isOpen) {
      setName(group.name);
      setDescription(group.description || '');
      setAvatarInitials(group.avatarInitials || group.name.slice(0, 4).toUpperCase());
      setImageUrl(group.imageUrl || '');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, group]);

  if (!isOpen) return null;

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

  const handleRemoveImage = () => {
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInitialsChange = (val: string) => {
    // Only allow up to 4 characters, uppercase
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    setAvatarInitials(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name cannot be empty.');
      return;
    }

    const finalInitials = (avatarInitials.trim() || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4)).toUpperCase();

    setError(null);
    setSubmitting(true);

    try {
      await updateGroupSettings(group.id, {
        name: name.trim(),
        description: description.trim(),
        avatarInitials: finalInitials,
        imageUrl: imageUrl.trim() || null,
      });

      const updatedGroup: Group = {
        ...group,
        name: name.trim(),
        description: description.trim() || undefined,
        avatarInitials: finalInitials,
        imageUrl: imageUrl.trim() || undefined,
      };

      setSuccess(true);
      if (onUpdated) {
        onUpdated(updatedGroup);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      console.error('Update group settings error:', err);
      setError((err as Error)?.message || 'Failed to update group settings.');
    } finally {
      setSubmitting(false);
    }
  };

  // Preview initials calculation
  const previewInitials = avatarInitials.trim().slice(0, 4) || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'GA';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1D4ED8] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Group Settings</h2>
              <p className="text-[11px] text-blue-200 font-medium">
                Edit name, description &amp; logo badge
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-slate-800">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {/* Group Logo Badge Customizer */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Group Logo Badge
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Photo or 4 Letters
              </span>
            </div>

            {/* Live Badge Preview & Controls */}
            <div className="flex items-center gap-4">
              <div className="relative group/preview shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-[#DCEAFE] text-[#1D4ED8] font-black text-base flex items-center justify-center shadow-md border-2 border-blue-300 overflow-hidden">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Group Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="tracking-tight px-1 text-center font-mono">
                      {previewInitials}
                    </span>
                  )}
                </div>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    title="Remove custom logo image"
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm hover:bg-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                  id="group-logo-file-input"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{imageUrl ? 'Replace Logo Image' : 'Upload Logo Image'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase">Or 4 letters:</span>
                  <input
                    type="text"
                    value={avatarInitials}
                    onChange={(e) => handleInitialsChange(e.target.value)}
                    maxLength={4}
                    placeholder="MICT"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-center uppercase tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              You can upload a photo image as the group logo, or specify up to 4 letters (e.g. &ldquo;MICT&rdquo;, &ldquo;TEAM&rdquo;) to show on the badge.
            </p>
          </div>

          {/* Group Name */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MICT MEETING"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group for?"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Invite Code Info */}
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between text-xs">
            <span className="text-blue-900 font-semibold">Join Invite Code</span>
            <span className="font-mono font-bold text-blue-700 tracking-wider">
              {group.inviteCode}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1D4ED8] hover:bg-blue-800 text-xs font-bold text-white shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
