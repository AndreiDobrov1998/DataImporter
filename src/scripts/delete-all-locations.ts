import { Client, Environment } from 'square';
import dotenv from 'dotenv';
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

const client = new Client({
    accessToken,
    environment: Environment.Production,
});

async function deleteAllLocations() {
    try {
        const response = await client.locationsApi.listLocations();
        const locations = response.result.locations || [];

        for (const location of locations) {
            if (location.id) {
                await client.locationsApi.updateLocation(location.id, { location: { status: 'INACTIVE' } });
                console.log(`Location updated: ${location.name}`);
            }
        }
    } catch (error) {
        console.error('Error deleting all locations:', error);
    }
}

// Start deleting locations
deleteAllLocations(); 