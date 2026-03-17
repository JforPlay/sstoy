/**
 * Complete Image Optimization Script
 * Step 1: Minify PNG/JPG with pngquant/mozjpeg
 * Step 2: Convert to WebP for modern browsers
 *
 * Install dependencies:
 * npm install --save-dev sharp glob imagemin imagemin-pngquant imagemin-mozjpeg
 *
 * Run:
 * node scripts/optimize-images.js
 */

import sharp from 'sharp';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import imageminMozjpeg from 'imagemin-mozjpeg';
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs/promises';

// Configuration
const CONFIG = {
  inputDirs: [
    'public/assets/*.{png,jpg,jpeg}', // Root assets folder (notes, element icons, etc.)
    'public/assets/char/**/*.{png,jpg,jpeg}',
    'public/assets/disc_icons/**/*.{png,jpg,jpeg}',
    'public/assets/skill_icons/**/*.{png,jpg,jpeg}',
    'public/assets/others/**/*.{png,jpg,jpeg}',
    'public/assets/items/**/*.{png,jpg,jpeg}',
    'public/assets/buildrank/**/*.{png,jpg,jpeg}',
    'public/assets/dating/**/*.{png,jpg,jpeg}',
    'public/assets/talent_icons/**/*.{png,jpg,jpeg}'
  ],

  // Minification settings
  minify: {
    enabled: true,
    pngQuality: [0.7, 0.9], // 70-90% quality for PNG
    jpegQuality: 85,        // 85% quality for JPEG
  },

  // WebP conversion settings
  webp: {
    enabled: true,
    lossless: false,        // Use lossy WebP (better compression)
    quality: 85,            // 85% quality for WebP
  },

  skipExisting: true,       // Skip if output already exists
  preserveOriginal: true,   // Keep original files
  verbose: true,
};

/**
 * Step 1: Minify PNG/JPG in place
 */
async function minifyImage(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();

  try {
    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    // Read original file
    const buffer = await fs.readFile(inputPath);

    // Minify based on format
    let minified;
    if (ext === '.png') {
      minified = await imagemin.buffer(buffer, {
        plugins: [
          imageminPngquant({
            quality: CONFIG.minify.pngQuality,
            speed: 1, // Slower but better compression
          })
        ]
      });
    } else if (ext === '.jpg' || ext === '.jpeg') {
      minified = await imagemin.buffer(buffer, {
        plugins: [
          imageminMozjpeg({
            quality: CONFIG.minify.jpegQuality,
            progressive: true,
          })
        ]
      });
    } else {
      return { status: 'skipped', reason: 'unsupported format' };
    }

    // Only overwrite if smaller
    if (minified.length < originalSize) {
      await fs.writeFile(inputPath, minified);
      const savings = ((originalSize - minified.length) / originalSize * 100).toFixed(1);

      if (CONFIG.verbose) {
        console.log(`🗜️  Minified: ${path.basename(inputPath)}`);
        console.log(`   ${(originalSize / 1024).toFixed(2)}KB → ${(minified.length / 1024).toFixed(2)}KB (${savings}% smaller)`);
      }

      return {
        status: 'minified',
        inputPath,
        originalSize,
        minifiedSize: minified.length,
        savings: parseFloat(savings)
      };
    } else {
      if (CONFIG.verbose) {
        console.log(`⏭️  No minify gain: ${path.basename(inputPath)}`);
      }
      return { status: 'skipped', reason: 'no size reduction' };
    }
  } catch (error) {
    console.error(`❌ Failed to minify: ${inputPath}`);
    console.error(`   Error: ${error.message}`);
    return { status: 'failed', inputPath, error: error.message };
  }
}

/**
 * Step 2: Convert to WebP
 */
