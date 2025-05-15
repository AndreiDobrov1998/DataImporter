import { faker } from '@faker-js/faker';
import type { CatalogObject, CatalogObjectBatch } from 'square';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';

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

interface IItemObject {
    name: string;
    categoryId: string;
    quantity: number;
    modifierId?: string;
}

interface IItemVariationObject {
    quantity: number;
    price: number;
    priceLambda: number;
}

async function processCategory(
    category: string,
    modifierListIds: string[],
    catalogClient: SquareManager,
    itemCounts: { count: number; variations: number; useModifier: boolean }[],
) {
    let bulkPayload: CatalogObject[] = [];
    let batchPayload: CatalogObjectBatch[] = [];

    for (const { count, variations, useModifier } of itemCounts) {
        console.log(`Processing ${count} items with ${variations} variations, useModifier: ${useModifier}`);
        for (let index = 0; index < count; index++) {
            const modifierId = useModifier ? faker.helpers.arrayElement(modifierListIds) : undefined;
            const item: IItemObject = {
                name: faker.commerce.productName(),
                categoryId: category,
                quantity: 1,
                modifierId,
            };
            const variation: IItemVariationObject = {
                quantity: variations,
                price: 100,
                priceLambda: 10,
            };

            bulkPayload.push(...catalogClient.generateItemObjects(item, variation));

            if (bulkPayload.length >= 100) {
                batchPayload.push({ objects: bulkPayload });
                bulkPayload = [];
            }

            if (batchPayload.length >= 9) {
                await catalogClient.batchUpsertItemObjects(batchPayload);
                batchPayload = [];
            }
        }
    }

    // Handle remaining payloads
    if (bulkPayload.length) {
        batchPayload.push({ objects: bulkPayload });
    }
    if (batchPayload.length) {
        await catalogClient.batchUpsertItemObjects(batchPayload);
    }
}

async function createItems(categoriesList: string[], modifierListIds: string[], catalogClient: SquareManager) {
    const itemCounts = [
        { count: 10, variations: 1, useModifier: true },
        { count: 20, variations: 1, useModifier: false },
        { count: 5, variations: 3, useModifier: true },
        { count: 5, variations: 3, useModifier: false },
    ];

    for (const category of categoriesList) {
        console.log(`Creating items for category: ${category}`);
        await processCategory(category, modifierListIds, catalogClient, itemCounts);
    }
}

async function deleteAllModifiers(catalogClient: SquareManager) {
    console.log('Deleting all modifiers...');
    let listed: string[] = [];
    do {
        listed = await catalogClient.listCatalogIds(['MODIFIER_LIST']);
        if (listed.length > 0) {
            console.log(`Deleting ${listed.length} modifiers...`);
            await catalogClient.batchDeleteCatalogObjects(listed);
        }
    } while (listed.length > 0);
}

async function deleteAllCatalogObjects(catalogClient: SquareManager) {
    console.log('Deleting all catalog objects...');
    await deleteAllModifiers(catalogClient);
    let listed: string[] = [];

    do {
        listed = await catalogClient.listCatalogIds(['ITEM', 'CATEGORY', 'DISCOUNT']);
        if (listed.length > 0) {
            console.log(`Deleting ${listed.length} catalog objects...`);
            await catalogClient.batchDeleteCatalogObjects(listed);
        }
    } while (listed.length > 0);
}

async function importCatalog() {
    const catalogClient = new SquareManager();
    try {
        // Create categories
        console.log('Creating categories...');
        const { objects: categories = [] } = await catalogClient.batchCreateCategories('test', 3);
        console.log(`Created ${categories.length} categories`);

        // Create modifiers
        console.log('Creating modifiers...');
        const { objects: modifiers = [] } = await catalogClient.batchCreateModifierLists(
            { name: faker.commerce.product(), quantity: 5 },
            { price: 100, priceLambda: 10, quantity: 5 },
        );
        console.log(`Created ${modifiers.length} modifiers`);

        // Create items
        console.log('Creating items...');
        await createItems(
            categories.map((cat) => cat.id),
            modifiers.map((mod) => mod.id),
            catalogClient,
        );
        console.log('Catalog import completed successfully!');
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
console.log('Starting catalog import. Press Ctrl+C to stop.');
importCatalog(); 