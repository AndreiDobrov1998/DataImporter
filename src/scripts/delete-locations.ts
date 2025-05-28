import { Client, Environment } from 'square';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
    .option('count', {
        alias: 'c',
        type: 'number',
        description: 'Number of locations to delete',
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

async function deleteLocations(numberOfLocations: number) {
  try {
    const response = await client.locationsApi.listLocations();
    const locations = response.result.locations || [];
    const locationsToDelete = locations.slice(0, numberOfLocations);

    for (const location of locationsToDelete) {
      if (location.id) {
        let retryCount = 0;
        const maxRetries = 3;
        const delay = 1000; // 1 second

        while (retryCount < maxRetries) {
          try {
            await client.locationsApi.updateLocation(location.id, { location: { status: 'INACTIVE' } });
            console.log(`Location updated: ${location.name}`);
            break;
          } catch (error: any) {
            if (error.statusCode === 429 && retryCount < maxRetries) {
              console.warn(`Rate limited (429). Retrying in ${delay / 1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
            } else {
              throw error;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error deleting locations:', error);
  }
}

// Start deleting locations
deleteLocations(argv.count); 