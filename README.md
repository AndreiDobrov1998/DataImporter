# Square Order Generator

A TypeScript-based toolset for managing Square catalog items, locations, and orders. This project provides a collection of scripts to automate various Square API operations, including image generation, catalog management, and order processing.

## Scripts

### Catalog Management

#### Generate Numbered Images
`src/scripts/generate-numbered-images.ts`

Generates numbered images and optionally uploads them to Square catalog.

**Configuration Options:**
- `--format`: Image format (jpg, jpeg, png, gif) [default: jpg]
- `--total-images`: Total number of images to generate [default: 10]
- `--batch-size`: Number of images to upload in each batch [default: 10]
- `--base-size`: Base image size in pixels [default: 1800]
- `--font-size`: Font size for numbers [default: 750]
- `--padding-length`: Number of digits to pad with zeros [default: auto-calculated]

**Examples:**
```bash
# Generate 10 JPEG images
npx ts-node src/scripts/generate-numbered-images.ts

# Generate 3000 PNG images with custom size
npx ts-node src/scripts/generate-numbered-images.ts --format png --total-images 3000 --base-size 2000

# Generate 50 GIF images with custom font size
npx ts-node src/scripts/generate-numbered-images.ts --format gif --total-images 50 --font-size 500
```

#### Delete Catalog Images
`src/scripts/delete-images.ts`

Deletes all images from the Square catalog.

**Configuration Options:**
- `--batch-size`: Number of images to delete in each batch [default: 100]
- `--delay`: Delay between batches in milliseconds [default: 1000]

**Examples:**
```bash
# Delete all images with default settings
npx ts-node src/scripts/delete-images.ts

# Delete images with custom batch size and delay
npx ts-node src/scripts/delete-images.ts --batch-size 50 --delay 2000
```

#### Import Catalog
`src/scripts/import-catalog.ts`

Imports catalog items with categories and modifiers.

**Configuration Options:**
- `--categories` or `-c`: Number of categories to create [default: 3]
- `--items` or `-i`: Number of items per category [default: 10]
- `--modifier-groups` or `-g`: Number of modifier groups [default: 3]
- `--modifiers-per-group` or `-m`: Number of modifiers per group [default: 5]

**Examples:**
```bash
# Import catalog with default parameters
npx ts-node src/scripts/import-catalog.ts

# Import catalog with custom parameters
npx ts-node src/scripts/import-catalog.ts --categories 5 --items 15 --modifier-groups 4 --modifiers-per-group 6
```

#### Import Catalog with Images
`src/scripts/import-catalog-with-images.ts`

Imports catalog items with images, categories, and modifiers.

**Configuration Options:**
- Same as import-catalog.ts
- Images are automatically downloaded and processed to 800x800 JPEG format
- Includes parallel processing with rate limiting

**Examples:**
```bash
# Import catalog with images using default parameters
npx ts-node src/scripts/import-catalog-with-images.ts

# Import catalog with images using custom parameters
npx ts-node src/scripts/import-catalog-with-images.ts --categories 5 --items 15
```

#### Delete Catalog
`src/scripts/delete-catalog.ts`

Deletes all catalog items from Square.

**Examples:**
```bash
# Delete all catalog items
npx ts-node src/scripts/delete-catalog.ts
```

### Location Management

#### Create Location
`src/scripts/create-location.ts`

Creates a new Square location.

**Configuration Options:**
- `--name`: Location name [required]
- `--address`: Location address [required]
- `--phone`: Location phone number [optional]
- `--website`: Location website [optional]

**Examples:**
```bash
# Create a new location
npx ts-node src/scripts/create-location.ts --name "Main Store" --address "123 Main St"
```

#### Create Multiple Locations
`src/scripts/create-locations.ts`

Creates multiple Square locations.

**Configuration Options:**
- `--count`: Number of locations to create [default: 1]

**Examples:**
```bash
# Create 5 locations
npx ts-node src/scripts/create-locations.ts --count 5
```

#### Delete Locations
`src/scripts/delete-locations.ts`

Deletes a specific number of locations.

**Configuration Options:**
- `--count`: Number of locations to delete [default: 1]

**Examples:**
```bash
# Delete 3 locations
npx ts-node src/scripts/delete-locations.ts --count 3
```

#### Delete All Locations
`src/scripts/delete-all-locations.ts`

Deletes all locations from Square.

**Examples:**
```bash
# Delete all locations
npx ts-node src/scripts/delete-all-locations.ts
```

### Order Management

#### Generate Orders
`src/scripts/generate-orders.ts`

Generates test orders in Square.

**Configuration Options:**
- `--total-orders`: Number of orders to generate [default: 10]
- `--items-per-order`: Number of items per order [default: 3]
- `--location-id`: Square location ID [required]

**Examples:**
```bash
# Generate 10 orders with 3 items each
npx ts-node src/scripts/generate-orders.ts --location-id "LOCATION_ID"

# Generate 50 orders with 5 items each
npx ts-node src/scripts/generate-orders.ts --total-orders 50 --items-per-order 5 --location-id "LOCATION_ID"
```

#### Generate Order Data
`src/scripts/order-data-generator.ts`

Generates orders for all catalog items.

**Features:**
- Fetches all catalog items
- Generates orders with random quantities (1-3)
- Applies taxes if available
- Includes delay between orders to avoid rate limiting

**Examples:**
```bash
# Generate orders for all catalog items
npx ts-node src/scripts/order-data-generator.ts
```

### Tax Management

#### Manage Taxes
`src/scripts/manage-taxes.ts`

Manages Square taxes.

**Commands:**
- `create`: Create taxes
- `list`: List all taxes
- `delete`: Delete all taxes

**Examples:**
```bash
# Create taxes
npx ts-node src/scripts/manage-taxes.ts create

# List taxes
npx ts-node src/scripts/manage-taxes.ts list

# Delete taxes
npx ts-node src/scripts/manage-taxes.ts delete
```

## Environment Setup

1. Create a `.env` file in the root directory with your Square API credentials:
```
SQUARE_ACCESS_TOKEN=your_access_token
SQUARE_ENVIRONMENT=sandbox
```

2. Install dependencies:
```bash
npm install
```

## Notes

- All scripts use TypeScript and require Node.js
- Make sure to have proper Square API credentials with appropriate permissions
- The sandbox environment is recommended for testing
- Generated images are saved in the `output/` directory
- Temporary files are stored in `temp_images/` directory

## Project Structure

```
src/
├── scripts/
│   ├── generate-orders.ts
│   ├── import-catalog.ts
│   ├── import-catalog-with-images.ts
│   ├── delete-catalog.ts
│   ├── delete-images.ts
│   ├── create-locations.ts
│   ├── delete-locations.ts
│   ├── delete-all-locations.ts
│   ├── manage-taxes.ts
│   └── order-data-generator.ts
└── module/
    └── external/
        └── square/
            ├── common/
            │   └── SquareBaseClient.ts
            └── catalog/
                └── api/
                    ├── SquareCatalogClient.ts
                    └── SquareManager.ts
```

## Development

- `npm run build` - Build the project
- `npm run start` - Run the built project
- `npm run orders-create` - Run the project in development mode

## License

This project is licensed under the MIT License - see the LICENSE file for details. 