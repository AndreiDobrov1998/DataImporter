import { faker } from '@faker-js/faker';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';

dotenv.config();

// Constants
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 3;
const ORDER_DELAY_MS = 1000;

interface OrderCreationResult {
    orderId: string;
    paymentId: string;
    quantity: number;
    itemId: string;
    variationId: string;
}

async function createOrderWithPayment(
    variationId: string,
    itemId: string,
    catalogClient: SquareManager
): Promise<OrderCreationResult | null> {
    try {
        const quantity = faker.number.int({ min: MIN_QUANTITY, max: MAX_QUANTITY });
        const location = catalogClient.getRandomLocation();
        
        if (!location.id) {
            console.error('No location ID found, skipping order creation.');
            return null;
        }

        console.log(`Creating order for variation ${variationId} of item ${itemId} with quantity ${quantity}`);
        const order = await catalogClient.createOrder(
            location.id,
            [{ catalogObjectId: variationId, quantity: quantity.toString() }]
        );

        if (!order.id) {
            console.error(`Order ID is undefined for variation ${variationId} of item ${itemId}.`);
            return null;
        }

        console.log(`Created order for variation ${variationId} of item ${itemId} with quantity ${quantity}, Order ID: ${order.id}`);
        
        console.log(`Creating payment for order ${order.id}`);
        const payment = await catalogClient.createPayment(order.id, 'CASH', location.id);
        console.log(`Created cash payment for order ${order.id}, Payment ID: ${payment.id}`);

        return {
            orderId: order.id,
            paymentId: payment.id,
            quantity,
            itemId,
            variationId
        };
    } catch (error) {
        console.error(`Error processing variation ${variationId} of item ${itemId}:`, error);
        return null;
    }
}

async function processCatalogItems(catalogClient: SquareManager): Promise<void> {
    try {
        // Initialize locations
        await catalogClient.initializeLocations();
        
        // Get all catalog items and their variations
        const catalogItems = await catalogClient.getAllCatalogItems(['ITEM']);
        console.log(`Found ${catalogItems.length} items in the catalog.`);
        
        const results: OrderCreationResult[] = [];
        
        for (const item of catalogItems) {
            if (!item.itemData?.variations || item.itemData.variations.length === 0) {
                console.log(`Skipping item ${item.id} as it has no variations`);
                continue;
            }

            // Create an order for each variation
            for (const variation of item.itemData.variations) {
                if (!variation.id) {
                    console.log(`Skipping variation with no ID for item ${item.id}`);
                    continue;
                }

                const result = await createOrderWithPayment(variation.id, item.id, catalogClient);
                if (result) {
                    results.push(result);
                }

                // Add a delay between orders to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, ORDER_DELAY_MS));
            }
        }

        // Log summary
        console.log('\nOrder Generation Summary:');
        console.log(`Total orders created: ${results.length}`);
        console.log(`Total items processed: ${catalogItems.length}`);
    } catch (error) {
        console.error('Fatal error:', error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        const catalogClient = new SquareManager();
        await processCatalogItems(catalogClient);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main(); 