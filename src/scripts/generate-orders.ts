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
                        await client.createOrder(
                          location.id,
                          [{ catalogObjectId: itemId, quantity: quantity.toString() }]
                        );
                    } catch (error) {
                        console.error(`Error creating order for item ${itemId}:`, error);
                    }
                });

                // Wait for all orders in the batch to complete
                await Promise.all(promises);
                
                // Small delay between batches to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log('Completed one full cycle of orders. Starting next cycle...');
            // Brief pause between cycles
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nStopping order generation...');
    process.exit(0);
});

// Start generating orders
console.log('Starting order generation. Press Ctrl+C to stop.');
generateOrders(); 