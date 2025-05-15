import { faker } from '@faker-js/faker';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';

dotenv.config();

async function createOrder(
    itemId: string,
    catalogClient: SquareManager
) {
    try {
        // Create order with random quantity (1-3) for the given item
        const orderQuantity = faker.number.int({ min: 1, max: 3 });
        const location = catalogClient.getRandomLocation();
        if (!location.id) {
            throw new Error('Location ID is required');
        }
        const lineItems = [{ catalogObjectId: itemId, quantity: orderQuantity.toString() }];
        // Create the order using Square API
        const order = await catalogClient.createOrder(location.id, lineItems);
        console.log(`Created order for item ${itemId} with quantity ${orderQuantity}`);
        return order;
    } catch (error) {
        console.error(`Error creating order for item ${itemId}:`, error);
        throw error;
    }
}

async function processItems(items: string[], catalogClient: SquareManager) {
    if (!items.length) {
        console.log('No items found to create orders for');
        return;
    }

    for (const itemId of items) {
        if (!itemId) {
            console.log('Skipping undefined item ID');
            continue;
        }
        await createOrder(itemId, catalogClient);
        // Add a small delay between orders to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function main() {
    const catalogClient = new SquareManager();
    await catalogClient.initializeLocations();
    // Get all items from the catalog
    const items = await catalogClient.searchCatalogItems();
    console.log(`Found ${items.length} items to create orders for`);
    // Create orders for each item
    await processItems(items, catalogClient);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
}); 