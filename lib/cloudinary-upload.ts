/**
 * Server-side utility for uploading videos to Cloudinary
 * Use this in API routes or server actions to upload videos programmatically
 * 
 * WARNING: This file uses Node.js modules and should ONLY be imported server-side
 */

import { cloudinary } from './cloudinary-server';
import { Readable } from 'stream';

/**
 * Uploads a video file to Cloudinary
 * @param file - File buffer or stream
 * @param publicId - Public ID for the video (without extension)
 * @param options - Upload options
 * @returns Upload result with secure URL
 */
export async function uploadVideoToCloudinary(
  file: Buffer | Readable | string,
  publicId: string,
  options: {
    resourceType?: 'video' | 'image' | 'raw';
    folder?: string;
    overwrite?: boolean;
  } = {}
): Promise<{
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  bytes: number;
}> {
  const {
    resourceType = 'video',
    folder,
    overwrite = true,
  } = options;

  const uploadOptions: Record<string, any> = {
    resource_type: resourceType,
    public_id: publicId,
    overwrite,
  };

  if (folder) {
    uploadOptions.folder = folder;
  }

  // Upload to Cloudinary
  let result: any;
  
  if (typeof file === 'string') {
    // For file paths - use direct upload method
    result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload(file, uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  } else if (Buffer.isBuffer(file)) {
    // For buffers - use upload stream
    result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(file);
    });
  } else {
    // For streams
    result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      (file as Readable).pipe(uploadStream);
    });
  }

  return {
    public_id: result.public_id,
    secure_url: result.secure_url,
    url: result.url,
    format: result.format,
    bytes: result.bytes,
  };
}

/**
 * Uploads a video from a local file path
 * @param filePath - Path to the video file
 * @param publicId - Public ID for the video (without extension)
 * @param options - Upload options
 */
export async function uploadVideoFromPath(
  filePath: string,
  publicId: string,
  options?: {
    folder?: string;
    overwrite?: boolean;
  }
): Promise<{
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  bytes: number;
}> {
  return uploadVideoToCloudinary(filePath, publicId, {
    resourceType: 'video',
    ...options,
  });
}

