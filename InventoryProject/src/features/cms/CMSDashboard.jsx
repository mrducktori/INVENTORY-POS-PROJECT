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
  
  const fetchContent = async () => {
    try {
      setLoading(true);
      const data = await getCmsContent();
      setContent(data || []);
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

  const handleEdit = (item) => {
    setEditing(item.section_key);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || ''
    });
  };

  const handleCancel = () => {
    setEditing(null);
    setFormData({ title: '', description: '', image_url: '' });
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

      setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
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
        <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Update text and images for the public landing page.</p>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-bold">{error}</div>}

      {loading ? (
        <div className="text-center text-gray-500 font-medium p-8">Loading content...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {content.length === 0 && (
            <div className="text-center p-8 bg-white border border-gray-200 rounded-xl text-gray-500 italic text-sm">
              No CMS content found. Please run the initial database setup.
            </div>
          )}
          
          {content.map(item => (
            <div key={item.section_key} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row">
              {item.image_url && (
                <div className="w-full md:w-64 h-48 md:h-auto bg-gray-100 shrink-0">
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase tracking-wider mb-2">Section: {item.section_key}</span>
                    <h2 className="m-0 text-xl font-bold text-gray-900">{item.title}</h2>
                  </div>
                  {editing !== item.section_key && (
                    <button 
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm"
                      onClick={() => handleEdit(item)}
                    >
                      Edit
                    </button>
                  )}
                </div>
                
                {editing === item.section_key ? (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2 border-t border-gray-100 pt-4 animate-[popIn_0.2s_ease-out]">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Title</label>
                      <input 
                        type="text" 
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Description</label>
                      <textarea 
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Image</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                        />
                        {uploading && <span className="text-xs text-blue-600 font-bold animate-pulse">Uploading...</span>}
                      </div>
                      {formData.image_url && !uploading && (
                        <div className="mt-2 text-xs text-green-600 font-medium break-all">
                          Current: {formData.image_url}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-2">
                      <button type="button" className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-50" onClick={handleCancel}>Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-gray-900 text-white border-none rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-800 shadow-sm" disabled={uploading}>Save Changes</button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CMSDashboard;
