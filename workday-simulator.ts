import { faker } from '@faker-js/faker';
import { SquareManager } from './src/module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import inquirer from 'inquirer';
import { CatalogObject } from 'square';
import crypto from 'crypto';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config();

const argv = yargs(hideBin(process.argv))
    .option('access-token', {
        alias: 't',
        type: 'string',
        description: 'Square API access token (overrides .env AUTH_TOKEN)'
    })
    .help()
    .argv as { [key: string]: unknown; 'access-token'?: string };

const accessToken = argv['access-token'] || process.env.AUTH_TOKEN;
if (!accessToken) {
    console.error('Error: AUTH_TOKEN environment variable or --access-token argument is required');
    process.exit(1);
}

const catalogClient = new SquareManager(accessToken);

async function getRandomItems(count: number): Promise<CatalogObject[]> {
    const items = await catalogClient.getAllCatalogItems(['ITEM']);
    return faker.helpers.arrayElements(items, count);
}

async function editItemPrices(count: number) {
    const items = await getRandomItems(count);
    console.log(`\nEditing prices for ${count} items...`);
    for (const item of items) {
        if (!item.itemData?.variations) continue;
        for (const variation of item.itemData.variations) {
            if (!variation.id) continue;
            const newPrice = faker.number.int({ min: 100, max: 5000 });
            const updatedVariation: CatalogObject = {
                type: 'ITEM_VARIATION',
                id: variation.id,
                version: variation.version,
                itemVariationData: {
                    ...variation.itemVariationData,
                    priceMoney: {
                        amount: BigInt(newPrice),
                        currency: 'USD'
                    }
                }
            };
            await catalogClient.batchUpsertItemObjects([{ objects: [updatedVariation] }]);
            console.log(`Updated price for ${item.itemData.name} - ${variation.itemVariationData?.name} to $${newPrice/100}`);
        }
    }
}

async function editItemTitles(count: number) {
    const items = await getRandomItems(count);
    console.log(`\nEditing titles for ${count} items...`);
    for (const item of items) {
        if (!item.id || !item.itemData) continue;
        if ((item.itemData as any).productType === 'COMBO') {
            console.log(`Skipping COMBO item: ${item.itemData.name}`);
            continue;
        }
        const newName = `Updated ${faker.commerce.productName()}`;
        const updatedItem: CatalogObject = {
            type: 'ITEM',
            id: item.id,
            version: item.version,
            itemData: {
                ...(item.itemData as any),
                name: newName,
                comboTypeDetails: (item.itemData as any).productType === 'COMBO' ? (item.itemData as any).comboTypeDetails : undefined
            }
        };
        await catalogClient.batchUpsertItemObjects([{ objects: [updatedItem] }]);
        console.log(`Updated name for item to: ${newName}`);
    }
}

async function addItemVariations(count: number) {
    const items = await getRandomItems(count);
    console.log(`\nAdding variations to ${count} items...`);
    for (const item of items) {
        if (!item.id || !item.itemData) continue;
        if ((item.itemData as any).productType === 'COMBO') {
            console.log(`Skipping COMBO item: ${item.itemData.name}`);
            continue;
        }
        const variationName = `New Variation ${faker.commerce.productAdjective()}`;
        const price = faker.number.int({ min: 100, max: 5000 });
        const newVariation: CatalogObject = {
            type: 'ITEM_VARIATION',
            id: `#${crypto.randomUUID()}`,
            itemVariationData: {
                name: variationName,
                priceMoney: {
                    amount: BigInt(price),
                    currency: 'USD'
                }
            }
        };
        const updatedItem: CatalogObject = {
            type: 'ITEM',
            id: item.id,
            version: item.version,
            itemData: {
                ...(item.itemData as any),
                variations: [...(item.itemData.variations || []), newVariation],
                comboTypeDetails: (item.itemData as any).productType === 'COMBO' ? (item.itemData as any).comboTypeDetails : undefined
            }
        };
        await catalogClient.batchUpsertItemObjects([{ objects: [updatedItem] }]);
        console.log(`Added variation "${variationName}" to ${item.itemData.name}`);
    }
}

