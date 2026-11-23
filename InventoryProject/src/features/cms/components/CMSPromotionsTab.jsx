import React from 'react';
import { isValidImageUrl } from '../../../api/cmsApi';

export default function CMSPromotionsTab({
  promos,
  uploadingKey,
  savingKey,
  handleAddPromo,
  handleRemovePromo,
  handleMovePromo,
  handlePromoChange,
  handlePromoImageUpload,
  handleSavePromos
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
        <div>
          <h2 className="m-0 text-base font-bold text-zinc-900">Promotions Carousel</h2>
          <p className="m-0 mt-0.5 text-xs text-zinc-500">
            Add seasonal posters or announcements shown on the landing page carousel.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddPromo}
          className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          + Add Slide
        </button>
      </div>

      {promos.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-zinc-200 rounded-xl space-y-2">
          <p className="m-0 text-sm font-medium text-zinc-600">No active promotions</p>
          <p className="m-0 text-xs text-zinc-400">
            When empty, the promotions carousel is hidden on the public page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {promos.map((promo, idx) => (
            <div
              key={promo.id || idx}
              className="p-4 sm:p-5 border border-zinc-200 rounded-2xl bg-zinc-50/40 hover:bg-zinc-50/70 transition-all space-y-4"
            >
              {/* Slide Header with Order Badge & Sorting Controls */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-zinc-900">
                    Slide #{idx + 1}
                  </span>
                  {idx === 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      First Slide (Hero Cover)
                    </span>
                  )}
                </div>

                {/* Reorder and Delete Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMovePromo(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-600 disabled:opacity-30 disabled:hover:bg-white cursor-pointer transition-colors"
                    title="Move slide up (show earlier)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMovePromo(idx, 1)}
                    disabled={idx === promos.length - 1}
                    className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-600 disabled:opacity-30 disabled:hover:bg-white cursor-pointer transition-colors"
                    title="Move slide down (show later)"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div className="w-[1px] h-4 bg-zinc-200 mx-1" />

                  <button
                    type="button"
                    onClick={() => handleRemovePromo(idx)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove this promotion slide"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              {/* Slide Fields Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Title & Caption */}
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">Slide Title</label>
                    <input
                      type="text"
                      value={promo.title || ''}
                      onChange={(e) => handlePromoChange(idx, 'title', e.target.value)}
                      placeholder="e.g. New Flavor / Seasonal Promo"
                      className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-700">Caption / Description</label>
                    <textarea
                      rows={3}
                      value={promo.description || ''}
                      onChange={(e) => handlePromoChange(idx, 'description', e.target.value)}
                      placeholder="Promo mechanics, dates, or highlight..."
                      className="w-full px-3.5 py-2 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 resize-y transition-colors"
                    />
                  </div>
                </div>

                {/* Right: Poster Image Upload & Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-700">Poster Image</label>
                    {promo.image_url && (
                      <button
                        type="button"
                        onClick={() => handlePromoChange(idx, 'image_url', '')}
                        className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer bg-transparent border-none"
                      >
                        Remove image
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3.5 items-start">
                    {isValidImageUrl(promo.image_url) ? (
                      <div className="shrink-0 w-28 h-28 sm:w-32 sm:h-32 bg-zinc-100 border border-zinc-200 rounded-xl overflow-hidden flex items-center justify-center relative group/img">
                        <img
                          src={promo.image_url.trim()}
                          alt={promo.title || 'Poster'}
                          className="w-full h-full object-cover"
                        />
                        <a
                          href={promo.image_url.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-[11px] font-semibold transition-opacity"
                        >
                          Expand
                        </a>
                      </div>
                    ) : (
                      <div className="shrink-0 w-28 h-28 sm:w-32 sm:h-32 bg-zinc-100/70 border border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center text-zinc-400 p-2 text-center">
                        <svg className="w-6 h-6 mb-1 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px]">{promo.image_url ? 'Invalid URL' : 'No Poster'}</span>
                      </div>
                    )}

                    <div className="flex-1 w-full space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promo.image_url || ''}
                          onChange={(e) => handlePromoChange(idx, 'image_url', e.target.value)}
                          placeholder="https://... or upload poster"
                          className="flex-1 px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                        <label
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 transition-colors shrink-0 shadow-2xs ${
                            uploadingKey === `promo_${idx}` ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span>{uploadingKey === `promo_${idx}` ? 'Uploading...' : 'Upload'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingKey === `promo_${idx}`}
                            onChange={(e) => handlePromoImageUpload(idx, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="m-0 text-[11px] text-zinc-400">
                        Recommended: 4:3 or 16:9 poster. Stored in Supabase Storage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-zinc-100 flex justify-end">
        <button
          type="button"
          onClick={handleSavePromos}
          disabled={savingKey === 'promo_section'}
          className="px-5 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          {savingKey === 'promo_section' ? 'Saving...' : 'Save Promotions'}
        </button>
      </div>
    </div>
  );
}
