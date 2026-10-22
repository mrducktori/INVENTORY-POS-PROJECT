import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { getCmsContent, updateCmsContent } from '../../api/cmsApi';

const CMSDashboard = () => {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', image_url: '' });
  const [uploading, setUploading] = useState(false);
  
  // State for multiple promos in promo_section
  const [promoList, setPromoList] = useState([]);
  const [uploadingPromoIdx, setUploadingPromoIdx] = useState(null);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const data = await getCmsContent();
      
      const defaultSections = [
        { section_key: 'brand_logo', title: 'CofTea Cafe', description: 'Elwood Branch', image_url: '' },
        { section_key: 'promo_section', title: 'Featured Promotions', description: 'Ask our baristas about daily specials and seasonal drinks!', image_url: '' },
        { section_key: 'landing_hero', title: '', description: '', image_url: '' },
        { section_key: 'menu_section', title: '', description: '', image_url: '' },
        { section_key: 'location_info', title: 'Location', description: '2nd flr, 4JCayton Bldg, 144 L. Wood Rd, Taytay, 1920 Rizal', image_url: 'https://maps.app.goo.gl/3gUeunPoZJfubcFd8' },
        { section_key: 'footer_info', title: '', description: '', image_url: '' },
        { section_key: 'social_links', title: '', description: '', image_url: '' }
      ];
      
      const mergedContent = defaultSections.map(def => {
        const found = (data || []).find(d => d.section_key === def.section_key);
        return found || def;
      });
      
      setContent(mergedContent);
    } catch (err) {
      console.error(err);
      setError('Failed to load CMS content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const parsePromos = (item) => {
    if (!item) return [];
    if (item.description) {
      try {
        const parsed = JSON.parse(item.description);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // legacy non-JSON description
      }
    }
    if (item.image_url || item.title) {
      return [{
        id: 'promo_default',
        title: item.title || 'Featured Promotion',
        description: item.description || '',
        image_url: item.image_url || ''
      }];
    }
    return [];
  };

  const handleEdit = (item) => {
    setEditing(item.section_key);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || ''
    });

    if (item.section_key === 'promo_section') {
      const list = parsePromos(item);
      setPromoList(list.length > 0 ? list : [{ id: 'promo_' + Date.now(), title: '', description: '', image_url: '' }]);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setFormData({ title: '', description: '', image_url: '' });
    setPromoList([]);
    setUploadingPromoIdx(null);
  };

  const handleAddPromoItem = () => {
    setPromoList(prev => [
      ...prev,
      {
        id: 'promo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: '',
        description: '',
        image_url: ''
      }
    ]);
  };

  const handleRemovePromoItem = (index) => {
    setPromoList(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePromoItem = (index, field, value) => {
    setPromoList(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handlePromoItemImageUpload = async (index, file) => {
    if (!file) return;
    try {
      setUploadingPromoIdx(index);
      const fileExt = file.name.split('.').pop();
      const fileName = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cms-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('cms-images')
        .getPublicUrl(filePath);

      const newImageUrl = data.publicUrl;
      setPromoList(prev => {
        const next = [...prev];
        next[index] = { ...next[index], image_url: newImageUrl };
        return next;
      });
    } catch (err) {
      console.error(err);
      setError('Error uploading promo image. Ensure cms-images storage bucket exists and is public.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploadingPromoIdx(null);
    }
  };

  const handleSavePromos = async () => {
    try {
      setUploading(true);
      const cleaned = promoList.filter(p => p.title || p.description || p.image_url);
      const firstImg = cleaned.find(p => p.image_url)?.image_url || '';
      const payload = {
        title: formData.title || 'Featured Promotions',
        description: JSON.stringify(cleaned),
        image_url: firstImg
      };
      await updateCmsContent('promo_section', payload);
      setEditing(null);
      fetchContent();
    } catch (err) {
      console.error(err);
      setError('Failed to update promotions.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${editing}-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cms-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('cms-images')
        .getPublicUrl(filePath);

      const newImageUrl = data.publicUrl;
      setFormData(prev => ({ ...prev, image_url: newImageUrl }));
      
      // Auto-save immediately to remove the friction of having to click 'Save Changes'
      await updateCmsContent(editing, { ...formData, image_url: newImageUrl });
      fetchContent();
    } catch (err) {
      console.error(err);
      setError('Error uploading image. Make sure the cms-images bucket exists and is public.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateCmsContent(editing, formData);
      setEditing(null);
      fetchContent();
    } catch (err) {
      console.error(err);
      setError('Failed to update content.');
      setTimeout(() => setError(null), 5000);
    }
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="mb-8">
        <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Content Management</h1>
        <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Update text and images for the public landing page.</p>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm md:text-base font-bold">{error}</div>}

      {loading ? (
        <div className="text-center text-gray-500 font-medium p-8">Loading content...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
            <div>
              <h3 className="text-lg font-bold m-0 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Looking for Menu Items?
              </h3>
              <p className="text-gray-300 text-sm md:text-base mt-1 mb-0">
                Menu products, prices, and their pictures are managed directly in the <strong>Manage Products</strong> tab inside Inventory to keep them synced with your Point of Sale.
              </p>
            </div>
            <div className="shrink-0">
              <div className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider text-white">
                Go to: Product Management &gt; Manage Products
              </div>
            </div>
          </div>

          {content.length === 0 && (
            <div className="text-center p-8 bg-white border border-gray-200 rounded-xl text-gray-500 italic text-sm md:text-base">
              No CMS content found. Please run the initial database setup.
            </div>
          )}
          
          {content.map(item => {
            const schema = {
              brand_logo: {
                name: 'Brand Logo & Navigation Identity',
                fields: [
                  { key: 'title', label: 'Brand Name (e.g. CofTea Cafe)', type: 'text' },
                  { key: 'description', label: 'Branch / Tagline (e.g. Elwood Branch)', type: 'text' },
                  { key: 'image_url', label: 'Logo Image (PNG / SVG / JPG)', type: 'image' }
                ]
              },
              promo_section: {
                name: 'Promotions & Featured Deals Banner',
                fields: [
                  { key: 'title', label: 'Promo Title (e.g. Featured Promotions)', type: 'text' },
                  { key: 'description', label: 'Promo Details / Caption', type: 'textarea' },
                  { key: 'image_url', label: 'Promo Photo / Banner Image (JPG / PNG / WebP)', type: 'image' }
                ]
              },
              landing_hero: {
                name: 'Landing Page Hero Section',
                fields: [
                  { key: 'title', label: 'Main Brand & Location', type: 'text' },
                  { key: 'description', label: 'Hero Subtext', type: 'textarea' },
                  { key: 'image_url', label: 'Background Image', type: 'image' }
                ]
              },
              menu_section: {
                name: 'Menu Board Header',
                fields: [
                  { key: 'title', label: 'Main Title (e.g. Menu Board)', type: 'text' },
                  { key: 'description', label: 'Subtitle (e.g. Browse Our)', type: 'text' }
                ]
              },
              location_info: {
                name: 'Location Information',
                fields: [
                  { key: 'title', label: 'Title (e.g. Location)', type: 'text' },
                  { key: 'description', label: 'Address', type: 'textarea' },
                  { key: 'image_url', label: 'Google Maps Link', type: 'text' }
                ]
              },
              footer_info: {
                name: 'Footer Information',
                fields: [
                  { key: 'title', label: 'Copyright Text', type: 'text' }
                ]
              },
              social_links: {
                name: 'Social Media URLs',
                fields: [
                  { key: 'title', label: 'Facebook URL', type: 'text' },
                  { key: 'description', label: 'Instagram URL', type: 'text' }
                ]
              }
            }[item.section_key] || {
              name: `Section: ${item.section_key}`,
              fields: [
                { key: 'title', label: 'Title', type: 'text' },
                { key: 'description', label: 'Description', type: 'textarea' },
                { key: 'image_url', label: 'Image', type: 'image' }
              ]
            };

            if (item.section_key === 'promo_section') {
              const promos = parsePromos(item);
              return (
                <div key={item.section_key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-900 rounded-md text-xs font-bold uppercase tracking-wider">
                            ★ Promotions & Deals Manager
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            ({promos.length} active {promos.length === 1 ? 'promo' : 'promos'})
                          </span>
                        </div>
                        <h2 className="m-0 text-xl font-bold text-gray-900">{item.title || 'Featured Promotions'}</h2>
                      </div>
                      {editing !== item.section_key && (
                        <button 
                          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm"
                          onClick={() => handleEdit(item)}
                        >
                          Manage Promos
                        </button>
                      )}
                    </div>

                    {editing === item.section_key ? (
                      <div className="flex flex-col gap-6 mt-4 border-t border-gray-100 pt-5 animate-[popIn_0.2s_ease-out]">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs md:text-sm font-bold text-gray-700 uppercase tracking-wider">Section Heading</label>
                          <input 
                            type="text" 
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-gray-900 max-w-md"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. Featured Promotions"
                          />
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-800 uppercase tracking-wider">Active Promo Banners ({promoList.length})</span>
                            <button
                              type="button"
                              onClick={handleAddPromoItem}
                              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <span>+ Add Another Promo</span>
                            </button>
                          </div>

                          {promoList.map((promo, idx) => (
                            <div key={promo.id || idx} className="p-4 sm:p-5 border border-gray-200 bg-gray-50/80 rounded-xl flex flex-col md:flex-row gap-5 relative">
                              <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                                <span className="text-xs font-bold text-gray-700 uppercase">Promo Photo #{idx + 1}</span>
                                <div className="w-full aspect-[16/9] bg-gray-200 rounded-lg overflow-hidden relative border border-gray-300 flex items-center justify-center">
                                  {promo.image_url ? (
                                    <img src={promo.image_url} alt="Promo" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs text-gray-400 font-medium">No photo uploaded</span>
                                  )}
                                  {uploadingPromoIdx === idx && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                                      Uploading...
                                    </div>
                                  )}
                                </div>
                                <label className="cursor-pointer text-center px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-md text-xs font-bold uppercase transition-colors shadow-sm">
                                  {promo.image_url ? 'Replace Photo' : 'Upload Photo'}
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => e.target.files[0] && handlePromoItemImageUpload(idx, e.target.files[0])}
                                  />
                                </label>
                              </div>

                              <div className="flex-1 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 mr-3">
                                    <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Promo Title</label>
                                    <input 
                                      type="text" 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                      value={promo.title || ''}
                                      onChange={e => handleUpdatePromoItem(idx, 'title', e.target.value)}
                                      placeholder="e.g. Buy 1 Take 1 Milk Tea"
                                    />
                                  </div>
                                  {promoList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePromoItem(idx)}
                                      className="text-red-500 hover:text-red-700 text-xs font-bold uppercase px-2.5 py-1 rounded hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                                      title="Delete this promo"
                                    >
                                      ✕ Remove
                                    </button>
                                  )}
                                </div>

                                <div>
                                  <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Details / Caption / Terms</label>
                                  <textarea 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[70px] resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={promo.description || ''}
                                    onChange={e => handleUpdatePromoItem(idx, 'description', e.target.value)}
                                    placeholder="e.g. Available every Monday from 2 PM to 5 PM."
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                          <button 
                            type="button" 
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-50 cursor-pointer" 
                            onClick={handleCancel}
                          >
                            Cancel
                          </button>
                          <button 
                            type="button" 
                            className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 shadow-sm cursor-pointer"
                            onClick={handleSavePromos}
                            disabled={uploading || uploadingPromoIdx !== null}
                          >
                            Save All Promos
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                        {promos.length === 0 ? (
                          <p className="text-sm text-gray-500 italic col-span-full">No active promos yet. Click "Manage Promos" to add promotions.</p>
                        ) : (
                          promos.map((p, i) => (
                            <div key={p.id || i} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex flex-col">
                              {p.image_url ? (
                                <div className="w-full aspect-[16/9] bg-gray-100 overflow-hidden">
                                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-full aspect-[16/9] bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                                  No Photo
                                </div>
                              )}
                              <div className="p-3.5 flex-1 flex flex-col justify-between">
                                <div>
                                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block mb-0.5">Promo #{i + 1}</span>
                                  <h4 className="text-sm font-bold text-gray-900 m-0 line-clamp-1">{p.title || 'Untitled Promo'}</h4>
                                  {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2 m-0">{p.description}</p>}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
            <div key={item.section_key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row">
              {item.image_url && schema.fields.some(f => f.key === 'image_url' && f.type === 'image') && (
                <div className="w-full md:w-64 h-48 md:h-auto bg-gray-100 shrink-0">
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs md:text-sm font-bold uppercase tracking-wider mb-2">{schema.name}</span>
                    <h2 className="m-0 text-xl font-bold text-gray-900">{item.title}</h2>
                  </div>
                  {editing !== item.section_key && (
                    <button 
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm"
                      onClick={() => handleEdit(item)}
                    >
                      Edit
                    </button>
                  )}
                </div>
                
                {editing === item.section_key ? (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2 border-t border-gray-100 pt-4 animate-[popIn_0.2s_ease-out]">
                    
                    {schema.fields.map(field => (
                      <div key={field.key} className="flex flex-col gap-2">
                        <label className="text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider">{field.label}</label>
                        
                        {field.type === 'text' && (
                          <input 
                            type="text" 
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-gray-900"
                            value={formData[field.key] || ''}
                            onChange={e => setFormData({...formData, [field.key]: e.target.value})}
                          />
                        )}
                        
                        {field.type === 'textarea' && (
                          <textarea 
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                            value={formData[field.key] || ''}
                            onChange={e => setFormData({...formData, [field.key]: e.target.value})}
                          />
                        )}

                        {field.type === 'image' && (
                          <>
                            <div className="flex items-center gap-4">
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploading}
                                className="text-sm md:text-base text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                              />
                              {uploading && <span className="text-sm md:text-base text-blue-600 font-bold animate-pulse">Uploading...</span>}
                            </div>
                            {formData.image_url && !uploading && (
                              <div className="mt-3 relative w-full sm:w-64 h-32 md:h-40 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-lg"></div>
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-widest rounded">New Preview</div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    
                    <div className="flex justify-end gap-3 mt-2">
                      <button type="button" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-50" onClick={handleCancel}>Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-gray-900 text-white border-none rounded-lg text-sm md:text-base font-bold uppercase tracking-wider hover:bg-gray-800 shadow-sm" disabled={uploading}>Save Changes</button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm md:text-base text-gray-600 mt-2 whitespace-pre-wrap">{item.description}</p>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CMSDashboard;
