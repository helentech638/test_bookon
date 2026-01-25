import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Storage bucket name for activity images
export const ACTIVITY_IMAGES_BUCKET = 'activity-images';

// Helper function to upload image to Supabase Storage
export const uploadImageToSupabase = async (
  file: Buffer,
  fileName: string,
  contentType: string,
  userId: string
): Promise<{ url: string; path: string }> => {
  try {
    console.log('Starting Supabase upload:', {
      fileName,
      contentType,
      userId,
      fileSize: file.length,
      bucket: ACTIVITY_IMAGES_BUCKET
    });

    // Sanitize filename - remove special characters and encode properly
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .toLowerCase();

    // Create a unique file path with sanitized filename
    const filePath = `${userId}/${Date.now()}-${sanitizedFileName}`;
    
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(ACTIVITY_IMAGES_BUCKET)
      .upload(filePath, file, {
        contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    console.log('File uploaded successfully:', data);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(ACTIVITY_IMAGES_BUCKET)
      .getPublicUrl(filePath);

    console.log('Public URL generated:', urlData.publicUrl);

    return {
      url: urlData.publicUrl,
      path: filePath
    };
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
};

// Helper function to delete image from Supabase Storage
export const deleteImageFromSupabase = async (filePath: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from(ACTIVITY_IMAGES_BUCKET)
      .remove([filePath]);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    throw error;
  }
};
