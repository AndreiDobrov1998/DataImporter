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
    .option('images', {
        alias: 'i',
        type: 'string',
        description: 'Comma-separated list of specific images to regenerate (e.g., "Image01,Image02")'
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

// Add this function after the logWithTimestamp function
let imageCounter = 0;

function generateUniqueSeed(): string {
    const timestamp = Date.now();
    const counter = imageCounter++;
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const uniqueId = uuidv4();
    return `${timestamp}-${counter}-${randomBytes}-${uniqueId}`;
}

function generatePaddedImageId(index: number, totalCount: number): string {
    const paddingLength = Math.ceil(Math.log10(totalCount));
    return `Image${(index + 1).toString().padStart(paddingLength, '0')}`;
}

async function downloadImage(imageUrl: string, retryCount = 0): Promise<Buffer> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    try {
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
        return imageResponse.data;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            logWithTimestamp(`Error downloading image: ${error}. Retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`, 'warn');
            await delay(RETRY_DELAY * Math.pow(2, retryCount));
            return downloadImage(imageUrl, retryCount + 1);
        }
        throw error;
    }
}

// Function to generate and upload a single image
async function generateAndUploadImage(imageId: string, catalogClient: SquareManager, retryCount = 0): Promise<string> {
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 2000;
    
    logWithTimestamp(`Starting image processing for ${imageId}${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}`);
    
    const format = 'jpeg';
    const maxWidth = 800;
    const maxHeight = 800;
    const quality = 80;
    
    const seed = generateUniqueSeed();
    const imageUrl = `https://picsum.photos/seed/${seed}/${maxWidth}/${maxHeight}`;
    
    const tempDir = path.join(process.cwd(), 'temp_images');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    const tempImagePath = path.join(tempDir, `${imageId}.${format}`);
    
    try {
        const imageBuffer = await downloadImage(imageUrl);

        // Add random pixels at the beginning of the image
        const randomPixels = new Uint8Array(300); // 100 pixels * 3 channels (RGB)
        for (let i = 0; i < randomPixels.length; i++) {
            randomPixels[i] = Math.floor(Math.random() * 256);
        }
        
        // Combine random pixels with original image
        const combinedBuffer = Buffer.concat([Buffer.from(randomPixels), Buffer.from(imageBuffer)]);
        
        // Process image with sharp
        const processedBuffer = await sharp(combinedBuffer)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .withMetadata({
                exif: {
                    IFD0: {
                        Copyright: 'Square Catalog',
                        ImageDescription: `Generated image for ${imageId}`,
                        Software: 'Square Order Generator',
                        Make: 'Square Generator',
                        Model: `Model-${seed.substring(0, 8)}`,
                        DateTime: new Date().toISOString()
                    },
                    IFD1: {
                        DateTimeOriginal: new Date().toISOString(),
                        UserComment: `Unique seed: ${seed}`,
                        ImageUniqueID: `${uuidv4()}-${crypto.randomBytes(16).toString('hex')}-${Date.now()}-${imageCounter}`,
                        GPSLatitude: [Math.random() * 90].toString(),
                        GPSLongitude: [Math.random() * 180].toString(),
                        GPSAltitude: [Math.random() * 1000].toString()
                    }
                }
            })
            .jpeg({ quality })
            .toBuffer();
        
        fs.writeFileSync(tempImagePath, processedBuffer);
        
        const imageStream = fs.createReadStream(tempImagePath);
        const fileWrapper = new FileWrapper(imageStream, { filename: path.basename(tempImagePath) });
        
        // Generate a new Square object ID for the image
        const imageObjectId = `#Image${uuidv4()}`;
        
        const numericName = imageId.replace('Image', '');
        const uploadResponse = await catalogClient.client.catalogApi.createCatalogImage(
            {
                idempotencyKey: uuidv4(),
                image: {
                    type: 'IMAGE',
                    id: imageObjectId,
                    imageData: {
                        name: numericName,
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
        if (retryCount < MAX_RETRIES) {
            const isRateLimit = error?.response?.status === 429;
            const isServerError = error?.response?.status >= 500;
            const isTimeout = error?.code === 'ECONNABORTED';
            
            if (isRateLimit || isServerError || isTimeout) {
                const delayTime = RETRY_DELAY * Math.pow(2, retryCount);
                logWithTimestamp(`Error for ${imageId} (${error?.response?.status || error?.code}), retrying after ${delayTime}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`, 'warn');
                await delay(delayTime);
                return generateAndUploadImage(imageId, catalogClient, retryCount + 1);
            }
        }
        logWithTimestamp(`Error processing/uploading image for ${imageId}: ${error}`, 'error');
        throw error;
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

// Add function to delete image
async function deleteImage(imageId: string, squareManager: SquareManager): Promise<boolean> {
    const maxRetries = 3;
    let retries = 0;
    while (retries < maxRetries) {
        try {
            await squareManager.client.catalogApi.deleteCatalogObject(imageId);
            console.log(`Successfully deleted image ${imageId}`);
            return true;
        } catch (error: unknown) {
            console.error(`Failed to delete image ${imageId}: ${(error as Error).message}`);
            retries++;
            if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }
    }
    return false;
}

// Modify the validation function to check name instead of title
async function validateAndRegenerateImages(squareManager: SquareManager): Promise<void> {
    console.log('Starting validation of generated images...');
    const images = await squareManager.client.catalogApi.searchCatalogObjects({ objectTypes: ['IMAGE'] });
    console.log(`Retrieved total of ${images.result?.objects?.length || 0} images from catalog`);

    const imageMap = new Map(images.result?.objects?.map((img: any) => [img.id, img]) || []);
    const incorrectImages = [];

    for (const [id, image] of imageMap.entries()) {
        const expectedName = id.replace('#', '');
        if ((image as any).imageData?.name !== expectedName) {
            console.warn(`Image ${id} has incorrect or missing name. Expected: ${expectedName}, Got: ${(image as any).imageData?.name}`);
            incorrectImages.push(id);
        }
    }

    if (incorrectImages.length > 0) {
        console.log(`Found ${incorrectImages.length} images with incorrect or missing names. Regenerating...`);
        console.log('Deleting old images before regeneration...');
        
        // Delete images in sequence to avoid race conditions
        for (const id of incorrectImages) {
            await deleteImage(id as string, squareManager);
        }
        console.log('Finished deleting old images');

        // Regenerate images in sequence to maintain order
        const results = [];
        for (const id of incorrectImages) {
            try {
                const newId = await generateAndUploadImage(id as string, squareManager);
                results.push({ status: 'fulfilled', value: newId });
            } catch (error) {
                results.push({ status: 'rejected', reason: error });
            }
        }

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`Regeneration complete: ${succeeded} succeeded, ${failed} failed`);
    } else {
        console.log('All images have correct names.');
    }
}

// Add new function to regenerate specific images
async function regenerateSpecificImages(imageIds: string[], catalogClient: SquareManager) {
    logWithTimestamp(`Starting regeneration of specific images: ${imageIds.join(', ')}`);
    
    const imageData: { id: string; title: string }[] = [];
    
    // Generate images in parallel with rate limiting
    const imagePromises = imageIds.map(title => 
        limit(() => generateAndUploadImage(title, catalogClient)
            .then(id => ({ id, title }))
        )
    );
    
    const results = await Promise.allSettled(imagePromises);
    
    // Process results
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            imageData.push(result.value);
            logWithTimestamp(`Successfully regenerated image ${result.value.title}`);
        } else {
            logWithTimestamp(`Failed to regenerate image ${imageIds[index]}: ${result.reason}`, 'error');
        }
    });
    
    logWithTimestamp(`Successfully regenerated ${imageData.length} out of ${imageIds.length} images`);
    
    // Save image IDs and titles to a file for later use
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    
    fs.writeFileSync(
        path.join(outputDir, 'generated_image_ids.json'),
        JSON.stringify(imageData, null, 2)
    );
    
    logWithTimestamp(`Image IDs and titles saved to output/generated_image_ids.json`);
    
    // Call validation and regeneration after generating images
    await validateAndRegenerateImages(catalogClient);
}

// Add function to count catalog items
async function countCatalogItems(catalogClient: SquareManager): Promise<number> {
    let totalCount = 0;
    let cursor: string | undefined;
    
    try {
        logWithTimestamp('Counting existing catalog items...');
        
        do {
            const response = await catalogClient.client.catalogApi.searchCatalogObjects({
                objectTypes: ['IMAGE'],
                cursor: cursor
            });
            
            if (response.result?.objects) {
                totalCount += response.result.objects.length;
            }
            
            cursor = response.result?.cursor;
            if (cursor) {
                logWithTimestamp(`Counted ${totalCount} items so far, continuing...`);
            }
        } while (cursor);

        logWithTimestamp(`Total catalog items: ${totalCount}`);
        return totalCount;
    } catch (error) {
        logWithTimestamp(`Error counting catalog items: ${error}`, 'error');
        throw error;
    }
}

// New function: Validate that all imported image IDs are present in the catalog
async function validateImportedImageIds(catalogClient: SquareManager) {
    const outputPath = path.join(process.cwd(), 'output', 'generated_image_ids.json');
    if (!fs.existsSync(outputPath)) {
        logWithTimestamp('No generated_image_ids.json found for validation', 'warn');
        return;
    }
    const imported = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    const importedIds = imported.map((item: any) => item.id);

    // List all images in the catalog
    let allCatalogIds: string[] = [];
    let cursor: string | undefined = undefined;
    do {
        const response = await catalogClient.client.catalogApi.searchCatalogObjects({ objectTypes: ['IMAGE'], cursor });
        const ids = (response.result.objects || []).map((img: any) => img.id);
        allCatalogIds.push(...ids);
        cursor = response.result.cursor;
    } while (cursor);

    // Check for missing IDs
    let missing = importedIds.filter((id: string) => !allCatalogIds.includes(id));
    if (missing.length === 0) {
        logWithTimestamp('✅ All imported image IDs are present in the catalog');
    } else {
        logWithTimestamp(`❌ Missing ${missing.length} image IDs in catalog: ${missing.join(', ')}`, 'error');
        // Regenerate missing images
        for (const missingId of missing) {
            const entry = imported.find((item: any) => item.id === missingId);
            if (entry) {
                logWithTimestamp(`Regenerating missing image: ${missingId} with title: ${entry.title}`);
                try {
                    await generateAndUploadImage(entry.title, catalogClient);
                    logWithTimestamp(`Successfully regenerated image: ${missingId}`);
                } catch (err) {
                    logWithTimestamp(`Failed to regenerate image: ${missingId} - ${err}`, 'error');
                }
            }
        }
        // Re-list and re-validate
        allCatalogIds = [];
        cursor = undefined;
        do {
            const response = await catalogClient.client.catalogApi.searchCatalogObjects({ objectTypes: ['IMAGE'], cursor });
            const ids = (response.result.objects || []).map((img: any) => img.id);
            allCatalogIds.push(...ids);
            cursor = response.result.cursor;
        } while (cursor);
        missing = importedIds.filter((id: string) => !allCatalogIds.includes(id));
        if (missing.length === 0) {
            logWithTimestamp('✅ All imported image IDs are present in the catalog after regeneration');
        } else {
            logWithTimestamp(`❌ Still missing ${missing.length} image IDs after regeneration: ${missing.join(', ')}`, 'error');
        }
    }
    logWithTimestamp(`Validation complete. Imported: ${importedIds.length}, Found in catalog: ${allCatalogIds.length}, Missing: ${missing.length}`);
}

// 1. Generate all images to a temp folder
async function generateImagesToTempFolder(count: number, tempDir: string): Promise<string[]> {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    const imagePaths: string[] = [];
    for (let i = 0; i < count; i++) {
        const imageId = generatePaddedImageId(i, count);
        logWithTimestamp(`[GENERATION] Starting generation for ${imageId}`);
        const format = 'jpeg';
        const maxWidth = 800;
        const maxHeight = 800;
        const quality = 80;
        const seed = generateUniqueSeed();
        const imageUrl = `https://picsum.photos/seed/${seed}/${maxWidth}/${maxHeight}`;
        const tempImagePath = path.join(tempDir, `${imageId}.${format}`);
        try {
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            const processedBuffer = await sharp(imageResponse.data)
                .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality })
                .toBuffer();
            fs.writeFileSync(tempImagePath, processedBuffer);
            imagePaths.push(tempImagePath);
            logWithTimestamp(`[GENERATION] Successfully generated and saved: ${tempImagePath}`);
        } catch (error) {
            logWithTimestamp(`[GENERATION] Failed to generate image ${imageId}: ${error}`, 'error');
        }
    }
    logWithTimestamp(`[GENERATION] Finished generating ${imagePaths.length} out of ${count} images.`);
    return imagePaths;
}

