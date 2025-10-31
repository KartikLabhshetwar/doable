/**
 * SERVER-ONLY Cloudinary configuration
 * This file should only be imported in server-side code (API routes, server actions, etc.)
 * Do NOT import this in client components
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Export cloudinary instance for server-side operations (upload, etc.)
export { cloudinary };

