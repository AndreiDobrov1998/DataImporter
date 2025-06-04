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
    .option('combos', {
        alias: 'b',
        type: 'number',
        description: 'Number of combos to create',
        default: 0
    })
    .option('items-per-combo', {
        alias: 'p',
        type: 'number',
        description: 'Number of items per combo',
        default: 3
    })
    .option('combo-price', {
        alias: 'r',
        type: 'number',
        description: 'Base price for combos in cents',
        default: 1999
    })
    .option('access-token', {
        alias: 't',
        type: 'string',
        description: 'Square API access token (overrides .env AUTH_TOKEN)'
    })
    .help()
    .argv as any;

// Get access token from command line or environment
const accessToken = argv['access-token'] || process.env.AUTH_TOKEN;
if (!accessToken) {
    console.error('Error: Access token is required. Provide it via --access-token or AUTH_TOKEN environment variable');
    process.exit(1);
}

async function importCatalog() {
    const catalogClient = new SquareManager(accessToken);
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

        // Add Combos category
        categories.push({
            type: 'CATEGORY',
            id: '#CombosCategory',
            presentAtAllLocations: true,
            categoryData: {
                name: 'Combos'
            }
        });

        // First batch: categories only
        console.log('Importing categories...');
        const categoryBatch = categories.map(cat => ({
            type: 'CATEGORY',
            id: cat.id,
            presentAtAllLocations: true,
            categoryData: {
                name: cat.categoryData.name
            }
        }));
        
        const categoryResponse = await catalogClient.batchUpsertItemObjects([{ objects: categoryBatch }]);
        console.log('Categories imported successfully!');

        // Map client category IDs to real Square IDs
        const categoryIdMap: Record<string, string> = {};
        if (categoryResponse.idMappings) {
            for (const cat of categories) {
                const mapping = categoryResponse.idMappings.find(m => m.clientObjectId === cat.id);
                if (mapping && mapping.objectId) {
                    categoryIdMap[cat.id] = mapping.objectId;
                } else {
                    console.error(`Failed to map category ID for ${cat.id}`);
                    process.exit(1);
                }
            }
        }

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

        // Import modifier groups
        console.log('Importing modifier groups...');
        const modifierResponse = await catalogClient.batchUpsertItemObjects([{ objects: modifierGroups }]);
        console.log('Modifier groups imported successfully!');

        // Extract the real Square object IDs for the modifier lists
        const modifierListIdMap: Record<string, string> = {};
        if (modifierResponse.idMappings) {
            for (const group of modifierGroups) {
                const mapping = modifierResponse.idMappings.find(m => m.clientObjectId === group.id);
                if (mapping && mapping.objectId) {
                    modifierListIdMap[group.id] = mapping.objectId;
                } else {
                    console.error(`Failed to map modifier list ID for ${group.id}`);
                    process.exit(1);
                }
            }
        }

        // Generate all items
        const itemsPerCategory = argv['items-per-category'];
        const allItems: CatalogObject[] = [];
        let globalItemCounter = 1;
        
        // Only use the original categories for regular items (exclude Combos category)
        const regularCategoryIds = categories
            .filter(cat => cat.id !== '#CombosCategory')
            .map(cat => cat.id);

        for (let categoryIndex = 0; categoryIndex < regularCategoryIds.length; categoryIndex++) {
            const clientCategoryId = regularCategoryIds[categoryIndex];
            const realCategoryId = categoryIdMap[clientCategoryId];
            for (let itemIndex = 0; itemIndex < itemsPerCategory; itemIndex++) {
                // Assign a random modifier list to each item
                const randomModifierListIndex = Math.floor(Math.random() * modifierGroups.length);
                const clientModifierListId = `#ModifierList${randomModifierListIndex + 1}`;
                const realModifierListId = modifierListIdMap[clientModifierListId];

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
                        productType: 'REGULAR',
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

        // After importing all regular items, create combos if requested
        if (argv.combos > 0) {
            console.log(`Creating ${argv.combos} combos...`);
            // Get all regular items for combo slots
            const allItemsRaw = await catalogClient.getAllCatalogItems(['ITEM']);
            const regularItems = allItemsRaw.filter((item: CatalogObject) => 
                item.itemData?.productType === 'REGULAR' && 
                Array.isArray(item.itemData?.categories) && 
                item.itemData.categories.some((cat: { id?: string }) => 
                    typeof cat.id === 'string' && 
                    cat.id !== categoryIdMap['#CombosCategory']
                )
            );

            if (regularItems.length < argv['items-per-combo']) {
                console.error(`Not enough regular items in catalog for combos. Required: ${argv['items-per-combo']}, Available: ${regularItems.length}`);
                process.exit(1);
            }

            const combos: CatalogObject[] = [];
            for (let i = 0; i < argv.combos; i++) {
                const comboId = `#Combo${i + 1}`;
                // Pick unique items for each combo
                const comboItems = regularItems.slice(i * argv['items-per-combo'], (i + 1) * argv['items-per-combo']);
                
                // Create the combo item with slots
                combos.push({
                    type: 'ITEM',
                    id: comboId,
                    presentAtAllLocations: true,
                    itemData: {
                        name: `Combo SQ-${String(i + 1).padStart(4, '0')}`,
                        description: `Combo package with ${argv['items-per-combo']} items`,
                        productType: 'COMBO',
                        skipModifierScreen: true,
                        categories: [{ id: categoryIdMap['#CombosCategory'] }],
                        variations: [{
                            type: 'ITEM_VARIATION',
                            id: `#ComboVariation${i + 1}`,
                            presentAtAllLocations: true,
                            itemVariationData: {
                                itemId: comboId,
                                name: 'Regular',
                                pricingType: 'FIXED_PRICING',
                                priceMoney: {
                                    amount: BigInt(argv['combo-price']),
                                    currency: 'USD'
                                }
                            }
                        }],
                        comboTypeDetails: {
                            slots: comboItems.map((item, index) => ({
                                uid: `#ComboSlot${i + 1}_${index + 1}`,
                                numSelections: 1,
                                itemId: item.id,
                                itemIds: [item.id],
                                defaultItemVariationId: item.itemData?.variations?.[0]?.id
                            }))
                        }
                    }
                });
            }

            // Import combos in batches
            const comboBatchSize = 500;
            for (let i = 0; i < combos.length; i += comboBatchSize) {
                const batchNumber = Math.floor(i / comboBatchSize) + 1;
                console.log(`Importing combo batch ${batchNumber}...`);
                const batch = combos.slice(i, i + comboBatchSize);
                await catalogClient.batchUpsertItemObjects([{ objects: batch }]);
                console.log(`Combo batch ${batchNumber} imported successfully!`);
                if (i + comboBatchSize < combos.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
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