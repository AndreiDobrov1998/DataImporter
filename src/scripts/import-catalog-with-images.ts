import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CatalogObject } from 'square';
import crypto from 'crypto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { FileWrapper } from 'square';
import sharp from 'sharp';
import pLimit from 'p-limit';

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
    .option('categories', {
        alias: 'c',
        type: 'number',
        description: 'Number of categories to import',
        default: 3
    })
    .option('items', {
        alias: 'i',
        type: 'number',
        description: 'Number of items per category',
        default: 10
    })
    .option('modifier-groups', {
        alias: 'g',
        type: 'number',
        description: 'Number of modifier groups to create',
        default: 3
    })
    .option('modifiers-per-group', {
        alias: 'm',
        type: 'number',
        description: 'Number of modifiers per group',
        default: 5
    })
    .help()
    .argv as any;

// List of possible LoremFlickr tags for variety
const loremFlickrTags = [
    'food', 'drink', 'coffee', 'pizza', 'burger', 'sushi', 'pasta', 'salad',
    'dessert', 'cake', 'icecream', 'fruit', 'vegetable', 'meat', 'seafood',
    'breakfast', 'lunch', 'dinner', 'snack', 'bakery', 'restaurant', 'cafe',
    'bar', 'wine', 'beer', 'cocktail', 'juice', 'tea', 'smoothie', 'sandwich'
];

// Add this function near the top of the file, after imports
function logWithTimestamp(message: string, type: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

// Function to download and save image
async function downloadAndSaveImage(
    imageUrl: string, 
    itemId: string, 
    maxSizeMB: number = 5,
    targetFormat: 'jpeg' | 'png' | 'webp' = 'jpeg',
    maxWidth: number = 1200,
    maxHeight: number = 1200,
    quality: number = 80
): Promise<string> {
    try {
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'arraybuffer'
        });

        const imagesDir = path.join(process.cwd(), 'images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir);
        }

        // Process image with sharp
        const processedImage = await sharp(response.data)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toFormat(targetFormat, { quality });

        const imageBuffer = await processedImage.toBuffer();
        const imageSizeMB = imageBuffer.length / (1024 * 1024);

        if (imageSizeMB > maxSizeMB) {
            console.warn(`Warning: Image for item ${itemId} is ${imageSizeMB.toFixed(2)}MB, which exceeds the maximum size of ${maxSizeMB}MB`);
        }

        const imagePath = path.join(imagesDir, `${itemId}.${targetFormat}`);
        fs.writeFileSync(imagePath, imageBuffer);

        // Log image details
        console.log(`Image for item ${itemId}: Size=${imageSizeMB.toFixed(2)}MB, Format=${targetFormat.toUpperCase()}, Quality=${quality}%`);
        
        return imagePath;
    } catch (error) {
        console.error(`Error downloading image for item ${itemId}:`, error);
        return '';
    }
}

// Increase concurrency for image uploads
const limit = pLimit(10); // Increased from 2 to 10

// Add rate limiting for image downloads
const downloadLimit = pLimit(3); // Limit concurrent downloads to 3

// Add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simplify image processing and remove retries
async function generateAndUploadImage(itemId: string, catalogClient: SquareManager): Promise<string> {
    logWithTimestamp(`Starting image processing for ${itemId}`);
    
    // Use fixed parameters for faster processing
    const format = 'jpeg';
    const maxWidth = 800;
    const maxHeight = 800;
    const quality = 80;
    
    // Use only Picsum for faster downloads
    const seed = crypto.randomBytes(8).toString('hex');
    const imageUrl = `https://picsum.photos/seed/${seed}/${maxWidth}/${maxHeight}`;
    
    const tempDir = path.join(process.cwd(), 'temp_images');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    const tempImagePath = path.join(tempDir, `${itemId}.${format}`);
    
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
                        caption: 'Item image'
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
            logWithTimestamp(`Rate limit hit for ${itemId}, retrying after delay...`, 'warn');
            await delay(2000); // Wait 2s before retry
            return generateAndUploadImage(itemId, catalogClient);
        }
        logWithTimestamp(`Error processing/uploading image for ${itemId}: ${error}`, 'error');
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