async function removeItemVariations(count: number) {
    const items = await getRandomItems(count);
    console.log(`\nRemoving variations from ${count} items...`);
    for (const item of items) {
        if (!item.itemData?.variations || item.itemData.variations.length <= 1) continue;
        const variationToRemove = faker.helpers.arrayElement(item.itemData.variations);
        if (!variationToRemove.id) continue;
        await catalogClient.batchDeleteCatalogObjects([variationToRemove.id]);
        console.log(`Removed variation from ${item.itemData.name}`);
    }
}

async function assignCategoriesAndModifiers(count: number) {
    const items = await getRandomItems(count);
    const categories = await catalogClient.getAllCatalogItems(['CATEGORY']);
    const modifierLists = await catalogClient.getAllCatalogItems(['MODIFIER_LIST']);
    console.log(`\nAssigning categories and modifiers to ${count} items...`);
    for (const item of items) {
        if (!item.id) continue;
        if ((item.itemData as any)?.productType === 'COMBO') {
            console.log(`Skipping COMBO item: ${item.itemData?.name}`);
            continue;
        }
        const randomCategory = faker.helpers.arrayElement(categories);
        if (randomCategory.id) {
            const updatedItem: CatalogObject = {
                type: 'ITEM',
                id: item.id,
                version: item.version,
                itemData: {
                    ...(item.itemData as any),
                    categoryId: randomCategory.id,
                    comboTypeDetails: (item.itemData as any)?.productType === 'COMBO' ? (item.itemData as any).comboTypeDetails : undefined
                }
            };
            await catalogClient.batchUpsertItemObjects([{ objects: [updatedItem] }]);
            console.log(`Assigned category to ${item.itemData?.name}`);
        }
        const randomModifierList = faker.helpers.arrayElement(modifierLists);
        if (randomModifierList.id) {
            const updatedItem: CatalogObject = {
                type: 'ITEM',
                id: item.id,
                version: item.version,
                itemData: {
                    ...(item.itemData as any),
                    modifierListInfo: [{
                        modifierListId: randomModifierList.id
                    }],
                    comboTypeDetails: (item.itemData as any)?.productType === 'COMBO' ? (item.itemData as any).comboTypeDetails : undefined
                }
            };
            await catalogClient.batchUpsertItemObjects([{ objects: [updatedItem] }]);
            console.log(`Assigned modifier list to ${item.itemData?.name}`);
        }
    }
}

async function runOrderGenerator(minQuantity: number, maxQuantity: number, concurrency: number) {
    const cmd = `npx ts-node src/scripts/order-data-generator.ts --min-quantity ${minQuantity} --max-quantity ${maxQuantity} --concurrency ${concurrency} --access-token ${accessToken}`;
    console.log(`\nRunning order generator...`);
    const { exec } = await import('child_process');
    await new Promise<void>((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
            if (error) reject(error);
            else resolve();
        });
    });
}

async function main() {
    while (true) {
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    'Edit Item Prices',
                    'Edit Item Titles',
                    'Add Item Variations',
                    'Remove Item Variations',
                    'Assign Categories and Modifiers',
                    'Run Order Generator',
                    'Exit'
                ]
            }
        ]);
        if (action === 'Exit') {
            console.log('Goodbye!');
            break;
        }
        let count = 0;
        if (action !== 'Run Order Generator') {
            const { itemCount } = await inquirer.prompt([
                {
                    type: 'number',
                    name: 'itemCount',
                    message: 'How many items would you like to process?',
                    default: 5
                }
            ]);
            count = itemCount;
        }
        switch (action) {
            case 'Edit Item Prices':
                await editItemPrices(count);
                break;
            case 'Edit Item Titles':
                await editItemTitles(count);
                break;
            case 'Add Item Variations':
                await addItemVariations(count);
                break;
            case 'Remove Item Variations':
                await removeItemVariations(count);
                break;
            case 'Assign Categories and Modifiers':
                await assignCategoriesAndModifiers(count);
                break;
            case 'Run Order Generator':
                const { minQuantity, maxQuantity, concurrency } = await inquirer.prompt([
                    { type: 'number', name: 'minQuantity', message: 'Enter minimum quantity per order:', default: 1 },
                    { type: 'number', name: 'maxQuantity', message: 'Enter maximum quantity per order:', default: 3 },
                    { type: 'number', name: 'concurrency', message: 'Enter concurrency level:', default: 10 }
                ]);
                await runOrderGenerator(minQuantity, maxQuantity, concurrency);
                break;
        }
    }
}

main(); 