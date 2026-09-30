'use client';

import React, { useState } from 'react';
import { Upload, X, Star, AlertCircle, Image as ImageIcon } from 'lucide-react';

export interface UploadedImage {
  id: string;
  storage_path: string;
  size_bytes: number;
  is_cover: boolean;
  sort_order: number;
}

interface PhotoUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
export function PhotoUploader({ images, onChange, maxImages = 3 }: PhotoUploaderProps) {
  const [error, setError] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      setError(`En fazla ${maxImages} fotoğraf yükleyebilirsiniz.`);
      return;
    }

    const newImages: UploadedImage[] = [...images];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // File size validation (2 MB max)
      if (file.size > MAX_IMAGE_SIZE) {
        setError('Bu fotoğraf 2 MB sınırını aşıyor.');
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const isFirst = newImages.length === 0;

        newImages.push({
          id: `img-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          storage_path: base64,
          size_bytes: file.size,
          is_cover: isFirst,
          sort_order: newImages.length,
        });

        // Ensure exactly one cover
        if (!newImages.some((img) => img.is_cover) && newImages.length > 0) {
          newImages[0].is_cover = true;
        }

        onChange([...newImages]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSetCover = (id: string) => {
    const updated = images.map((img) => ({
      ...img,
      is_cover: img.id === id,
    }));
    onChange(updated);
  };

  const handleRemove = (id: string) => {
    const remaining = images.filter((img) => img.id !== id);
    if (remaining.length > 0 && !remaining.some((img) => img.is_cover)) {
      remaining[0].is_cover = true;
    }
    onChange(remaining);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <label
          className={`flex-1 w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            images.length >= maxImages
              ? 'border-[var(--border-app)] opacity-50 cursor-not-allowed bg-[var(--bg-surface-secondary)]/50'
              : 'border-[var(--border-app)] hover:border-[#FF8A1F] bg-[var(--bg-surface-secondary)]/30 hover:bg-[var(--bg-surface-secondary)]/60'
          }`}
        >
          <Upload className="w-8 h-8 text-[#FF8A1F]" />
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--text-main)]">
              Fotoğraflarını buraya yükle
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              JPG, PNG, WEBP • Maksimum {maxImages} fotoğraf • Fotoğraf başına 2 MB
            </p>
          </div>
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            multiple
            disabled={images.length >= maxImages}
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-[var(--color-danger-subtle)] text-[var(--color-danger)] text-xs font-semibold flex items-center gap-2 border border-[rgba(229,72,77,0.3)]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Uploaded Photos Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        {images.map((img) => (
          <div
            key={img.id}
            className={`relative aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all group ${
              img.is_cover ? 'border-[#FF8A1F] ring-2 ring-[#FF8A1F]/30' : 'border-[var(--border-app)]'
            }`}
          >
            <img
              src={img.storage_path}
              alt="İlan görseli"
              className="w-full h-full object-cover"
            />

            {/* Vitrin Badge */}
            {img.is_cover && (
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#FF8A1F] text-white text-[10px] font-extrabold flex items-center gap-1 shadow-md">
                <Star className="w-3 h-3 fill-current" />
                <span>VİTRİN</span>
              </div>
            )}

            {/* Actions Bar */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
              {!img.is_cover && (
                <button
                  type="button"
                  onClick={() => handleSetCover(img.id)}
                  className="px-2.5 py-1 rounded bg-[var(--brand-orange)] text-white text-xs font-semibold flex items-center gap-1 shadow hover:bg-[var(--brand-orange-hover)] cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>Vitrin Yap</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(img.id)}
                className="p-1.5 rounded bg-[var(--color-danger)] text-white text-xs font-semibold shadow hover:opacity-90 cursor-pointer"
                title="Fotoğrafı Kaldır"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Empty Slots */}
        {Array.from({ length: Math.max(0, maxImages - images.length) }).map((_, idx) => (
          <div
            key={idx}
            className="aspect-[16/10] rounded-xl border border-dashed border-[var(--border-app)] bg-[var(--bg-surface-secondary)]/20 flex flex-col items-center justify-center gap-1 text-[var(--text-dim)]"
          >
            <ImageIcon className="w-6 h-6 stroke-1" />
            <span className="text-[11px]">Fotoğraf Alanı {images.length + idx + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
