# Image Optimization Guide

## Why Optimize Images?

**Minification + WebP** provides the best results:
- **Minification**: 20-40% smaller PNG/JPG files
- **WebP**: Additional 26-34% compression vs optimized PNG/JPG
- **Combined**: Up to 60-70% total size reduction!

## Installation

```bash
npm install --save-dev sharp glob imagemin imagemin-pngquant imagemin-mozjpeg
```

## Usage

### Recommended: Full Optimization Pipeline

```bash
node scripts/optimize-images.js
```

This will:
- ✅ Minify PNG/JPG files in-place (pngquant + mozjpeg)
- ✅ Convert to WebP format
- ✅ Preserve original files (safe!)
- ✅ Skip already processed files
- ✅ Show detailed statistics

### Alternative: WebP Only (if already minified)

```bash
node scripts/convert-to-webp.js
```

This will:
- ✅ Convert all PNG/JPG to WebP
- ✅ Preserve original files (safe!)
- ✅ Skip already converted files
- ✅ Show detailed conversion statistics

### 2. Update your HTML/CSS to use WebP

Use the `<picture>` element with fallback:

```html
<picture>
  <source type="image/webp" srcset="assets/char/character.webp">
  <img src="assets/char/character.png" alt="Character" loading="lazy">
</picture>
```

For CSS background images:

```css
.hero {
  background-image: url('assets/bg.png');
  background-image: image-set(
    url('assets/bg.webp') type('image/webp'),
    url('assets/bg.png') type('image/png')
  );
}
```

### 3. Update your build process

The script preserves original files, so both formats are available:
- `.webp` - Modern browsers (97%+ support)
- `.png/.jpg` - Fallback for older browsers

## Configuration

Edit `scripts/optimize-images.js`:

```javascript
const CONFIG = {
  // Minification
  minify: {
    enabled: true,
    pngQuality: [0.7, 0.9], // 70-90% quality
    jpegQuality: 85,
  },

  // WebP conversion
  webp: {
    enabled: true,
    lossless: false,  // Use lossy for better compression
    quality: 85,
  },

  skipExisting: true,
  preserveOriginal: true,
};
```

To skip minification and only convert to WebP, set `minify.enabled: false`.

## Expected Results

**With full optimization (minify + WebP):**
- Character portraits: ~70-75% smaller
- Icons: ~60-65% smaller
- Disc images: ~65-70% smaller
- **Total bandwidth savings: ~65-70%**

**Example:**
```
Original PNG:     150 KB
After minify:      90 KB (40% smaller)
After WebP:        45 KB (70% total reduction!)
```

## Browser Support

WebP is supported by:
- ✅ Chrome/Edge (all versions)
- ✅ Firefox 65+
- ✅ Safari 14+ (Sep 2020)
- ✅ Mobile browsers (95%+)

Fallback automatically works for older browsers!