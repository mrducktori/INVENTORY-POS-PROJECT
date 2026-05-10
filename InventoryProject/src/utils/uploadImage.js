import { supabase } from '../../config/supabaseClient';

/**
 * Uploads an image file to the Supabase 'images' storage bucket.
 * @param {File} file The file object from an <input type="file">
 * @returns {Promise<string>} The public URL of the uploaded image
 */
export async function uploadImage(file) {
  if (!file) return null;

  try {
    // Generate a unique file name to prevent overwriting
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image. Please ensure your file is a valid image and try again.', { cause: error });
  }
}
