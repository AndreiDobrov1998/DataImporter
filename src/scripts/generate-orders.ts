import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
    .option('total-orders', {
        alias: 'n',
        type: 'number',
        description: 'Number of orders to generate',
        default: 10
    })
    .option('items-per-order', {
        alias: 'i',
        type: 'number',
        description: 'Number of items per order',
        default: 3
    })
    .option('location-id', {
        alias: 'l',
        type: 'string',
        description: 'Square location ID',
        demandOption: true
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

async function generateOrders() {
    const client = new SquareManager(accessToken);
    const BATCH_SIZE = 100; // Number of orders to create in parallel
    const totalOrders = argv['total-orders'];
    const itemsPerOrder = argv['items-per-order'];
    const locationId = argv['location-id'];
    
    try {
        // Initialize locations
        await client.initializeLocations();
        
        // Get all item variations
        const itemIds = await client.searchCatalogItems();
        console.log(`Found ${itemIds.length} items to create orders for`);

        let ordersCreated = 0;
        while (ordersCreated < totalOrders) {
            // Create orders in parallel batches
            const batchSize = Math.min(BATCH_SIZE, totalOrders - ordersCreated);
            const promises = Array(batchSize).fill(null).map(async () => {
                try {
                    // Select random items for this order
                    const selectedItems = Array(itemsPerOrder).fill(null).map(() => {
                        const randomItem = itemIds[Math.floor(Math.random() * itemIds.length)];
                        const quantity = Math.floor(Math.random() * 3) + 1;
                        return { catalogObjectId: randomItem, quantity: quantity.toString() };
                    });

                    const order = await client.createOrder(locationId, selectedItems);
                    console.log(`Order created: ID=${order.id}`);
                    ordersCreated++;
                } catch (error) {
                    console.error(`Error: ${(error as Error).message}`);
                }
            });
            await Promise.all(promises);
        }
        console.log(`Successfully created ${ordersCreated} orders`);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
    }
}

generateOrders();
