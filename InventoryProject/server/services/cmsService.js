import { supabase } from "../config/supabaseClient.js";

export const getCmsContent = async () => {
  const { data, error } = await supabase
    .from("cms_content")
    .select("*");
  if (error) throw error;
  return data;
};

export const getCmsSection = async (section_key) => {
  const { data, error } = await supabase
    .from("cms_content")
    .select("*")
    .eq("section_key", section_key)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateCmsContent = async (section_key, updates) => {
  const { data, error } = await supabase
    .from("cms_content")
    .upsert({ section_key, ...updates })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const uploadCmsImageToStorage = async ({ fileName, mimeType, base64Data }) => {
  const cleanedBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanedBase64, 'base64');

  const safeName = String(fileName || 'upload.png')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  const storagePath = `cms_${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("cms-images")
    .upload(storagePath, buffer, {
      contentType: mimeType || 'image/png',
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Supabase storage upload failed.");
  }

  const { data } = supabase.storage.from("cms-images").getPublicUrl(storagePath);
  return data?.publicUrl || null;
};
