import { uploadCmsImage } from '../api/cmsApi.js';

/**
 * Uploads an image file to Supabase storage via the authenticated backend CMS endpoint.
 * @param {File} file The file object from an <input type="file">
 * @returns {Promise<string>} The public URL of the uploaded image
 */
export async function uploadImage(file) {
  if (!file) return null;
  return uploadCmsImage(file);
}
