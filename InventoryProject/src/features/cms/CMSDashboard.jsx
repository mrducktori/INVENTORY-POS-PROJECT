import React from 'react';
import { useCMSDashboard, NAV_TABS } from './hooks/useCMSDashboard';
import CMSBrandTab from './components/CMSBrandTab';
import CMSHeroTab from './components/CMSHeroTab';
import CMSPromotionsTab from './components/CMSPromotionsTab';
import CMSLocationFooterTab from './components/CMSLocationFooterTab';

export default function CMSDashboard() {
  const {
    sections,
    promos,
    activeTab,
    handleTabChange,
    loading,
    savingKey,
    uploadingKey,
    notice,
    setNotice,
    updateField,
    handleSaveSection,
    handleSaveBrandingAndTab,
    handleFileUpload,
    handleAddPromo,
    handleRemovePromo,
    handleMovePromo,
    handlePromoChange,
    handlePromoImageUpload,
    handleSavePromos
  } = useCMSDashboard();

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full space-y-4">
        <div className="h-8 w-56 bg-zinc-200/70 rounded-lg animate-pulse" />
        <div className="h-10 w-full max-w-md bg-zinc-200/60 rounded-xl animate-pulse" />
        <div className="h-80 w-full bg-white border border-zinc-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const browserTab = sections.browser_tab || {};
  const brandLogo = sections.brand_logo || {};
  const landingHero = sections.landing_hero || {};
  const menuSection = sections.menu_section || {};
  const locationInfo = sections.location_info || {};
  const socialLinks = sections.social_links || {};
  const footerInfo = sections.footer_info || {};

  const liveTabTitle = (browserTab.title || brandLogo.title || 'CofTea').trim();
  const liveTabIcon = (browserTab.image_url || brandLogo.image_url || '/favicon.svg').trim();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="m-0 text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
            Website &amp; Brand Settings
          </h1>
          <p className="m-0 mt-1 text-xs sm:text-sm text-zinc-500">
            Manage browser tab branding, landing page visuals, promotions, and store details.
          </p>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs sm:text-sm font-semibold transition-colors self-start sm:self-auto no-underline"
        >
          <span>View Live Page</span>
          <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Status Notice */}
      {notice.text && (
        <div
          className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between border ${
            notice.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-zinc-900 text-white border-zinc-900'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice({ text: '', type: '' })}
            className="opacity-75 hover:opacity-100 cursor-pointer bg-transparent border-none text-current ml-4 inline-flex items-center justify-center"
            aria-label="Dismiss notice"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-zinc-100 p-1 rounded-xl w-fit">
        {NAV_TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BRAND & BROWSER TAB */}
      {activeTab === 'branding' && (
        <CMSBrandTab
          browserTab={browserTab}
          brandLogo={brandLogo}
          liveTabTitle={liveTabTitle}
          liveTabIcon={liveTabIcon}
          updateField={updateField}
          handleFileUpload={handleFileUpload}
          uploadingKey={uploadingKey}
          savingKey={savingKey}
          handleSaveBrandingAndTab={handleSaveBrandingAndTab}
        />
      )}

      {/* TAB 2: HERO & MENU HEADER */}
      {activeTab === 'hero' && (
        <CMSHeroTab
          landingHero={landingHero}
          menuSection={menuSection}
          updateField={updateField}
          handleFileUpload={handleFileUpload}
          uploadingKey={uploadingKey}
          savingKey={savingKey}
          handleSaveSection={handleSaveSection}
        />
      )}

      {/* TAB 3: PROMOTIONS CAROUSEL */}
      {activeTab === 'promos' && (
        <CMSPromotionsTab
          promos={promos}
          uploadingKey={uploadingKey}
          savingKey={savingKey}
          handleAddPromo={handleAddPromo}
          handleRemovePromo={handleRemovePromo}
          handleMovePromo={handleMovePromo}
          handlePromoChange={handlePromoChange}
          handlePromoImageUpload={handlePromoImageUpload}
          handleSavePromos={handleSavePromos}
        />
      )}

      {/* TAB 4: LOCATION, SOCIALS & FOOTER */}
      {activeTab === 'details' && (
        <CMSLocationFooterTab
          locationInfo={locationInfo}
          socialLinks={socialLinks}
          footerInfo={footerInfo}
          updateField={updateField}
          savingKey={savingKey}
          handleSaveSection={handleSaveSection}
        />
      )}
    </div>
  );
}
