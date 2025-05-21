import { v4 as uuidv4 } from 'uuid';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { FileWrapper } from 'square';
import sharp from 'sharp';
import pLimit from 'p-limit';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['AUTH_TOKEN'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: ${envVar} environment variable is required`);
        process.exit(1);
    }
}

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
    .option('count', {
        alias: 'c',
        type: 'number',
        description: 'Number of images to generate',
        default: 10
    })
    .help()
    .argv as any;

// Add this function near the top of the file, after imports
function logWithTimestamp(message: string, type: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

// Increase concurrency for image uploads
const limit = pLimit(10); 

// Add rate limiting for image downloads
const downloadLimit = pLimit(3); // Limit concurrent downloads to 3

// Add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to generate and upload a single image
async function generateAndUploadImage(imageId: string, catalogClient: SquareManager): Promise<string> {
    logWithTimestamp(`Starting image processing for ${imageId}`);
    
    // Use fixed parameters for faster processing
    const format = 'jpeg';
    const maxWidth = 800;
    const maxHeight = 800;
    const quality = 80;
    
    // Use Picsum for random images
    const seed = crypto.randomBytes(8).toString('hex');
    const imageUrl = `https://picsum.photos/seed/${seed}/${maxWidth}/${maxHeight}`;
    
    const tempDir = path.join(process.cwd(), 'temp_images');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    const tempImagePath = path.join(tempDir, `${imageId}.${format}`);
    
    try {
        // Download and process image in one step with rate limiting
        const imageResponse = await downloadLimit(async () => {
            await delay(1000); // Add 1s delay between requests
            return axios.get(imageUrl, { 
                responseType: 'arraybuffer',
                timeout: 5000
            });
        });

        // Process image with sharp
        const processedBuffer = await sharp(imageResponse.data)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality })
            .toBuffer();

        // Save to temporary file
        fs.writeFileSync(tempImagePath, processedBuffer);
        
        // Upload to Square
        const imageStream = fs.createReadStream(tempImagePath);
        const fileWrapper = new FileWrapper(imageStream, { filename: path.basename(tempImagePath) });
        const uploadResponse = await catalogClient.client.catalogApi.createCatalogImage(
            {
                idempotencyKey: uuidv4(),
                image: {
                    type: 'IMAGE',
                    id: `#Image${uuidv4()}`,
                    imageData: {
                        name: path.basename(tempImagePath),
                        caption: 'Generated image'
                    }
                }
            },
            fileWrapper
        );

        if (!uploadResponse.result?.image?.id) {
            throw new Error('No image ID returned');
        }

        return uploadResponse.result.image.id;
    } catch (error: any) {
        if (error?.response?.status === 429) {
            logWithTimestamp(`Rate limit hit for ${imageId}, retrying after delay...`, 'warn');
            await delay(2000); // Wait 2s before retry
            return generateAndUploadImage(imageId, catalogClient);
        }
        logWithTimestamp(`Error processing/uploading image for ${imageId}: ${error}`, 'error');
        throw error;
    } finally {
        // Clean up temporary file
        try {
            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }
        } catch (cleanupError) {
            // Ignore cleanup errors
        }
    }
}

// Add cleanup function for the entire temp directory
async function cleanupTempDirectory() {
    const tempDir = path.join(process.cwd(), 'temp_images');
    try {
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                fs.unlinkSync(path.join(tempDir, file));
            }
            fs.rmdirSync(tempDir);
            logWithTimestamp('Cleaned up temporary images directory');
        }
    } catch (error) {
        logWithTimestamp(`Warning: Failed to clean up temporary images directory: ${error instanceof Error ? error.message : String(error)}`, 'warn');
    }
}

async function generateImages() {
    const catalogClient = new SquareManager();
    try {
        logWithTimestamp(`Starting image generation. Will generate ${argv.count} images. Press Ctrl+C to stop.`);
        
        const imageIds: string[] = [];
        
        // Generate images in parallel with rate limiting
        const imagePromises = Array.from({ length: argv.count }, (_, i) => 
            limit(() => generateAndUploadImage(`Image${i + 1}`, catalogClient))
        );
        
        const results = await Promise.allSettled(imagePromises);
        
        // Process results
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                imageIds.push(result.value);
                logWithTimestamp(`Successfully generated image ${index + 1}`);
            } else {
                logWithTimestamp(`Failed to generate image ${index + 1}: ${result.reason}`, 'error');
            }
        });
        
        logWithTimestamp(`Successfully generated ${imageIds.length} out of ${argv.count} images`);
        
        // Save image IDs to a file for later use
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        
        fs.writeFileSync(
            path.join(outputDir, 'generated_image_ids.json'),
            JSON.stringify(imageIds, null, 2)
        );
        
        logWithTimestamp(`Image IDs saved to output/generated_image_ids.json`);
        
    } catch (error: any) {
        logWithTimestamp(`Error generating images: ${error?.message || error}`, 'error');
        if (error?.response) {
            try {
                const errorResponse = error.response.data || error.response.body || error.response;
                logWithTimestamp(`Square API error response: ${JSON.stringify(errorResponse, null, 2)}`, 'error');
                if (error.response.status) {
                    logWithTimestamp(`Status code: ${error.response.status}`, 'error');
                }
            } catch (e) {
                logWithTimestamp(`Raw error response: ${error.response}`, 'error');
            }
        } else {
            logWithTimestamp(`Full error object: ${JSON.stringify(error, null, 2)}`, 'error');
        }
        process.exit(1);
    } finally {
        await cleanupTempDirectory();
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    logWithTimestamp('\nStopping image generation...');
    await cleanupTempDirectory();
    process.exit(0);
});

// Start generating images
generateImages(); 