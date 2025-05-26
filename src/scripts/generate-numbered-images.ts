import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { FileWrapper } from 'square';
import { Readable } from 'stream';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = new Map<string, string>();

for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
        argMap.set(args[i].slice(2), args[i + 1]);
    }
}

// Configuration with command line overrides
const BASE_IMAGE_SIZE = parseInt(argMap.get('base-size') || '1800');
const FONT_SIZE = parseInt(argMap.get('font-size') || '750');
const OUTPUT_DIR = argMap.get('output-dir') || 'output';
const IMAGE_FORMAT = (argMap.get('format') || 'jpg').toLowerCase();
// Add timestamp for unique run folder
const RUN_TIMESTAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const OUTPUT_SUBDIR = path.join(OUTPUT_DIR, IMAGE_FORMAT, RUN_TIMESTAMP);
const TOTAL_IMAGES = parseInt(argMap.get('total-images') || '10');
const UPLOAD_BATCH_SIZE = parseInt(argMap.get('batch-size') || '5');

// Validate image format
const VALID_FORMATS = ['jpg', 'jpeg', 'png', 'gif'];
if (!VALID_FORMATS.includes(IMAGE_FORMAT)) {
    console.error(`Error: Invalid image format. Supported formats are: ${VALID_FORMATS.join(', ')}`);
    process.exit(1);
}

// Calculate padding length based on total images
const PADDING_LENGTH = TOTAL_IMAGES.toString().length;

// Validate required environment variables
const requiredEnvVars = ['AUTH_TOKEN'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: ${envVar} environment variable is required`);
        process.exit(1);
    }
}

// Print configuration
console.log('Configuration:');
console.log(`- Base Image Size: ${BASE_IMAGE_SIZE}px`);
console.log(`- Font Size: ${FONT_SIZE}px`);
console.log(`- Output Directory: ${OUTPUT_SUBDIR}`);
console.log(`- Total Images: ${TOTAL_IMAGES}`);
console.log(`- Upload Batch Size: ${UPLOAD_BATCH_SIZE}`);
console.log(`- Image Format: ${IMAGE_FORMAT}`);
console.log(`- Auto-calculated Padding Length: ${PADDING_LENGTH}\n`);

// Ensure output directory and subdirectory exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}
const formatDir = path.join(OUTPUT_DIR, IMAGE_FORMAT);
if (!fs.existsSync(formatDir)) {
    fs.mkdirSync(formatDir);
}
if (!fs.existsSync(OUTPUT_SUBDIR)) {
    fs.mkdirSync(OUTPUT_SUBDIR);
}

function getRandomSize(): number {
    // Random size between 1800 and 2200 pixels
    return Math.floor(Math.random() * 400) + BASE_IMAGE_SIZE;
}

function getRandomQuality(): number {
    // Random quality between 80 and 90
    return Math.floor(Math.random() * 10) + 80;
}

async function generateImage(number: number): Promise<Buffer> {
    const size = getRandomSize();
    const paddedNumber = number.toString().padStart(PADDING_LENGTH, '0');

    // Generate random shapes
    function randomColor() {
        return `rgb(${Math.floor(Math.random()*256)},${Math.floor(Math.random()*256)},${Math.floor(Math.random()*256)})`;
    }
    let shapes = '';
    // Add 10 random rectangles
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const w = Math.random() * (size * 0.2);
        const h = Math.random() * (size * 0.2);
        shapes += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${randomColor()}" fill-opacity="0.3"/>`;
    }
    // Add 10 random circles
    for (let i = 0; i < 10; i++) {
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        const r = Math.random() * (size * 0.1);
        shapes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${randomColor()}" fill-opacity="0.3"/>`;
    }
    // Add a random squiggle path
    let path = `M ${Math.random()*size} ${Math.random()*size}`;
    for (let i = 0; i < 5; i++) {
        path += ` Q ${Math.random()*size} ${Math.random()*size}, ${Math.random()*size} ${Math.random()*size}`;
    }
    shapes += `<path d="${path}" stroke="${randomColor()}" stroke-width="${size*0.01}" fill="none"/>`;

    // SVG noise filter
    const noiseFilter = `<filter id="noise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="turb"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
            <feFuncA type="linear" slope="0.15"/>
        </feComponentTransfer>
    </filter>`;

    const svg = `
        <svg width="${size}" height="${size}">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:rgb(255,255,255);stop-opacity:1" />
                    <stop offset="100%" style="stop-color:rgb(240,240,240);stop-opacity:1" />
                </linearGradient>
                ${noiseFilter}
            </defs>
            <rect width="100%" height="100%" fill="url(#grad1)"/>
            <rect width="100%" height="100%" filter="url(#noise)" fill="none"/>
            ${shapes}
            <text
                x="50%"
                y="50%"
                font-family="Arial"
                font-size="${FONT_SIZE}"
                fill="black"
                text-anchor="middle"
                dominant-baseline="middle"
                font-weight="bold"
            >${paddedNumber}</text>
            <circle cx="50%" cy="50%" r="${size * 0.4}" fill="none" stroke="black" stroke-width="${size * 0.01}"/>
            <circle cx="50%" cy="50%" r="${size * 0.45}" fill="none" stroke="black" stroke-width="${size * 0.005}"/>
            <circle cx="50%" cy="50%" r="${size * 0.5}" fill="none" stroke="black" stroke-width="${size * 0.002}"/>
        </svg>
    `;

    // Generate the image with format-specific settings
    let sharpInstance = sharp(Buffer.from(svg));
    
    switch (IMAGE_FORMAT) {
        case 'jpg':
        case 'jpeg':
            sharpInstance = sharpInstance.jpeg({
                quality: getRandomQuality(),
                chromaSubsampling: '4:4:4'
            });
            break;
        case 'png':
            sharpInstance = sharpInstance.png({
                compressionLevel: 0, // Minimum compression
                palette: true, // Enable palette mode for larger files
                colors: 256 // Maximum colors in palette
            });
            break;
        case 'gif':
            sharpInstance = sharpInstance.gif();
            break;
    }

    return sharpInstance.toBuffer();
}

async function generateAllImagesParallel(): Promise<string[]> {
    console.log(`Generating ${TOTAL_IMAGES} images in parallel...`);
    const imagePaths: string[] = [];
    const concurrency = 8;
    let current = 1;
    let completed = 0;

    async function worker() {
        while (true) {
            let i: number;
            // Lock for next image number
            if (current > TOTAL_IMAGES) break;
            i = current++;
            try {
                console.log(`Generating image ${i}/${TOTAL_IMAGES}...`);
                const imageBuffer = await generateImage(i);
                const paddedNumber = i.toString().padStart(PADDING_LENGTH, '0');
                const localPath = path.join(OUTPUT_SUBDIR, `image_${paddedNumber}.${IMAGE_FORMAT}`);
                await sharp(imageBuffer).toFile(localPath);
                imagePaths[i - 1] = localPath;
                completed++;
            } catch (error) {
                console.error(`Failed to generate image ${i}:`, error);
                throw error;
            }
        }
    }
    // Start workers
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    console.log('All images generated successfully!');
    return imagePaths;
}

async function main() {
    try {
        await generateAllImagesParallel();
    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nStopping image generation and upload...');
    process.exit(0);
});

// Start the process
main(); 