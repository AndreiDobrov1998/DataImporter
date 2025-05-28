import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import { BatchDeleteCatalogObjectsRequest } from 'square';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
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

async function fetchAllImages(catalogClient: SquareManager) {
    let images: any[] = [];
    let cursor: string | undefined = undefined;
    do {
        const response = await catalogClient.client.catalogApi.listCatalog(cursor, 'IMAGE');
        if (response.result.objects) {
            images = images.concat(response.result.objects);
        }
        cursor = response.result.cursor;
    } while (cursor);
    return images;
}

async function deleteAllImages() {
    const catalogClient = new SquareManager(accessToken);
    try {
        console.log('Starting image deletion. Press Ctrl+C to stop.');

        // Fetch all IMAGE objects from the catalog, handling pagination
        console.log('Fetching all catalog images (with pagination)...');
        const images = await fetchAllImages(catalogClient);
        
        console.log(`Found ${images.length} images to delete.`);
        if (images.length > 0) {
            console.log('Sample image IDs:', images.slice(0, 3).map(img => img.id));
        }

        // Delete images in batches to avoid rate limiting
        const batchSize = 100;
        let deletedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < images.length; i += batchSize) {
            const batch = images.slice(i, i + batchSize);
            console.log(`\nDeleting batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(images.length / batchSize)}...`);
            
            try {
                // Create batch delete request
                const batchRequest: BatchDeleteCatalogObjectsRequest = {
                    objectIds: batch.map(image => image.id)
                };

                console.log(`Attempting to delete batch of ${batch.length} images...`);
                const response = await catalogClient.client.catalogApi.batchDeleteCatalogObjects(batchRequest);
                
                if (response.result.deletedObjectIds) {
                    deletedCount += response.result.deletedObjectIds.length;
                    console.log(`Successfully deleted ${response.result.deletedObjectIds.length} images in this batch`);
                }

                if (response.result.errors && response.result.errors.length > 0) {
                    errorCount += response.result.errors.length;
                    console.error('Errors in batch:', response.result.errors);
                }

            } catch (error: any) {
                errorCount += batch.length;
                console.error(`Error deleting batch:`, error.response?.data || error.message);
            }

            // Add a small delay between batches to avoid rate limiting
            if (i + batchSize < images.length) {
                console.log('Waiting 1 second before next batch...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`\nImage deletion completed:`);
        console.log(`- Successfully deleted: ${deletedCount} images`);
        console.log(`- Failed to delete: ${errorCount} images`);
        console.log(`- Total images processed: ${images.length}`);

    } catch (error: any) {
        console.error('Error in main process:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nStopping image deletion...');
    process.exit(0);
});

// Start deleting images
deleteAllImages(); 