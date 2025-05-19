import { Client, Environment } from 'square';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  accessToken: process.env.AUTH_TOKEN,
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

const numberOfLocations = parseInt(process.argv[2], 10) || 1;
deleteLocations(numberOfLocations); 