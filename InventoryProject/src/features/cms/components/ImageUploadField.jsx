import React from 'react';

export default function ImageUploadField({
  label,
  value,
  onChange,
  onUpload,
  uploading,
  placeholder = 'https://...',
  previewShape = 'wide',
  hint
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-700">{label}</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer bg-transparent border-none"
          >
            Remove image
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        {value && (
          <div
            className={`shrink-0 bg-zinc-100 border border-zinc-200 rounded-xl overflow-hidden flex items-center justify-center ${
              previewShape === 'icon'
                ? 'w-14 h-14 p-2'
                : previewShape === 'square'
                ? 'w-20 h-20 p-1.5'
                : 'w-full sm:w-40 h-24'
            }`}
          >
            <img
              src={value}
              alt={label}
              className={`w-full h-full ${
                previewShape === 'icon' || previewShape === 'square' ? 'object-contain' : 'object-cover'
              }`}
            />
          </div>
        )}

        <div className="flex-1 w-full space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
            />
            <label
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 transition-colors shrink-0 ${
                uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.ico"
                disabled={uploading}
                onChange={onUpload}
                className="hidden"
              />
            </label>
          </div>
          {hint && <p className="m-0 text-[11px] text-zinc-500">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
