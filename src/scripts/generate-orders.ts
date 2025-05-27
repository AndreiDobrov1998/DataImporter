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

async function generateOrders() {
    const client = new SquareManager();
    const BATCH_SIZE = 100; // Number of orders to create in parallel
    
    try {
        // Initialize locations
        await client.initializeLocations();
        
        // Get all item variations
        const itemIds = await client.searchCatalogItems();
        console.log(`Found ${itemIds.length} items to create orders for`);

        while (true) {
            // Create orders in parallel batches
            for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
                const batch = itemIds.slice(i, i + BATCH_SIZE);
                const promises = batch.map(async (itemId) => {
                    try {
                        const quantity = Math.floor(Math.random() * 3) + 1;
                        const location = client.getRandomLocation();
                        if (!location.id) {
                          console.error('No location ID found, skipping order creation.');
                          return;
                        }
                        const order = await client.createOrder(
                          location.id,
                          [{ catalogObjectId: itemId, quantity: quantity.toString() }]
                        );
                        console.log(`Order created: ID=${order.id}`);
                    } catch (error) {
                        console.error(`Error: ${(error as Error).message}`);
                    }
                });
                await Promise.all(promises);
            }
        }
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
    }
}

generateOrders();
