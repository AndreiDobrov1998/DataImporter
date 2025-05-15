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
    .option('items', {
        alias: 'i',
        type: 'number',
        description: 'Number of items per category',
        default: 10
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
                name: faker.commerce.department()
            }
        }));

        const modifiers = Array.from({ length: 5 }, (_, i) => ({
            type: 'MODIFIER',
            id: `#Modifier${i + 1}`,
            presentAtAllLocations: true,
            modifierData: {
                name: faker.commerce.productAdjective(),
                priceMoney: {
                    amount: BigInt(faker.number.int({ min: 100, max: 1000 })),
                    currency: 'USD'
                }
            }
        }));

        const modifierList = {
            type: 'MODIFIER_LIST',
            id: '#ModifierList1',
            presentAtAllLocations: true,
            modifierListData: {
                name: 'Modifiers',
                modifiers: modifiers
            }
        };

        // First batch: categories and modifier list
        console.log('Importing categories and modifier list...');
        const firstBatch = [...categories, modifierList];
        const firstBatchResponse = await catalogClient.batchUpsertItemObjects([{ objects: firstBatch }]);
        console.log('Categories and modifier list imported successfully!');

        // Extract the real Square object ID for the modifier list
        let realModifierListId = '#ModifierList1';
        if (firstBatchResponse.idMappings) {
            const mapping = firstBatchResponse.idMappings.find(m => m.clientObjectId === '#ModifierList1');
            if (mapping && mapping.objectId) {
                realModifierListId = mapping.objectId;
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
        const itemsPerCategory = argv.items;
        const allItems: CatalogObject[] = [];
        
        for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex++) {
            const clientCategoryId = `#Category${categoryIndex + 1}`;
            const realCategoryId = categoryIdMap[clientCategoryId] || clientCategoryId;
            for (let itemIndex = 0; itemIndex < itemsPerCategory; itemIndex++) {
                const itemNumber = categoryIndex * itemsPerCategory + itemIndex + 1;
                allItems.push({
                    type: 'ITEM',
                    id: `#Item${itemNumber}`,
                    presentAtAllLocations: true,
                    itemData: {
                        name: faker.commerce.productName(),
                        categories: [{ id: realCategoryId }],
                        modifierListInfo: [{
                            modifierListId: realModifierListId,
                            enabled: true
                        }],
                        variations: [{
                            type: 'ITEM_VARIATION',
                            id: `#Variation${itemNumber}`,
                            presentAtAllLocations: true,
                            itemVariationData: {
                                itemId: `#Item${itemNumber}`,
                                name: 'Default',
                                pricingType: 'FIXED_PRICING',
                                priceMoney: {
                                    amount: BigInt(faker.number.int({ min: 100, max: 1000 })),
                                    currency: 'USD'
                                }
                            }
                        }]
                    }
                });
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