// 2. Upload all images from the temp folder to Square
async function uploadImagesFromTempFolder(imagePaths: string[], catalogClient: SquareManager): Promise<{ id: string, title: string }[]> {
    const imageData: { id: string, title: string }[] = [];
    for (const imagePath of imagePaths) {
        const title = path.basename(imagePath, path.extname(imagePath));
        logWithTimestamp(`[UPLOAD] Starting upload for ${title}`);
        try {
            const imageStream = fs.createReadStream(imagePath);
            const fileWrapper = new FileWrapper(imageStream, { filename: path.basename(imagePath) });
            const imageObjectId = `#Image${uuidv4()}`;
            const numericName = title.replace('Image', '');
            const uploadResponse = await catalogClient.client.catalogApi.createCatalogImage(
                {
                    idempotencyKey: uuidv4(),
                    image: {
                        type: 'IMAGE',
                        id: imageObjectId,
                        imageData: {
                            name: numericName,
                            caption: 'Generated image'
                        }
                    }
                },
                fileWrapper
            );
            if (uploadResponse.result?.image?.id) {
                const responseTitle = uploadResponse.result.image.imageData?.name;
                if (responseTitle === numericName) {
                    imageData.push({ id: uploadResponse.result.image.id, title });
                    logWithTimestamp(`[UPLOAD] Successfully uploaded: ${title} as ${uploadResponse.result.image.id}`);
                } else {
                    logWithTimestamp(`[UPLOAD] Title mismatch for ${title}. Expected: ${numericName}, Got: ${responseTitle}. Regenerating...`, 'warn');
                    // Regenerate the image
                    const regeneratedId = await generateAndUploadImage(title, catalogClient);
                    imageData.push({ id: regeneratedId, title });
                    logWithTimestamp(`[UPLOAD] Successfully regenerated and uploaded: ${title} as ${regeneratedId}`);
                }
            } else {
                logWithTimestamp(`[UPLOAD] No image ID returned for ${title}`, 'error');
            }
        } catch (error) {
            logWithTimestamp(`[UPLOAD] Failed to upload image ${title}: ${error}`, 'error');
        }
    }
    logWithTimestamp(`[UPLOAD] Finished uploading ${imageData.length} out of ${imagePaths.length} images.`);
    return imageData;
}

