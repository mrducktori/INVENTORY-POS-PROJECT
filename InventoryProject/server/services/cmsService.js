import { supabase } from "../config/supabaseClient.js";

export const getCmsContent = async () => {
  const { data, error } = await supabase
    .from("cms_content")
    .select("*");
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
