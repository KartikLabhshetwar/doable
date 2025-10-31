/**
 * CLIENT-SAFE Cloudinary utilities
 * These functions only generate URLs and don't require the Cloudinary SDK
 * Can be safely imported in client components
 */

/**
 * Gets the Cloudinary cloud name from environment (client-safe)
 */
function getCloudName(): string | undefined {
  if (typeof window !== 'undefined') {
    // Client-side: read from env at build time via NEXT_PUBLIC_ prefix
    return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  }
  // Server-side
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
}

/**
 * Generates an optimized Cloudinary video URL with transformations
 * @param publicId - The public ID of the video in Cloudinary (without file extension)
 * @param options - Optional transformation parameters
 * @returns Optimized Cloudinary video URL
 */
export function getCloudinaryVideoUrl(
  publicId: string,
  options: {
    format?: 'mp4' | 'webm';
    quality?: 'auto' | 'best' | 'good' | 'eco' | 'low';
    width?: number;
    height?: number;
    crop?: string;
    fetchFormat?: 'auto';
  } = {}
): string {
  const {
    format = 'mp4',
    quality = 'auto',
    width,
    height,
    crop = 'limit',
    fetchFormat = 'auto',
  } = options;

  const transformations: string[] = [];

  // Add quality optimization
  transformations.push(`q_${quality}`);

  // Add format optimization
  if (fetchFormat === 'auto') {
    transformations.push('f_auto');
  } else {
    transformations.push(`f_${format}`);
  }

  // Add video codec optimization for better compression
  transformations.push('vc_auto');

  // Add dimensions if specified
  if (width) {
    transformations.push(`w_${width}`);
  }
  if (height) {
    transformations.push(`h_${height}`);
  }
  if (width || height) {
    transformations.push(`c_${crop}`);
  }

  const transformationString = transformations.join(',');
  const cloudName = getCloudName();
  
  if (!cloudName) {
    throw new Error('Cloudinary cloud name is not configured');
  }
  
  const baseUrl = `https://res.cloudinary.com/${cloudName}/video/upload`;
  
  // Build URL: baseUrl/transformations/publicId (no streaming_profile, it's not a valid transformation)
  // Streaming is handled automatically by Cloudinary for video resources
  return `${baseUrl}/${transformationString}/${publicId}`;
}

/**
 * Helper function to get a video URL - falls back to local path if Cloudinary is not configured
 * @param publicId - The public ID or local path
 * @param localPath - Fallback local path
 * @returns Video URL (Cloudinary or local)
 */
export function getVideoUrl(publicId: string, localPath?: string): string {
  // If Cloudinary is not configured, use local path
  const cloudName = getCloudName();
  if (!cloudName) {
    return localPath || publicId;
  }

  // Return Cloudinary URL
  return getCloudinaryVideoUrl(publicId, {
    format: 'mp4',
    quality: 'auto',
    fetchFormat: 'auto',
  });
}

/**
 * Generates a poster (thumbnail) URL for a video
 * @param publicId - The public ID of the video in Cloudinary
 * @param options - Optional transformation parameters
 * @returns Cloudinary poster image URL or undefined if not configured
 */
export function getCloudinaryVideoPoster(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: 'auto' | 'best' | 'good' | 'eco' | 'low';
  } = {}
): string | undefined {
  // If Cloudinary is not configured, return undefined
  const cloudName = getCloudName();
  if (!cloudName) {
    return undefined;
  }

  const {
    width = 1920,
    height,
    quality = 'auto',
  } = options;

  const transformations: string[] = [];

  transformations.push(`q_${quality}`);
  transformations.push('f_auto');

  if (width) {
    transformations.push(`w_${width}`);
  }
  if (height) {
    transformations.push(`h_${height}`);
  }

  // Extract frame from video (at 1 second)
  transformations.push('so_1');

  const transformationString = transformations.join(',');
  const baseUrl = `https://res.cloudinary.com/${cloudName}/video/upload`;

  return `${baseUrl}/${transformationString}/${publicId}.jpg`;
}