// Refactored main function
async function generateImages() {
    const catalogClient = new SquareManager();
    try {
        // 1. Count images at the start
        const initialCount = await countCatalogItems(catalogClient);
        logWithTimestamp(`Catalog images at start: ${initialCount}`);

        const count = argv.count;
        const tempDir = path.join(process.cwd(), 'temp_images');
        logWithTimestamp(`Generating ${count} images to temp folder...`);
        const imagePaths = await generateImagesToTempFolder(count, tempDir);
        logWithTimestamp(`Uploading ${imagePaths.length} images to Square...`);
        const imageData = await uploadImagesFromTempFolder(imagePaths, catalogClient);
        // Save image IDs and titles to a file for later use
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        fs.writeFileSync(
            path.join(outputDir, 'generated_image_ids.json'),
            JSON.stringify(imageData, null, 2)
        );
        logWithTimestamp(`Image IDs and titles saved to output/generated_image_ids.json`);

        // 2. Count images at the end
        const finalCount = await countCatalogItems(catalogClient);
        logWithTimestamp(`Catalog images at end: ${finalCount}`);

        // 3. Validate the number of imported images
        if (imageData.length === count) {
            logWithTimestamp(`✅ Imported image count matches expected: ${imageData.length}`);
        } else {
            logWithTimestamp(`❌ Imported image count mismatch. Expected: ${count}, Actual: ${imageData.length}`, 'error');
        }
    } catch (error: any) {
        logWithTimestamp(`Error generating images: ${error?.message || error}`, 'error');
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