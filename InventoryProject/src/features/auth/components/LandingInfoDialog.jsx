import React, { useEffect, useRef } from 'react';
import { safeHref } from '../hooks/useLandingPage';

const linkClass = 'text-amber-300 hover:text-amber-200 underline underline-offset-2 font-semibold';

// Placeholder policy wording; the owner must review it before launch.
const buildSections = (cmsData) => ({
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>This page shows our menu, promos and location. It doesn't ask for your name, email or payment details.</p>
        <p>Links to Facebook, Instagram and Google Maps open those services, which follow their own privacy policies.</p>
        <p>Have a question about your data? Message us on Facebook or Instagram.</p>
      </>
    )
  },
  terms: {
    title: 'Terms of Service',
    body: (
      <>
        <p>Menu items, prices and promos can change and depend on what's available in store. The price at the counter is the final price.</p>
        <p>Photos show how an item is usually served. Your order may look a little different.</p>
        <p>Each promo follows the details written on it, including its dates.</p>
      </>
    )
  },
  support: {
    title: 'Support',
    body: (
      <>
        {cmsData.location_address && (
          <div>
            <h3 className="text-white text-sm font-bold mb-1">Visit us</h3>
            <p className="mb-1">{cmsData.location_address}</p>
            <a href={safeHref(cmsData.location_link)} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Get directions
            </a>
          </div>
        )}
        {(cmsData.social_fb || cmsData.social_ig) && (
          <div>
            <h3 className="text-white text-sm font-bold mb-1">Message us</h3>
            <p className="mb-1">For orders, feedback or lost items, send us a message and we'll reply during store hours.</p>
            <div className="flex gap-4">
              {cmsData.social_fb && (
                <a href={safeHref(cmsData.social_fb)} target="_blank" rel="noopener noreferrer" className={linkClass}>Facebook</a>
              )}
              {cmsData.social_ig && (
                <a href={safeHref(cmsData.social_ig)} target="_blank" rel="noopener noreferrer" className={linkClass}>Instagram</a>
              )}
            </div>
          </div>
        )}
      </>
    )
  }
});

function LandingInfoDialog({ section, onClose, cmsData }) {
  const dialogRef = useRef(null);

  // Native <dialog>: showModal() gives focus trap, Escape-to-close and focus return for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (section && !dialog.open) dialog.showModal();
    if (!section && dialog.open) dialog.close();
  }, [section]);

  const content = section ? buildSections(cmsData)[section] : null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="landing-info-title"
      className="m-auto p-0 w-[min(92vw,32rem)] max-h-[85dvh] rounded-xl border border-white/20 bg-zinc-950/95 text-zinc-300 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-[modalPopIn_var(--dur-slow)_var(--ease-out-expo)]"
    >
      {content && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-white/15">
            <h2 id="landing-info-title" className="text-white text-lg sm:text-xl font-black m-0">
              {content.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-9 h-9 -mr-2 -mt-1 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4 text-sm leading-relaxed">{content.body}</div>
        </div>
      )}
    </dialog>
  );
}

export default LandingInfoDialog;
