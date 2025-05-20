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
    const catalogClient = new SquareManager();
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
        const batchSize = 10;
        let deletedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < images.length; i += batchSize) {
            const batch = images.slice(i, i + batchSize);
            console.log(`\nDeleting batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(images.length / batchSize)}...`);
            
            for (const image of batch) {
                try {
                    console.log(`Attempting to delete image: ${image.id}`);
                    await catalogClient.client.catalogApi.deleteCatalogObject(image.id);
                    deletedCount++;
                    console.log(`Successfully deleted image: ${image.id}`);
                } catch (error: any) {
                    errorCount++;
                    console.error(`Error deleting image ${image.id}:`, error.response?.data || error.message);
                }
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