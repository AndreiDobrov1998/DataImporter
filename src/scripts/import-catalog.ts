import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CatalogObject } from 'square';
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
    .option('categories', {
        alias: 'c',
        type: 'number',
        description: 'Number of categories to import',
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

async function importCatalog() {
    const catalogClient = new SquareManager();
    try {
        console.log('Starting catalog import. Press Ctrl+C to stop.');
        
        // Generate categories and modifiers first
        const categories = Array.from({ length: argv.categories }, (_, i) => ({
            type: 'CATEGORY',
            id: `#Category${i + 1}`,
            presentAtAllLocations: true,
            categoryData: {
                name: `Category SQ-${String(i + 1).padStart(2, '0')}`
            }
        }));

        // Generate multiple modifier groups
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

        // First batch: categories and modifier lists
        console.log('Importing categories and modifier lists...');
        const firstBatch = [...categories, ...modifierGroups];
        const firstBatchResponse = await catalogClient.batchUpsertItemObjects([{ objects: firstBatch }]);
        console.log('Categories and modifier lists imported successfully!');

        // Extract the real Square object IDs for the modifier lists
        const modifierListIdMap: Record<string, string> = {};
        if (firstBatchResponse.idMappings) {
            for (const group of modifierGroups) {
                const mapping = firstBatchResponse.idMappings.find(m => m.clientObjectId === group.id);
                if (mapping && mapping.objectId) {
                    modifierListIdMap[group.id] = mapping.objectId;
                } else {
                    modifierListIdMap[group.id] = group.id; // fallback
                }
            }
        }

        // Map client category IDs to real Square IDs
        const categoryIdMap: Record<string, string> = {};
        if (firstBatchResponse.idMappings) {
            for (const cat of categories) {
                const mapping = firstBatchResponse.idMappings.find(m => m.clientObjectId === cat.id);
                if (mapping && mapping.objectId) {
                    categoryIdMap[cat.id] = mapping.objectId;
                } else {
                    categoryIdMap[cat.id] = cat.id; // fallback
                }
            }
        }

        // Generate all items
        const itemsPerCategory = argv['items-per-category'];
        const allItems: CatalogObject[] = [];
        let globalItemCounter = 1;
        
        for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
            const clientCategoryId = `#Category${categoryIndex + 1}`;
            const realCategoryId = categoryIdMap[clientCategoryId] || clientCategoryId;
            for (let itemIndex = 0; itemIndex < itemsPerCategory; itemIndex++) {
                // Assign a random modifier list to each item
                const randomModifierListIndex = Math.floor(Math.random() * modifierGroups.length);
                const clientModifierListId = `#ModifierList${randomModifierListIndex + 1}`;
                const realModifierListId = modifierListIdMap[clientModifierListId] || clientModifierListId;

                // Determine if this item should have variations
                const hasVariations = itemIndex < argv['items-with-variations'];
                const variations = hasVariations 
                    ? Array.from({ length: argv['variations-per-item'] }, (_, i) => ({
                        type: 'ITEM_VARIATION',
                        id: `#Variation${globalItemCounter}_${i + 1}`,
                        presentAtAllLocations: true,
                        itemVariationData: {
                            itemId: `#Item${globalItemCounter}`,
                            name: `Variation ${i + 1}`,
                            pricingType: 'FIXED_PRICING',
                            priceMoney: {
                                amount: BigInt(faker.number.int({ min: 100, max: 1000 })),
                                currency: 'USD'
                            }
                        }
                    }))
                    : [{
                        type: 'ITEM_VARIATION',
                        id: `#Variation${globalItemCounter}_1`,
                        presentAtAllLocations: true,
                        itemVariationData: {
                            itemId: `#Item${globalItemCounter}`,
                            name: 'Regular',
                            pricingType: 'FIXED_PRICING',
                            priceMoney: {
                                amount: BigInt(faker.number.int({ min: 100, max: 1000 })),
                                currency: 'USD'
                            }
                        }
                    }];

                allItems.push({
                    type: 'ITEM',
                    id: `#Item${globalItemCounter}`,
                    presentAtAllLocations: true,
                    itemData: {
                        name: `Item SQ-${String(globalItemCounter).padStart(4, '0')}${hasVariations ? ' (with variations)' : ''}`,
                        categories: [{ id: realCategoryId }],
                        modifierListInfo: [{
                            modifierListId: realModifierListId,
                            enabled: true
                        }],
                        variations: variations
                    }
                });
                globalItemCounter++;
            }
        }

        // Import items in batches of 500 (since each item has a variation, this means 1000 objects total)
        const batchSize = 500; // 500 items = 1000 objects (items + variations)
        const totalBatches = Math.ceil(allItems.length / batchSize);
        
        for (let i = 0; i < allItems.length; i += batchSize) {
            const batchNumber = Math.floor(i / batchSize) + 1;
            console.log(`Importing batch ${batchNumber} of ${totalBatches}...`);
            
            const batch = allItems.slice(i, i + batchSize);
            await catalogClient.batchUpsertItemObjects([{ objects: batch }]);
            
            console.log(`Batch ${batchNumber} imported successfully!`);
            
            // Add a small delay between batches to avoid rate limiting
            if (i + batchSize < allItems.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('Catalog import completed successfully!');

        // Verify that each item is assigned to a valid category
        console.log('Verifying catalog...');
        const response = await catalogClient.listCatalog();
        const objects = response.objects || [];
        const categoryIds = objects.filter(obj => obj.type === 'CATEGORY').map(obj => obj.id);
        const items = objects.filter(obj => obj.type === 'ITEM');
        let validItems = 0;
        let invalidItems = 0;
        for (const item of items) {
            const categoryId = item.itemData?.categories?.[0]?.id;
            if (categoryId && categoryIds.includes(categoryId)) {
                validItems++;
            } else {
                invalidItems++;
                console.log(`Item ${item.id} (${item.itemData?.name}) has invalid categoryId: ${categoryId}`);
            }
        }
        console.log(`Verification complete. Valid items: ${validItems}, Invalid items: ${invalidItems}`);
    } catch (error) {
        console.error('Error importing catalog:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nStopping catalog import...');
    process.exit(0);
});

// Start importing catalog
importCatalog(); 