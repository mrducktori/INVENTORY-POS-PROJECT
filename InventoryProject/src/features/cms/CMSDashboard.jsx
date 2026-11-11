import React, { useState, useEffect } from 'react';
import { getCmsContent, updateCmsContent, uploadCmsImage } from '../../api/cmsApi';

const DEFAULT_SECTIONS = [
  {
    section_key: 'browser_tab',
    title: 'CofTea Cafe — Elwood Branch',
    description: 'Browser tab title and favicon icon',
    image_url: '/favicon.svg'
  },
  {
    section_key: 'brand_logo',
    title: 'CofTea Cafe',
    description: 'Elwood Branch',
    image_url: ''
  },
  {
    section_key: 'landing_hero',
    title: 'COF/TEA CAFÉ | ELWOOD BRANCH',
    description: 'Freshly brewed coffee, signature milk teas, and handcrafted frappes.',
    image_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2047&auto=format&fit=crop'
  },
  {
    section_key: 'menu_section',
    title: 'Menu Board',
    description: 'Browse Our',
    image_url: ''
  },
  {
    section_key: 'promo_section',
    title: 'Featured Promotions',
    description: '[]',
    image_url: ''
  },
  {
    section_key: 'location_info',
    title: 'Location',
    description: '2nd flr, 4JCayton Bldg, 144 L. Wood Rd, Taytay, 1920 Rizal',
    image_url: 'https://maps.app.goo.gl/3gUeunPoZJfubcFd8'
  },
  {
    section_key: 'social_links',
    title: 'https://www.facebook.com/cofteacafeelwood',
    description: 'https://www.instagram.com/coftea.cafe_elwood/',
    image_url: ''
  },
  {
    section_key: 'footer_info',
    title: '© 2026 Cof/tea Cafe. All rights reserved.',
    description: 'All rights reserved.',
    image_url: ''
  }
];

const NAV_TABS = [
  { id: 'branding', label: 'Brand & Browser Tab' },
  { id: 'hero', label: 'Hero & Menu Header' },
  { id: 'promos', label: 'Promotions' },
  { id: 'details', label: 'Location & Footer' }
];

function parsePromosFromDescription(section) {
  if (!section) return [];
  if (section.description) {
    try {
      const parsed = JSON.parse(section.description);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Fallback for legacy plain text description
    }
  }
  if (section.image_url || section.title) {
    return [
      {
        id: 'promo_1',
        title: section.title || 'Featured Promotion',
        description: section.description || '',
        image_url: section.image_url || ''
      }
    ];
  }
  return [];
}

