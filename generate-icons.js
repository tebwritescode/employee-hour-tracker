// Simple icon generator for PWA
// This creates basic colored square icons with text
// For production, you'd want to use proper graphic design tools

const fs = require('fs');
const path = require('path');

// Create icons directory
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes needed
const iconSizes = [
    16, 32, 72, 76, 96, 120, 128, 144, 152, 180, 192, 384, 512
];

// Splash screen sizes for iOS
const splashSizes = [
    { width: 640, height: 1136 },   // iPhone 5/SE
    { width: 750, height: 1334 },   // iPhone 6/7/8
    { width: 828, height: 1792 },   // iPhone 11
    { width: 1125, height: 2436 },  // iPhone X/XS
    { width: 1170, height: 2532 },  // iPhone 12/13 Pro
    { width: 1242, height: 2208 },  // iPhone Plus
    { width: 1242, height: 2688 },  // iPhone XS Max
    { width: 1284, height: 2778 },  // iPhone 12/13 Pro Max
    { width: 1536, height: 2048 },  // iPad
    { width: 1668, height: 2388 },  // iPad Pro 11"
    { width: 2048, height: 2732 }   // iPad Pro 12.9"
];

// Generate SVG icon
function generateSVGIcon(size) {
    const fontSize = Math.floor(size * 0.25);
    const iconText = size >= 144 ? '⏰' : '⏰';
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle">${iconText}</text>
</svg>`;
}

// Generate splash screen SVG
function generateSplashSVG(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const iconSize = Math.min(width, height) * 0.15;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grad)"/>
    <circle cx="${centerX}" cy="${centerY - iconSize}" r="${iconSize}" fill="rgba(255,255,255,0.1)"/>
    <text x="${centerX}" y="${centerY - iconSize}" font-family="Arial, sans-serif" font-size="${iconSize * 0.8}" fill="white" text-anchor="middle" dominant-baseline="middle">⏰</text>
    <text x="${centerX}" y="${centerY + iconSize}" font-family="Arial, sans-serif" font-size="${iconSize * 0.3}" fill="white" text-anchor="middle" dominant-baseline="middle">Hour Tracker</text>
</svg>`;
}

console.log('Generating PWA icons...');

// Generate regular icons
iconSizes.forEach(size => {
    const svg = generateSVGIcon(size);
    const filename = `icon-${size}x${size}.svg`;
    fs.writeFileSync(path.join(iconsDir, filename), svg);
    console.log(`Generated ${filename}`);
});

// Generate splash screens
splashSizes.forEach(({ width, height }) => {
    const svg = generateSplashSVG(width, height);
    const filename = `splash-${width}x${height}.svg`;
    fs.writeFileSync(path.join(iconsDir, filename), svg);
    console.log(`Generated ${filename}`);
});

// Create a simple PNG version script instruction
const convertScript = `
# To convert SVG icons to PNG (requires ImageMagick):
cd public/icons

# Convert icons
${iconSizes.map(size => `magick icon-${size}x${size}.svg icon-${size}x${size}.png`).join('\n')}

# Convert splash screens
${splashSizes.map(({ width, height }) => `magick splash-${width}x${height}.svg splash-${width}x${height}.png`).join('\n')}

# Clean up SVG files if desired
# rm *.svg
`;

fs.writeFileSync(path.join(__dirname, 'convert-icons.sh'), convertScript);

console.log('✅ Icon generation complete!');
console.log('📁 Icons saved to public/icons/');
console.log('🔄 Run convert-icons.sh to generate PNG versions (requires ImageMagick)');
console.log('🚀 For production, consider using proper graphic design tools for better icons');