import { faker } from '@faker-js/faker';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import pLimit from 'p-limit';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
    .option('min-quantity', {
        alias: 'min',
        type: 'number',
        description: 'Minimum quantity per order',
        default: 1
    })
    .option('max-quantity', {
        alias: 'max',
        type: 'number',
        description: 'Maximum quantity per order',
        default: 3
    })
    .option('concurrency', {
        alias: 'c',
        type: 'number',
        description: 'Number of concurrent orders to process',
        default: 10
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

// Constants
const MIN_QUANTITY = argv['min-quantity'];
const MAX_QUANTITY = argv['max-quantity'];
const CONCURRENCY = argv.concurrency;

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

        const order = await catalogClient.createOrder(
            location.id,
            [{ catalogObjectId: variationId, quantity: quantity.toString() }]
        );

        if (!order.id) {
            console.error(`Order ID is undefined for variation ${variationId} of item ${itemId}.`);
            return null;
        }

        const payment = await catalogClient.createPayment(order.id, 'CASH', location.id);
        console.log(`Created order ${order.id} with payment ${payment.id} (${quantity} items)`);

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
        let skippedItems = 0;
        
        // Create a list of all variations to process
        const variationsToProcess: { variationId: string; itemId: string }[] = [];
        
        for (const item of catalogItems) {
            if (!item.itemData?.variations || item.itemData.variations.length === 0) {
                skippedItems++;
                continue;
            }

            for (const variation of item.itemData.variations) {
                if (!variation.id) {
                    skippedItems++;
                    continue;
                }
                variationsToProcess.push({
                    variationId: variation.id,
                    itemId: item.id
                });
            }
        }

        console.log(`Processing ${variationsToProcess.length} variations with concurrency ${CONCURRENCY}`);

        // Create a rate limiter with fixed concurrency
        const limit = pLimit(CONCURRENCY);

        // Process all variations concurrently with rate limiting
        const promises = variationsToProcess.map(({ variationId, itemId }) => 
            limit(() => createOrderWithPayment(variationId, itemId, catalogClient))
        );

        // Wait for all promises to resolve
        const batchResults = await Promise.all(promises);
        
        // Filter out null results and add to results array
        results.push(...batchResults.filter((result): result is OrderCreationResult => result !== null));

        // Log summary
        console.log('\nOrder Generation Summary:');
        console.log(`Total orders created: ${results.length}`);
        console.log(`Total items processed: ${catalogItems.length}`);
        console.log(`Items skipped: ${skippedItems}`);
        console.log(`Concurrency level: ${CONCURRENCY}`);
    } catch (error) {
        console.error('Fatal error:', error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        const catalogClient = new SquareManager(accessToken);
        await processCatalogItems(catalogClient);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main(); 