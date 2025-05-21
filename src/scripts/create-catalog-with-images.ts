import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CatalogObject } from 'square';
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
        description: 'Number of categories to create',
        default: 3
    })
    .option('items-per-category', {
        alias: 'i',
        type: 'number',
        description: 'Number of items per category',
        default: 10
    })
    .option('items-with-variations', {
        alias: 'v',
        type: 'number',
        description: 'Number of items with variations per category',
        default: 5
    })
    .option('variations-per-item', {
        alias: 'n',
        type: 'number',
        description: 'Number of variations per item with variations',
        default: 3
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

function logWithTimestamp(message: string, type: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
}

// Add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to fetch all images from Square catalog using pagination
async function fetchAllImages(catalogClient: SquareManager): Promise<string[]> {
    const imageIds: string[] = [];
    let cursor: string | undefined;
    
    try {
        do {
            const response = await catalogClient.client.catalogApi.searchCatalogObjects({
                objectTypes: ['IMAGE'],
                cursor: cursor
            });
            
            const images = response.result.objects || [];
            imageIds.push(...images.map(img => img.id));
            
            cursor = response.result.cursor;
            
            if (cursor) {
                await delay(1000); // Add delay between requests to avoid rate limiting
            }
            
            logWithTimestamp(`Fetched ${images.length} images. Total: ${imageIds.length}`);
            
        } while (cursor);
        
        logWithTimestamp(`Successfully fetched ${imageIds.length} images from catalog`);
        return imageIds;
        
    } catch (error: any) {
        logWithTimestamp(`Error fetching images: ${error?.message || error}`, 'error');
        if (error?.response) {
            try {
                const errorResponse = error.response.data || error.response.body || error.response;
                logWithTimestamp(`Square API error response: ${JSON.stringify(errorResponse, null, 2)}`, 'error');
            } catch (e) {
                logWithTimestamp(`Raw error response: ${error.response}`, 'error');
            }
        }
        throw error;
    }
}

async function createCatalog() {
    const catalogClient = new SquareManager();
    try {
        logWithTimestamp('Starting catalog creation with existing images. Press Ctrl+C to stop.');
        
        // Fetch all images from Square catalog
        const imageIds = await fetchAllImages(catalogClient);
        
        if (imageIds.length === 0) {
            throw new Error('No images found in Square catalog');
        }
        
        // Generate categories and modifiers first
        const categories = Array.from({ length: argv.categories }, (_, i) => ({
            type: 'CATEGORY',
            id: `#Category${i + 1}`,
            presentAtAllLocations: true,
            categoryData: {
                name: `Category SQ-${String(i + 1).padStart(2, '0')}`,
                imageIds: [imageIds[i % imageIds.length]] // Assign images to categories
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
                    },
                    imageIds: [imageIds[(groupIndex * argv['modifiers-per-group'] + i) % imageIds.length]] // Assign images to modifiers
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

        await delay(2000);

        // Map modifier list IDs for assignment
        const modifierListIdMappings = modifierGroups.map((group) => {
            const mapping = firstBatchResponse.idMappings?.find(m => m.clientObjectId === group.id);
            return mapping?.objectId;
        }).filter(Boolean);
        
        if (modifierListIdMappings.length === 0) {
            throw new Error('No modifier list IDs found after batch insert.');
        }

        // Process all items
        const allItems: CatalogObject[] = [];
        let imageIndex = 0;

        // Process all categories and their items
        for (const [categoryIndex, categoryObj] of categories.entries()) {
            const clientCategoryId = `#Category${categoryIndex + 1}`;
            const realCategoryId = firstBatchResponse.idMappings?.find(m => m.clientObjectId === clientCategoryId)?.objectId;
            
            if (!realCategoryId) {
                logWithTimestamp(`Skipping category ${clientCategoryId} - no real ID found`, 'warn');
                continue;
            }

            // Process items for this category
            for (let itemIndex = 0; itemIndex < argv['items-per-category']; itemIndex++) {
                const itemIdNum = categoryIndex * argv['items-per-category'] + itemIndex + 1;
                const itemId = `Item${itemIdNum}`;
                
                // Assign modifier list in round-robin fashion
                const randomModifierListId = modifierListIdMappings[(itemIdNum - 1) % modifierListIdMappings.length];
                if (!randomModifierListId) {
                    logWithTimestamp(`Skipping item ${itemId} - no modifier list ID found`, 'warn');
                    continue;
                }

                try {
                    // Determine if this item should have variations
                    const hasVariations = itemIndex < argv['items-with-variations'];
                    const variations = hasVariations 
                        ? Array.from({ length: argv['variations-per-item'] }, (_, i) => ({
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
                                imageIds: [imageIds[imageIndex++ % imageIds.length]] // Assign images to variations
                            }
                        }))
                        : [{
                            type: 'ITEM_VARIATION',
                            id: `#Variation${itemIdNum}_1`,
                            presentAtAllLocations: true,
                            itemVariationData: {
                                name: 'Regular',
                                pricingType: 'FIXED_PRICING',
                                priceMoney: {
                                    amount: BigInt(faker.number.int({ min: 100, max: 1000 })),
                                    currency: 'USD'
                                },
                                imageIds: [imageIds[imageIndex++ % imageIds.length]]
                            }
                        }];

                    allItems.push({
                        type: 'ITEM',
                        id: `#Item${itemIdNum}`,
                        presentAtAllLocations: true,
                        itemData: {
                            name: `Item SQ-${String(itemIdNum).padStart(4, '0')}${hasVariations ? ' (with variations)' : ''}`,
                            categories: [{ id: realCategoryId }],
                            modifierListInfo: [{
                                modifierListId: randomModifierListId,
                                enabled: true
                            }],
                            imageIds: [imageIds[imageIndex++ % imageIds.length]], // Assign images to items
                            variations: variations
                        }
                    });
                } catch (error: any) {
                    logWithTimestamp(`Error processing item ${itemId}: ${error?.message || error}`, 'error');
                }
            }
        }

        // Import items in batches
        const batchSize = 2000;
        for (let i = 0; i < allItems.length; i += batchSize) {
            const batch = allItems.slice(i, i + batchSize);
            try {
                await catalogClient.batchUpsertItemObjects([{ objects: batch }]);
                logWithTimestamp(`Imported batch of ${batch.length} items`);
                await delay(1000); // Add delay between batches to avoid rate limiting
            } catch (error: any) {
                logWithTimestamp(`Error importing batch: ${error?.message || error}`, 'error');
                if (error?.response) {
                    try {
                        const errorResponse = error.response.data || error.response.body || error.response;
                        logWithTimestamp(`Square API error response: ${JSON.stringify(errorResponse, null, 2)}`, 'error');
                    } catch (e) {
                        logWithTimestamp(`Raw error response: ${error.response}`, 'error');
                    }
                }
            }
        }
        
        logWithTimestamp('Catalog creation completed successfully!');
    } catch (error: any) {
        logWithTimestamp(`Error creating catalog: ${error?.message || error}`, 'error');
        if (error?.response) {
            try {
                const errorResponse = error.response.data || error.response.body || error.response;
                logWithTimestamp(`Square API error response: ${JSON.stringify(errorResponse, null, 2)}`, 'error');
            } catch (e) {
                logWithTimestamp(`Raw error response: ${error.response}`, 'error');
            }
        }
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    logWithTimestamp('\nStopping catalog creation...');
    process.exit(0);
});

// Start creating catalog
createCatalog(); 