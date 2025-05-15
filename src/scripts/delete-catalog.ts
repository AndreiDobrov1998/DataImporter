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

async function safeBatchDelete(catalogClient: SquareManager, ids: string[], maxRetries = 5) {
    let attempt = 0;
    let delay = 10000; // 10 seconds
    while (attempt <= maxRetries) {
        try {
            await catalogClient.batchDeleteCatalogObjects(ids);
            return;
        } catch (error: any) {
            if (error.statusCode === 429 && attempt < maxRetries) {
                console.warn(`Rate limited (429). Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(res => setTimeout(res, delay));
                attempt++;
                delay *= 2;
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached for batchDeleteCatalogObjects');
}

async function deleteAllModifiers(catalogClient: SquareManager) {
    console.log('Deleting all modifiers...');
    let listed: string[] = [];
    let totalDeleted = 0;
    do {
        listed = await catalogClient.listCatalogIds(['MODIFIER_LIST']);
        if (listed.length > 0) {
            for (const id of listed) {
                console.log(`Deleting modifier: ${id}`);
                await safeBatchDelete(catalogClient, [id]);
                totalDeleted++;
            }
        }
    } while (listed.length > 0);
    console.log(`Total modifiers deleted: ${totalDeleted}`);
}

async function deleteAllCatalogObjects(catalogClient: SquareManager) {
    console.log('Deleting all catalog objects...');
    await deleteAllModifiers(catalogClient);
    let listed: string[] = [];
    let totalDeleted = 0;
    do {
        listed = await catalogClient.listCatalogIds(['ITEM', 'CATEGORY', 'DISCOUNT']);
        if (listed.length > 0) {
            for (let i = 0; i < listed.length; i += 1000) {
                const batch = listed.slice(i, i + 1000);
                console.log(`Deleting ${batch.length} catalog objects...`);
                await safeBatchDelete(catalogClient, batch);
                totalDeleted += batch.length;
                console.log(`Total catalog objects deleted so far: ${totalDeleted}`);
            }
        }
    } while (listed.length > 0);
    console.log(`Total catalog objects deleted: ${totalDeleted}`);
}

async function deleteCatalog() {
    const catalogClient = new SquareManager();
    try {
        await deleteAllCatalogObjects(catalogClient);
        console.log('All catalog objects deleted successfully!');
    } catch (error) {
        console.error('Error deleting catalog objects:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nStopping catalog deletion...');
    process.exit(0);
});

// Start deleting catalog objects
console.log('Starting catalog deletion. Press Ctrl+C to stop.');
deleteCatalog(); 