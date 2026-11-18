import { useState, useEffect, useCallback } from 'react';
import { getCmsContent, updateCmsContent, uploadCmsImage } from '../../../api/cmsApi';

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

export const NAV_TABS = [
  { id: 'branding', label: 'Brand & Browser Tab' },
  { id: 'hero', label: 'Hero & Menu Header' },
  { id: 'promos', label: 'Promotions' },
  { id: 'details', label: 'Location & Footer' }
];

const CMS_TABS = ['branding', 'hero', 'promos', 'details'];

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

function getInitialTab() {
  if (typeof window !== 'undefined' && window.location.hash.includes('/')) {
    const sub = window.location.hash.split('/')[1];
    if (CMS_TABS.includes(sub)) return sub;
  }
  try {
    const saved = localStorage.getItem('coftea_cms_tab');
    if (saved && CMS_TABS.includes(saved)) return saved;
  } catch {
    /* ignore storage/history errors */
  }
  return 'branding';
}

/**
 * Custom hook encapsulating CMS state, section merging, promo parsing,
 * Supabase image uploads, and save handlers for CMSDashboard.
 */
export const useCMSDashboard = () => {
  const [sections, setSections] = useState({});
  const [promos, setPromos] = useState([]);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [notice, setNotice] = useState({ text: '', type: '' });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('coftea_cms_tab', tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#CMSDashboard/${tab}`);
      }
    } catch {
      /* ignore storage/history errors */
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('coftea_cms_tab', activeTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#CMSDashboard/${activeTab}`);
      }
    } catch {
      /* ignore storage/history errors */
    }
  }, [activeTab]);

  const showNotice = useCallback((text, type = 'success') => {
    setNotice({ text, type });
    setTimeout(() => {
      setNotice((prev) => (prev.text === text ? { text: '', type: '' } : prev));
    }, 3500);
  }, []);

  const fetchCMSData = useCallback(async () => {
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
  }, [showNotice]);

  useEffect(() => {
    fetchCMSData();
  }, [fetchCMSData]);

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

  return {
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
  };
};