function ImageUploadField({ label, value, onChange, onUpload, uploading, placeholder = 'https://...', previewShape = 'wide', hint }) {
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
                accept="image/*"
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

export default function CMSDashboard() {
  const [sections, setSections] = useState({});
  const [promos, setPromos] = useState([]);

  const getInitialTab = () => {
    const CMS_TABS = ['branding', 'hero', 'promos', 'details'];
    if (typeof window !== 'undefined' && window.location.hash.includes('/')) {
      const sub = window.location.hash.split('/')[1];
      if (CMS_TABS.includes(sub)) return sub;
    }
    try {
      const saved = localStorage.getItem('coftea_cms_tab');
      if (saved && CMS_TABS.includes(saved)) return saved;
    } catch {}
    return 'branding';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('coftea_cms_tab', tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#CMSDashboard/${tab}`);
      }
    } catch {}
  };

  useEffect(() => {
    try {
      localStorage.setItem('coftea_cms_tab', activeTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#CMSDashboard/${activeTab}`);
      }
    } catch {}
  }, [activeTab]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [notice, setNotice] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchCMSData();
  }, []);

  const showNotice = (text, type = 'success') => {
    setNotice({ text, type });
    setTimeout(() => {
      setNotice((prev) => (prev.text === text ? { text: '', type: '' } : prev));
    }, 3500);
  };

  const fetchCMSData = async () => {
    try {
      setLoading(true);
      const data = await getCmsContent(true);
      const byKey = {};
      if (Array.isArray(data)) {
        data.forEach((s) => {
          if (s && s.section_key) {
            byKey[s.section_key] = s;
          }
        });
      }

      const merged = {};
      DEFAULT_SECTIONS.forEach((def) => {
        merged[def.section_key] = byKey[def.section_key]
          ? { ...def, ...byKey[def.section_key] }
          : { ...def };
      });

      // If browser_tab hasn't been customized yet, seed its defaults from brand_logo
      if (!byKey.browser_tab && byKey.brand_logo) {
        merged.browser_tab = {
          section_key: 'browser_tab',
          title: byKey.brand_logo.title || 'CofTea Cafe',
          description: byKey.brand_logo.description || 'Browser tab title and icon',
          image_url: byKey.brand_logo.image_url || '/favicon.svg'
        };
      }

      setSections(merged);
      setPromos(parsePromosFromDescription(merged.promo_section));
    } catch (err) {
      showNotice('Failed to load content: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (sectionKey, field, value) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || { section_key: sectionKey }),
        [field]: value
      }
    }));
  };

  const handleSaveSection = async (sectionKey, customLabel = 'Changes') => {
    const sec = sections[sectionKey];
    if (!sec) return;
    try {
      setSavingKey(sectionKey);
      await updateCmsContent(sectionKey, {
        title: sec.title || '',
        description: sec.description || '',
        image_url: sec.image_url || ''
      });
      showNotice(`${customLabel} saved.`);
    } catch (err) {
      showNotice(`Failed to save: ${err.message}`, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveBrandingAndTab = async () => {
    try {
      setSavingKey('branding_all');
      const tabSec = sections.browser_tab || {};
      const brandSec = sections.brand_logo || {};

      await Promise.all([
        updateCmsContent('browser_tab', {
          title: tabSec.title || brandSec.title || 'CofTea',
          description: tabSec.description || '',
          image_url: tabSec.image_url || brandSec.image_url || '/favicon.svg'
        }),
        updateCmsContent('brand_logo', {
          title: brandSec.title || 'CofTea Cafe',
          description: brandSec.description || '',
          image_url: brandSec.image_url || ''
        })
      ]);
      showNotice('Brand identity and browser tab updated.');
    } catch (err) {
      showNotice(`Failed to save branding: ${err.message}`, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleFileUpload = async (sectionKey, e, label = 'Image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingKey(sectionKey);
      const publicUrl = await uploadCmsImage(file, sectionKey);
      if (!publicUrl) throw new Error('No public URL returned.');

      const currentSec = sections[sectionKey] || { section_key: sectionKey };
      const updatedSec = { ...currentSec, image_url: publicUrl };

      setSections((prev) => ({
        ...prev,
        [sectionKey]: updatedSec
      }));

      await updateCmsContent(sectionKey, {
        title: updatedSec.title || '',
        description: updatedSec.description || '',
        image_url: publicUrl
      });

      showNotice(`${label} uploaded and saved.`);
    } catch (err) {
      showNotice(`Upload failed: ${err.message}`, 'error');
    } finally {
      setUploadingKey(null);
      e.target.value = '';
    }
  };

  // Promo carousel handlers
  const handleAddPromo = () => {
    setPromos((prev) => [
      ...prev,
      {
        id: `promo_${Date.now()}`,
        title: '',
        description: '',
        image_url: ''
      }
    ]);
  };

  const handleRemovePromo = (index) => {
    setPromos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMovePromo = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= promos.length) return;
    setPromos((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handlePromoChange = (index, field, value) => {
    setPromos((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handlePromoImageUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingKey(`promo_${index}`);
      const publicUrl = await uploadCmsImage(file, `promo_${index}`);
      const updatedPromos = promos.map((item, i) =>
        i === index ? { ...item, image_url: publicUrl } : item
      );
      setPromos(updatedPromos);

      await updateCmsContent('promo_section', {
        title: 'Featured Promotions',
        description: JSON.stringify(updatedPromos),
        image_url: updatedPromos[0]?.image_url || ''
      });
      showNotice(`Promotion #${index + 1} image uploaded and saved.`);
    } catch (err) {
      showNotice(`Promo upload failed: ${err.message}`, 'error');
    } finally {
      setUploadingKey(null);
      e.target.value = '';
    }
  };

  const handleSavePromos = async () => {
    try {
      setSavingKey('promo_section');
      await updateCmsContent('promo_section', {
        title: 'Featured Promotions',
        description: JSON.stringify(promos),
        image_url: promos[0]?.image_url || ''
      });
      showNotice('Promotions saved.');
    } catch (err) {
      showNotice(`Failed to save promotions: ${err.message}`, 'error');
    } finally {
      setSavingKey(null);
    }
  };

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
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer bg-transparent border-none text-current ml-4"
          >
            ✕
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

      {/* =====================================================================
          TAB 1: BRAND & BROWSER TAB
      ===================================================================== */}
      {activeTab === 'branding' && (
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
                  <span className="text-[10px] text-zinc-400 ml-1">✕</span>
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
                hint="Square PNG, SVG, or ICO recommended."
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
      )}

      {/* =====================================================================
          TAB 2: HERO & MENU HEADER
      ===================================================================== */}
      {activeTab === 'hero' && (
        <div className="space-y-6">
          {/* Hero Section */}
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

          {/* Menu Board Heading */}
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
      )}

      {/* =====================================================================
          TAB 3: PROMOTIONS CAROUSEL
      ===================================================================== */}
      {activeTab === 'promos' && (
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
                        {promo.image_url ? (
                          <div className="shrink-0 w-28 h-28 sm:w-32 sm:h-32 bg-zinc-100 border border-zinc-200 rounded-xl overflow-hidden flex items-center justify-center relative group/img">
                            <img
                              src={promo.image_url}
                              alt={promo.title || 'Poster'}
                              className="w-full h-full object-cover"
                            />
                            <a
                              href={promo.image_url}
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
                            <span className="text-[10px]">No Poster</span>
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
      )}

      {/* =====================================================================
          TAB 4: LOCATION, SOCIALS & FOOTER
      ===================================================================== */}
      {activeTab === 'details' && (
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
      )}
    </div>
  );
}
