import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { SquareManager } from '../../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CatalogObject } from 'square';

// Load environment variables
dotenv.config();

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('access-token', {
        alias: 't',
        description: 'Square access token',
        type: 'string',
    })
    .option('location-id', {
        alias: 'l',
        description: 'Square location ID',
        type: 'string',
    })
    .command('create', 'Create a new combo', {
        name: {
            description: 'Combo name',
            type: 'string',
            demandOption: true
        },
        items: {
            description: 'Number of items in combo',
            type: 'number',
            default: 2
        },
        price: {
            description: 'Combo price in cents',
            type: 'number',
            demandOption: true
        }
    })
    .command('list', 'List all combos')
    .command('delete', 'Delete a combo', {
        id: {
            description: 'Combo ID to delete',
            type: 'string',
            demandOption: true
        }
    })
    .help()
    .argv as any;

// Get access token from command line or environment
const accessToken = argv['access-token'] || process.env.AUTH_TOKEN;
if (!accessToken) {
    console.error('Error: Access token is required. Provide it via --access-token or AUTH_TOKEN environment variable.');
    process.exit(1);
}

// Get location ID from command line or environment
const locationId = argv['location-id'] || process.env.LOCATION_ID;
if (!locationId) {
    console.error('Error: Location ID is required. Provide it via --location-id or LOCATION_ID environment variable.');
    process.exit(1);
}

async function main() {
    const squareManager = new SquareManager(accessToken);
    await squareManager.initializeLocationsAndTaxes();

    try {
        const command = argv._[0];

        switch (command) {
            case 'create':
                await createCombo(squareManager, argv);
                break;
            case 'list':
                await listCombos(squareManager);
                break;
            case 'delete':
                await deleteCombo(squareManager, argv.id);
                break;
            default:
                console.error('Unknown command. Use --help for available commands.');
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

async function createCombo(squareManager: SquareManager, options: any) {
    const { name, items, price } = options;
    
    // Get available catalog items
    const catalogItems = await squareManager.getAllCatalogItems(['REGULAR']);
    if (catalogItems.length < items) {
        throw new Error(`Not enough items in catalog. Required: ${items}, Available: ${catalogItems.length}`);
    }

    // Create combo object
    const comboId = uuidv4();
    const combo: CatalogObject = {
        id: comboId,
        type: 'ITEM',
        presentAtAllLocations: true,
        itemData: {
            name,
            description: `Combo package: ${name}`,
            variations: [{
                id: uuidv4(),
                type: 'ITEM_VARIATION',
                presentAtAllLocations: true,
                itemVariationData: {
                    itemId: comboId,
                    name: 'Regular',
                    pricingType: 'FIXED_PRICING',
                    priceMoney: {
                        amount: BigInt(price),
                        currency: 'USD'
                    }
                }
            }],
            categoryId: await getOrCreateComboCategory(squareManager),
            taxIds: await getTaxIds(squareManager)
        }
    };

    // Create combo in Square
    await squareManager.batchUpsertItemObjects([{ objects: [combo] }]);

    // Add items to combo
    const selectedItems = catalogItems.slice(0, items);
    for (const item of selectedItems) {
        const comboItem: CatalogObject = {
            id: uuidv4(),
            type: 'ITEM',
            presentAtAllLocations: true,
            itemData: {
                name: `${name} - ${item.itemData?.name}`,
                description: `Part of ${name} combo`,
                variations: [{
                    id: uuidv4(),
                    type: 'ITEM_VARIATION',
                    presentAtAllLocations: true,
                    itemVariationData: {
                        itemId: item.id,
                        name: 'Regular',
                        pricingType: 'FIXED_PRICING',
                        priceMoney: {
                            amount: BigInt(0),
                            currency: 'USD'
                        }
                    }
                }],
                categoryId: await getOrCreateComboCategory(squareManager),
                taxIds: await getTaxIds(squareManager)
            }
        };
        await squareManager.batchUpsertItemObjects([{ objects: [comboItem] }]);
    }

    console.log(`Successfully created combo: ${name}`);
}

async function listCombos(squareManager: SquareManager) {
    const combos = await squareManager.getAllCatalogItems(['REGULAR']);
    console.log('Available Combos:');
    combos.forEach((combo: CatalogObject) => {
        if (combo.itemData?.name?.includes('Combo')) {
            console.log(`- ${combo.itemData.name} (ID: ${combo.id})`);
        }
    });
}

async function deleteCombo(squareManager: SquareManager, comboId: string) {
    await squareManager.batchDeleteCatalogObjects([comboId]);
    console.log(`Successfully deleted combo with ID: ${comboId}`);
}

async function getOrCreateComboCategory(squareManager: SquareManager): Promise<string> {
    const catalog = await squareManager.listCatalog(['CATEGORY']);
    const comboCategory = catalog.objects?.find(cat => cat.categoryData?.name === 'Combos');
    
    if (comboCategory) {
        return comboCategory.id;
    }

    const newCategory: CatalogObject = {
        id: uuidv4(),
        type: 'CATEGORY',
        presentAtAllLocations: true,
        categoryData: {
            name: 'Combos'
        }
    };

    await squareManager.batchUpsertItemObjects([{ objects: [newCategory] }]);
    return newCategory.id;
}

async function getTaxIds(squareManager: SquareManager): Promise<string[]> {
    const taxes = await squareManager.listTaxes();
    return taxes.map(tax => tax.id);
}

main().catch(console.error); 