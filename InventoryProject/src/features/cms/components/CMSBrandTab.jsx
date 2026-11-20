import React from 'react';
import ImageUploadField from './ImageUploadField';

export default function CMSBrandTab({
  browserTab,
  brandLogo,
  liveTabTitle,
  liveTabIcon,
  updateField,
  handleFileUpload,
  uploadingKey,
  savingKey,
  handleSaveBrandingAndTab
}) {
  return (
    <div className="space-y-6">
      {/* Card 1: Browser Tab Title & Favicon */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="m-0 text-base font-bold text-zinc-900">Browser Tab (Title &amp; Icon)</h2>
            <p className="m-0 mt-0.5 text-xs text-zinc-500">
              Controls the title text and icon shown in the web browser tab across the entire app.
            </p>
          </div>

          {/* Live Browser Tab Mockup Preview */}
          <div className="bg-zinc-200/80 pt-1.5 px-2 rounded-t-xl border border-zinc-300/80 flex items-end self-start sm:self-auto">
            <div className="bg-white px-3 py-1.5 rounded-t-lg shadow-2xs flex items-center gap-2 max-w-[240px] border-t border-x border-zinc-200">
              <img
                src={liveTabIcon}
                alt="Tab icon"
                className="w-4 h-4 object-contain shrink-0 rounded-xs"
                onError={(e) => {
                  e.currentTarget.src = '/favicon.svg';
                }}
              />
              <span className="text-xs font-medium text-zinc-800 truncate">
                {liveTabTitle}
              </span>
              <svg className="w-3 h-3 text-zinc-400 ml-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700">
                Browser Tab Title
              </label>
              <button
                type="button"
                onClick={() => {
                  updateField('browser_tab', 'title', brandLogo.title || 'CofTea Cafe');
                  updateField('browser_tab', 'image_url', brandLogo.image_url || '/favicon.svg');
                }}
                className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 underline cursor-pointer bg-transparent border-none"
              >
                Copy from Brand Logo
              </button>
            </div>
            <input
              type="text"
              value={browserTab.title || ''}
              onChange={(e) => updateField('browser_tab', 'title', e.target.value)}
              placeholder="e.g. CofTea Cafe — Elwood Branch"
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
            />
            <p className="m-0 text-[11px] text-zinc-500">
              Appears on the browser tab and bookmarks.
            </p>
          </div>

          <ImageUploadField
            label="Browser Tab Icon (Favicon)"
            value={browserTab.image_url || ''}
            onChange={(val) => updateField('browser_tab', 'image_url', val)}
            onUpload={(e) => handleFileUpload('browser_tab', e, 'Browser tab icon')}
            uploading={uploadingKey === 'browser_tab'}
            previewShape="icon"
            placeholder="/favicon.svg or https://..."
            hint="Square PNG, JPG, WEBP, or ICO recommended."
          />
        </div>
      </div>

      {/* Card 2: Brand Logo & Name (Sidebar + Landing Header) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="pb-4 border-b border-zinc-100">
          <h2 className="m-0 text-base font-bold text-zinc-900">Brand Logo &amp; Store Name</h2>
          <p className="m-0 mt-0.5 text-xs text-zinc-500">
            Displayed in the navigation sidebar, login screen, and landing page header.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">Brand Name</label>
              <input
                type="text"
                value={brandLogo.title || ''}
                onChange={(e) => updateField('brand_logo', 'title', e.target.value)}
                placeholder="e.g. CofTea Cafe"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">Branch / Subtitle</label>
              <input
                type="text"
                value={brandLogo.description || ''}
                onChange={(e) => updateField('brand_logo', 'description', e.target.value)}
                placeholder="e.g. Elwood Branch"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <ImageUploadField
            label="Brand Logo Image"
            value={brandLogo.image_url || ''}
            onChange={(val) => updateField('brand_logo', 'image_url', val)}
            onUpload={(e) => handleFileUpload('brand_logo', e, 'Brand logo')}
            uploading={uploadingKey === 'brand_logo'}
            previewShape="square"
            placeholder="https://..."
            hint="Displayed in the top-left header and dashboard sidebar."
          />
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <button
            type="button"
            onClick={handleSaveBrandingAndTab}
            disabled={savingKey === 'branding_all'}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingKey === 'branding_all' ? 'Saving...' : 'Save Brand & Tab Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