async function importCatalog() {
    const catalogClient = new SquareManager();
    try {
        logWithTimestamp('Starting catalog import with images. Press Ctrl+C to stop.');
        
        // Generate categories and modifiers first
        const categories = Array.from({ length: argv.categories }, (_, i) => ({
            type: 'CATEGORY',
            id: `#Category${i + 1}`,
            presentAtAllLocations: true,
            categoryData: {
                name: `Category SQ-${String(i + 1).padStart(2, '0')}`
            }
        }));

        // Generate modifier groups
        const modifierGroups = Array.from({ length: argv['modifier-groups'] }, (_, groupIndex) => {
            const modifiers = Array.from({ length: argv['modifiers-per-group'] }, (_, i) => ({
                type: 'MODIFIER',
                id: `#Modifier${groupIndex * argv['modifiers-per-group'] + i + 1}`,
                presentAtAllLocations: true,
                modifierData: {
                    name: `Modifier SQ-${String(groupIndex + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
                    priceMoney: {
                        amount: BigInt(faker.number.int({ min: 100, max: 1000 })),
                        currency: 'USD'
                    }
                }
            }));

            return {
                type: 'MODIFIER_LIST',
                id: `#ModifierList${groupIndex + 1}`,
                presentAtAllLocations: true,
                modifierListData: {
                    name: `Modifier SQ-${String(groupIndex + 1).padStart(2, '0')}`,
                    modifiers: modifiers
                }
            };
        });

        // Import categories and modifiers in parallel
        logWithTimestamp(`Importing ${argv.categories} categories and ${argv['modifier-groups']} modifier lists...`);
        const firstBatch = [...categories, ...modifierGroups];
        const firstBatchResponse = await catalogClient.batchUpsertItemObjects([{ objects: firstBatch }]);
        logWithTimestamp('Categories and modifier lists imported successfully!');

        // Reduced wait time
        await delay(2000);

        // Map modifier list IDs for assignment
        const modifierListIdMappings = modifierGroups.map((group) => {
            const mapping = firstBatchResponse.idMappings?.find(m => m.clientObjectId === group.id);
            return mapping?.objectId;
        }).filter(Boolean);
        if (modifierListIdMappings.length === 0) {
            throw new Error('No modifier list IDs found after batch insert.');
        }

        // Process all items in parallel
        const allItems: CatalogObject[] = [];
        let globalItemCounter = 1;
        const itemCounterLock: { [key: number]: number } = {};

        // Process all categories and their items in parallel
        await Promise.all(categories.map(async (categoryObj, categoryIndex) => {
            const clientCategoryId = `#Category${categoryIndex + 1}`;
            const realCategoryId = firstBatchResponse.idMappings?.find(m => m.clientObjectId === clientCategoryId)?.objectId;
            
            if (!realCategoryId) {
                logWithTimestamp(`Skipping category ${clientCategoryId} - no real ID found`, 'warn');
                return;
            }

            // Process category image and items in parallel
            const [categoryImageId] = await Promise.all([
                limit(() => generateAndUploadImage(`Category${categoryIndex + 1}`, catalogClient)),
                // Process all items for this category in parallel
                ...Array.from({ length: argv.items }, async (_, itemIndex) => {
                    let itemIdNum;
                    // Ensure unique item/variation IDs in parallel
                    // Use a lock object to avoid race conditions
                    if (!itemCounterLock[categoryIndex]) itemCounterLock[categoryIndex] = 0;
                    itemIdNum = categoryIndex * argv.items + itemIndex + 1;
                    const itemId = `Item${itemIdNum}`;
                    // Assign modifier list in round-robin fashion
                    const randomModifierListId = modifierListIdMappings[(itemIdNum - 1) % modifierListIdMappings.length];
                    if (!randomModifierListId) {
                        logWithTimestamp(`Skipping item ${itemId} - no modifier list ID found`, 'warn');
                        return;
                    }
                    try {
                        // Generate item and variation images in parallel
                        const numVariations = faker.number.int({ min: 1, max: 10 });
                        const [itemImageId, ...variationImageIds] = await Promise.all([
                            limit(() => generateAndUploadImage(itemId, catalogClient)),
                            ...Array.from({ length: numVariations }, (_, i) =>
                                limit(() => generateAndUploadImage(`Variation${itemIdNum}_${i + 1}`, catalogClient))
                            )
                        ]);
                        const variations = variationImageIds.map((imageId, i) => ({
                            type: 'ITEM_VARIATION',
                            id: `#Variation${itemIdNum}_${i + 1}`,
                            presentAtAllLocations: true,
                            itemVariationData: {
                                name: `Variation ${i + 1}`,
                                pricingType: 'FIXED_PRICING',
                                priceMoney: {
                                    amount: BigInt(faker.number.int({ min: 100, max: 1000 })),
                                    currency: 'USD'
                                },
                                imageIds: [imageId]
                            }
                        }));
                        allItems.push({
                            type: 'ITEM',
                            id: `#Item${itemIdNum}`,
                            presentAtAllLocations: true,
                            itemData: {
                                name: `Item SQ-${String(itemIdNum).padStart(4, '0')}`,
                                categories: [{ id: realCategoryId }],
                                modifierListInfo: [{
                                    modifierListId: randomModifierListId,
                                    enabled: true
                                }],
                                imageIds: [itemImageId],
                                variations: variations
                            }
                        });
                    } catch (error: any) {
                        logWithTimestamp(`Error processing item ${itemId}: ${error?.message || error}`, 'error');
                        if (error?.response) {
                            logWithTimestamp(`Square API error response: ${JSON.stringify(error.response.data || error.response.body || error.response, null, 2)}`, 'error');
                        }
                    }
                })
            ]);
            // Fetch latest category object to get the version
            const categoryObjResp = await catalogClient.client.catalogApi.retrieveCatalogObject(realCategoryId);
            const latestCategory = categoryObjResp.result.object;
            const latestVersion = latestCategory?.version;
            await catalogClient.client.catalogApi.upsertCatalogObject({
                idempotencyKey: uuidv4(),
                object: {
                    type: 'CATEGORY',
                    id: realCategoryId,
                    presentAtAllLocations: true,
                    version: latestVersion,
                    categoryData: {
                        name: categoryObj.categoryData.name,
                        imageIds: [categoryImageId]
                    }
                }
            });
        }));
        // Import items in larger batches with no delay
        const batchSize = 2000; // Increased batch size
        for (let i = 0; i < allItems.length; i += batchSize) {
            const batch = allItems.slice(i, i + batchSize);
            try {
                await catalogClient.batchUpsertItemObjects([{ objects: batch }]);
                logWithTimestamp(`Imported batch of ${batch.length} items`);
            } catch (error: any) {
                logWithTimestamp(`Error importing batch: ${error?.message || error}`, 'error');
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
            }
        }
        logWithTimestamp('Catalog import completed successfully!');
    } catch (error: any) {
        logWithTimestamp(`Error importing catalog: ${error?.message || error}`, 'error');
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
    logWithTimestamp('\nStopping catalog import...');
    await cleanupTempDirectory();
    process.exit(0);
});

// Start importing catalog
importCatalog(); 