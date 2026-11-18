import React from 'react';

export default function CMSLocationFooterTab({
  locationInfo,
  socialLinks,
  footerInfo,
  updateField,
  savingKey,
  handleSaveSection
}) {
  return (
    <div className="space-y-6">
      {/* Location Info */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-zinc-100">
          <h2 className="m-0 text-base font-bold text-zinc-900">Store Location</h2>
          <p className="m-0 mt-0.5 text-xs text-zinc-500">
            Address and Google Maps link displayed on the landing page.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700">Section Heading</label>
            <input
              type="text"
              value={locationInfo.title || ''}
              onChange={(e) => updateField('location_info', 'title', e.target.value)}
              placeholder="Location"
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-700">Google Maps Link</label>
            <input
              type="text"
              value={locationInfo.image_url || ''}
              onChange={(e) => updateField('location_info', 'image_url', e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-700">Street Address</label>
          <input
            type="text"
            value={locationInfo.description || ''}
            onChange={(e) => updateField('location_info', 'description', e.target.value)}
            placeholder="2nd flr, 4JCayton Bldg, 144 L. Wood Rd, Taytay, 1920 Rizal"
            className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
          />
        </div>

        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <button
            type="button"
            onClick={() => handleSaveSection('location_info', 'Location details')}
            disabled={savingKey === 'location_info'}
            className="px-5 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingKey === 'location_info' ? 'Saving...' : 'Save Location'}
          </button>
        </div>
      </div>

      {/* Social Links & Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="pb-3 border-b border-zinc-100">
              <h2 className="m-0 text-base font-bold text-zinc-900">Social Media Links</h2>
              <p className="m-0 mt-0.5 text-xs text-zinc-500">
                Facebook and Instagram links in the footer.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">Facebook URL</label>
              <input
                type="text"
                value={socialLinks.title || ''}
                onChange={(e) => updateField('social_links', 'title', e.target.value)}
                placeholder="https://facebook.com/..."
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">Instagram URL</label>
              <input
                type="text"
                value={socialLinks.description || ''}
                onChange={(e) => updateField('social_links', 'description', e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveSection('social_links', 'Social links')}
              disabled={savingKey === 'social_links'}
              className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingKey === 'social_links' ? 'Saving...' : 'Save Social Links'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="pb-3 border-b border-zinc-100">
              <h2 className="m-0 text-base font-bold text-zinc-900">Footer Copyright</h2>
              <p className="m-0 mt-0.5 text-xs text-zinc-500">
                Copyright notice at the bottom of the landing page.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700">Copyright Text</label>
              <input
                type="text"
                value={footerInfo.title || ''}
                onChange={(e) => updateField('footer_info', 'title', e.target.value)}
                placeholder="© 2026 Cof/tea Cafe. All rights reserved."
                className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveSection('footer_info', 'Footer copyright')}
              disabled={savingKey === 'footer_info'}
              className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingKey === 'footer_info' ? 'Saving...' : 'Save Footer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
