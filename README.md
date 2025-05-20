# Square Order Generator

A Node.js application for generating and managing Square orders, catalog items, and locations.

## Features

- Generate random orders with items from your Square catalog
- Import and manage catalog items with images
- Manage taxes
- Delete orders
- Support for multiple locations

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Square Developer Account
- Square API Access Token

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd square-order-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Square API credentials:
```
AUTH_TOKEN=your_square_access_token
```

## Usage

### Generate Orders
```bash
# Generate a specific number of orders
npx ts-node src/scripts/generate-orders.ts [number_of_orders]

# Generate orders with specific parameters
npx ts-node src/scripts/generate-orders.ts --orders 10 --items 5 --taxes 2
```

### Manage Catalog
```bash
# Import catalog with default parameters (3 categories, 10 items per category, 3 modifier groups, 5 modifiers per group)
npx ts-node src/scripts/import-catalog.ts

# Import catalog with custom parameters
npx ts-node src/scripts/import-catalog.ts --categories 5 --items 15 --modifier-groups 4 --modifiers-per-group 6

# Import catalog with images (same parameters as import-catalog.ts)
npx ts-node src/scripts/import-catalog-with-images.ts --categories 5 --items 15 --modifier-groups 4 --modifiers-per-group 6

# Delete all catalog items
npx ts-node src/scripts/delete-catalog.ts

# Delete all catalog images
npx ts-node src/scripts/delete-images.ts
```

### Command-line Parameters for Catalog Import
- `--categories` or `-c`: Number of categories to create (default: 3)
- `--items` or `-i`: Number of items per category (default: 10)
- `--modifier-groups` or `-g`: Number of modifier groups to create (default: 3)
- `--modifiers-per-group` or `-m`: Number of modifiers per group (default: 5)

### Catalog Naming Conventions
- Categories: `Category SQ-01`, `Category SQ-02`, etc.
- Items: `Item SQ-0001`, `Item SQ-0002`, etc. (global sequential numbering)
- Modifier Groups: `Modifier SQ-01`, `Modifier SQ-02`, etc.
- Modifiers: `Modifier SQ-01-01`, `Modifier SQ-01-02`, etc.

### Catalog Images
The catalog import with images feature:
- Downloads random food images for each item and variation
- Uses Picsum service for high-quality random images
- Processes images to 800x800 JPEG format with 80% quality
- Implements parallel processing with rate limiting
- Includes retry mechanism for failed uploads
- Cleans up temporary files after processing

### Performance Metrics
The catalog import process has been optimized for performance:
- Average processing time: ~1.2 minutes per category
- Average item processing: ~3.7 seconds per item
- Average variation processing: ~0.8 seconds per variation
- Image processing throughput: ~1.3 items per second
- Parallel processing with rate limiting to prevent API throttling
- Automatic cleanup of temporary files

### Error Handling
The import process includes robust error handling:
- Rate limit detection and automatic retry
- Network error recovery
- Detailed error logging with timestamps
- Automatic cleanup on failure
- Progress tracking for long-running imports

### Logging System
The import process includes a comprehensive logging system:
- Timestamped log messages for all operations
- Visual indicators for different log types:
  - ℹ️ for information messages
  - ⚠️ for warnings
  - ❌ for errors
- Detailed logging for:
  - Category creation and processing
  - Item creation and image processing
  - Variation creation and image processing
  - Batch processing status
  - API responses and errors
- Sequential flow tracking for better debugging

### Manage Taxes
```bash
# Create taxes
npx ts-node src/scripts/manage-taxes.ts create

# List taxes
npx ts-node src/scripts/manage-taxes.ts list

# Delete taxes
npx ts-node src/scripts/manage-taxes.ts delete
```

### Manage Locations
```bash
# Create locations
npx ts-node src/scripts/create-locations.ts [number_of_locations]

# Delete specific number of locations
npx ts-node src/scripts/delete-locations.ts [number_of_locations]

# Delete all locations
npx ts-node src/scripts/delete-all-locations.ts
```

### Generate Order Data
```bash
# Generate order data for all catalog items
npx ts-node src/scripts/order-data-generator.ts
```

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

## Order Data Generator

The `order-data-generator.ts` script generates orders for all catalog items using the Square API. It uses the `SquareManager` class to interact with the Square API.

### Usage

To run the order data generator, use the following command:

```bash
npx ts-node src/scripts/order-data-generator.ts
```

### Features

- Fetches all catalog items and generates orders for each item.
- Uses random quantities (1-3) for each order.
- Applies taxes if available.
- Includes a delay between orders to avoid rate limiting.

### Prerequisites

- Ensure you have the necessary environment variables set up in your `.env` file.
- Make sure you have the required dependencies installed by running `npm install`.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 