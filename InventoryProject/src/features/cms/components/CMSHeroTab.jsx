import React from 'react';
import ImageUploadField from './ImageUploadField';

export default function CMSHeroTab({
  landingHero,
  menuSection,
  updateField,
  handleFileUpload,
  uploadingKey,
  savingKey,
  handleSaveSection
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="pb-4 border-b border-zinc-100">
          <h2 className="m-0 text-base font-bold text-zinc-900">Landing Page Hero</h2>
          <p className="m-0 mt-0.5 text-xs text-zinc-500">
            Main headline, subtext, and background image on the public home page.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">
                Headline (use | to split main title and branch)
              </label>
              <input
                type="text"
                value={landingHero.title || ''}
                onChange={(e) => updateField('landing_hero', 'title', e.target.value)}
                placeholder="COF/TEA CAFÉ | ELWOOD BRANCH"
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">Tagline / Subtext</label>
              <textarea
                rows={3}
                value={landingHero.description || ''}
                onChange={(e) => updateField('landing_hero', 'description', e.target.value)}
                placeholder="Optional welcome message..."
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 resize-y"
              />
            </div>
          </div>

          <ImageUploadField
            label="Hero Background Image"
            value={landingHero.image_url || ''}
            onChange={(val) => updateField('landing_hero', 'image_url', val)}
            onUpload={(e) => handleFileUpload('landing_hero', e, 'Hero background')}
            uploading={uploadingKey === 'landing_hero'}
            previewShape="wide"
            hint="Landscape photo recommended (1920×1080)."
          />
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <button
            type="button"
            onClick={() => handleSaveSection('landing_hero', 'Hero section')}
            disabled={savingKey === 'landing_hero'}
            className="px-5 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingKey === 'landing_hero' ? 'Saving...' : 'Save Hero Section'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="pb-4 border-b border-zinc-100">
          <h2 className="m-0 text-base font-bold text-zinc-900">Menu Board Header</h2>
          <p className="m-0 mt-0.5 text-xs text-zinc-500">
            Customizes the button label and heading for the public Menu Board drawer. Individual drink prices and photos are managed in Manage Products.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700">Small Subtitle</label>
            <input
              type="text"
              value={menuSection.description || ''}
              onChange={(e) => updateField('menu_section', 'description', e.target.value)}
              placeholder="Browse Our"
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700">Main Menu Title</label>
            <input
              type="text"
              value={menuSection.title || ''}
              onChange={(e) => updateField('menu_section', 'title', e.target.value)}
              placeholder="Menu Board"
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <button
            type="button"
            onClick={() => handleSaveSection('menu_section', 'Menu header')}
            disabled={savingKey === 'menu_section'}
            className="px-5 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingKey === 'menu_section' ? 'Saving...' : 'Save Menu Header'}
          </button>
        </div>
      </div>
    </div>
  );
}
