import { Client, Environment } from 'square';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  accessToken: process.env.AUTH_TOKEN,
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

deleteAllLocations(); 