import { Client, Environment } from 'square';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
    .option('count', {
        type: 'number',
        description: 'Number of locations to create',
        default: 1
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

const client = new Client({
    accessToken,
    environment: Environment.Production,
});

async function createLocations(numberOfLocations: number) {
    for (let i = 0; i < numberOfLocations; i++) {
        const locationData = {
            location: {
                name: `Location ${i + 1}`,
                address: {
                    addressLine1: `${i + 1} Main St`,
                    locality: 'San Francisco',
                    administrativeDistrictLevel1: 'CA',
                    postalCode: '94105',
                    country: 'US',
                },
                phoneNumber: `+1-555-${i + 1}-${i + 1}-${i + 1}`,
                businessEmail: `location${i + 1}@example.com`,
                type: 'PHYSICAL',
            },
        };

        try {
            const response = await client.locationsApi.createLocation(locationData);
            if (response.result.location) {
                console.log(`Location created: ${response.result.location.name}`);
            } else {
                console.error(`Location creation response did not include location data.`);
            }
        } catch (error) {
            console.error(`Error creating location ${i + 1}:`, error);
        }

        // Add a delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Start creating locations
createLocations(argv.count); 