async function convertToWebP(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const outputPath = inputPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');

  // Check if WebP already exists
  if (CONFIG.skipExisting) {
    try {
      await fs.access(outputPath);
      if (CONFIG.verbose) {
        console.log(`⏭️  WebP exists: ${path.basename(outputPath)}`);
      }
      return { status: 'skipped', reason: 'already exists' };
    } catch {
      // File doesn't exist, continue
    }
  }

  try {
    const inputStats = await fs.stat(inputPath);
    const inputSize = inputStats.size;

    // Convert to WebP
    await sharp(inputPath)
      .webp({
        lossless: CONFIG.webp.lossless,
        quality: CONFIG.webp.quality,
        effort: 6, // Higher effort for better compression (0-6)
      })
      .toFile(outputPath);

    const outputStats = await fs.stat(outputPath);
    const outputSize = outputStats.size;
    const savings = ((inputSize - outputSize) / inputSize * 100).toFixed(1);

    if (CONFIG.verbose) {
      console.log(`✅ WebP: ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
      console.log(`   ${(inputSize / 1024).toFixed(2)}KB → ${(outputSize / 1024).toFixed(2)}KB (${savings}% smaller)`);
    }

    return {
      status: 'converted',
      inputPath,
      outputPath,
      inputSize,
      outputSize,
      savings: parseFloat(savings)
    };
  } catch (error) {
    console.error(`❌ Failed to convert: ${inputPath}`);
    console.error(`   Error: ${error.message}`);
    return { status: 'failed', inputPath, error: error.message };
  }
}

/**
 * Main optimization pipeline
 */
async function main() {
  console.log('🚀 Starting Image Optimization Pipeline...\n');
  console.log('📁 Scanning directories...');

  // Gather all files
  const allFiles = [];
  for (const pattern of CONFIG.inputDirs) {
    // Glob v10+ returns path strings directly with unix separators, which is what we want
    const files = globSync(pattern, { nodir: true });
    allFiles.push(...files);
  }

  console.log(`📸 Found ${allFiles.length} images to process\n`);

  // const uniqueFiles = [...new Set(allFiles)];
  // const targetFiles = [];

  // for (const file of uniqueFiles) {
  //   const outputPath = file.replace(/\.png$/i, '.webp');

  //   try {
  //     await fs.access(outputPath);
  //     if (CONFIG.verbose) {
  //       console.log(`⏭️  Skip (webp exists): ${path.basename(file)}`);
  //     }
  //   } catch {
  //     targetFiles.push(file);
  //   }
  // }

  // console.log(`📸 Found ${targetFiles.length} PNG images without WebP\n`);

  if (allFiles.length === 0) {
    console.log('⚠️  No images found. Check your paths.');
    return;
  }

  // Step 1: Minify
  const minifyResults = [];
  if (CONFIG.minify.enabled) {
    console.log('━'.repeat(50));
    console.log('STEP 1: Minifying images...');
    console.log('━'.repeat(50) + '\n');

    for (const file of allFiles) {
      const result = await minifyImage(file);
      minifyResults.push(result);
    }
  }

  // Step 2: Convert to WebP
  const webpResults = [];
  if (CONFIG.webp.enabled) {
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 2: Converting to WebP...');
    console.log('━'.repeat(50) + '\n');

    for (const file of allFiles) {
      const result = await convertToWebP(file);
      webpResults.push(result);
    }
  }

  // Summary
  console.log('\n' + '━'.repeat(50));
  console.log('📊 OPTIMIZATION SUMMARY');
  console.log('━'.repeat(50));

  if (CONFIG.minify.enabled) {
    const minified = minifyResults.filter(r => r.status === 'minified');
    const minifySkipped = minifyResults.filter(r => r.status === 'skipped');
    const minifyFailed = minifyResults.filter(r => r.status === 'failed');

    console.log('\n🗜️  MINIFICATION:');
    console.log(`   Optimized: ${minified.length}`);
    console.log(`   Skipped:   ${minifySkipped.length}`);
    console.log(`   Failed:    ${minifyFailed.length}`);

    if (minified.length > 0) {
      const totalOriginal = minified.reduce((sum, r) => sum + r.originalSize, 0);
      const totalMinified = minified.reduce((sum, r) => sum + r.minifiedSize, 0);
      const totalSavings = ((totalOriginal - totalMinified) / totalOriginal * 100).toFixed(1);

      console.log(`   Saved: ${((totalOriginal - totalMinified) / 1024 / 1024).toFixed(2)} MB (${totalSavings}%)`);
    }
  }

  if (CONFIG.webp.enabled) {
    const converted = webpResults.filter(r => r.status === 'converted');
    const webpSkipped = webpResults.filter(r => r.status === 'skipped');
    const webpFailed = webpResults.filter(r => r.status === 'failed');

    console.log('\n📦 WEBP CONVERSION:');
    console.log(`   Converted: ${converted.length}`);
    console.log(`   Skipped:   ${webpSkipped.length}`);
    console.log(`   Failed:    ${webpFailed.length}`);

    if (converted.length > 0) {
      const totalInput = converted.reduce((sum, r) => sum + r.inputSize, 0);
      const totalOutput = converted.reduce((sum, r) => sum + r.outputSize, 0);
      const totalSavings = ((totalInput - totalOutput) / totalInput * 100).toFixed(1);

      console.log(`   Saved: ${((totalInput - totalOutput) / 1024 / 1024).toFixed(2)} MB (${totalSavings}%)`);
    }
  }

  console.log('\n✨ Optimization complete!\n');
}

main().catch(console.error);
