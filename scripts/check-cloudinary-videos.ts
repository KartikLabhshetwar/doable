/**
 * Script to check if videos exist in Cloudinary with correct Public IDs
 * 
 * Run with: npx tsx scripts/check-cloudinary-videos.ts
 */

import 'dotenv/config';
import { cloudinary } from '../lib/cloudinary-server';

const expectedPublicIds = [
  'doable',
  'feature-1-doable',
  'feature-2-doable',
  'feature-3-doable',
  'feature-4-doable',
  'feature-5-doable',
];

async function checkVideos() {
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    console.error('❌ NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set');
    process.exit(1);
  }

  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set');
    process.exit(1);
  }

  console.log('🔍 Checking videos in Cloudinary...\n');
  console.log(`Cloud Name: ${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}\n`);

  // List all videos in Cloudinary
  try {
    // Use admin API to list resources
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'video',
      max_results: 100,
    });

    console.log(`📹 Found ${result.resources?.length || 0} videos in Cloudinary:\n`);

    const foundPublicIds = new Set<string>();
    
    result.resources?.forEach((resource: any) => {
      foundPublicIds.add(resource.public_id);
      console.log(`  ✅ ${resource.public_id}`);
      console.log(`     URL: ${resource.secure_url}`);
      console.log(`     Format: ${resource.format || 'N/A'}`);
      console.log(`     Size: ${resource.bytes ? (resource.bytes / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}\n`);
    });

    console.log('\n📋 Checking expected Public IDs:\n');
    
    let missingCount = 0;
    expectedPublicIds.forEach((expectedId) => {
      if (foundPublicIds.has(expectedId)) {
        console.log(`  ✅ ${expectedId} - EXISTS`);
      } else {
        console.log(`  ❌ ${expectedId} - NOT FOUND`);
        missingCount++;
        
        // Check for common variations
        const variations = [
          `${expectedId}.mp4`,
          `videos/${expectedId}`,
          `public/${expectedId}`,
          expectedId.replace('-', '_'),
          expectedId.toUpperCase(),
        ];
        
        const foundVariation = variations.find(v => foundPublicIds.has(v));
        if (foundVariation) {
          console.log(`     ⚠️  Found similar: ${foundVariation} (but expected: ${expectedId})`);
        }
      }
    });

    console.log('\n📊 Summary:');
    console.log(`   Expected: ${expectedPublicIds.length}`);
    console.log(`   Found: ${expectedPublicIds.length - missingCount}`);
    console.log(`   Missing: ${missingCount}`);

    if (missingCount > 0) {
      console.log('\n❌ Some videos are missing or have wrong Public IDs!');
      console.log('\n💡 Solutions:');
      console.log('   1. Check Cloudinary Media Library for exact Public IDs');
      console.log('   2. Rename videos in Cloudinary to match expected Public IDs');
      console.log('   3. Or update the code to use the actual Public IDs from Cloudinary');
    } else {
      console.log('\n✅ All videos found with correct Public IDs!');
    }

  } catch (error: any) {
    console.error('❌ Error checking videos:', error.message);
    console.error('\n💡 Make sure your API credentials are correct and have read permissions.');
  }
}

checkVideos().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

