import { Client, Environment } from 'square';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  accessToken: process.env.AUTH_TOKEN,
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

const numberOfLocations = parseInt(process.argv[2], 10) || 1;
createLocations(numberOfLocations); 