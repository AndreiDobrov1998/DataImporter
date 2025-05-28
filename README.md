# Square Order Generator

A Node.js application for generating test data in Square, including locations, catalog items, and orders.

## Prerequisites

- Node.js (v14 or higher)
- Square Developer Account
- Square API Access Token

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/square-order-generator.git
cd square-order-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Square API access token:
```
AUTH_TOKEN=your_square_access_token_here
```

## Available Scripts

### Create Multiple Locations

Creates multiple locations in your Square account.

```bash
npx ts-node src/scripts/create-locations.ts --count 300
```

Configuration options:
- `--count` or `-c`: Number of locations to create (default: 300)
- `--access-token` or `-t`: Square API access token (overrides .env AUTH_TOKEN)

Example:
```bash
# Create 300 locations using .env AUTH_TOKEN
npx ts-node src/scripts/create-locations.ts --count 300

# Create 100 locations with custom access token
npx ts-node src/scripts/create-locations.ts --count 100 --access-token "your_token_here"
```

### Delete All Locations

Deletes all locations in your Square account by setting them to inactive.

```bash
npx ts-node src/scripts/delete-all-locations.ts
```

Configuration options:
- `--access-token` or `-t`: Square API access token (overrides .env AUTH_TOKEN)

Example:
```bash
# Delete all locations using .env AUTH_TOKEN
npx ts-node src/scripts/delete-all-locations.ts

# Delete all locations with custom access token
npx ts-node src/scripts/delete-all-locations.ts --access-token "your_token_here"
```

### Generate Numbered Images

Generates numbered images for catalog items.

```bash
npx ts-node src/scripts/generate-numbered-images.ts --count 30
```

Configuration options:
- `--count` or `-c`: Number of images to generate (default: 30)
- `--access-token` or `-t`: Square API access token (overrides .env AUTH_TOKEN)

Example:
```bash
# Generate 30 images using .env AUTH_TOKEN
npx ts-node src/scripts/generate-numbered-images.ts --count 30

# Generate 50 images with custom access token
npx ts-node src/scripts/generate-numbered-images.ts --count 50 --access-token "your_token_here"
```

### Import Catalog with Images

Imports catalog items with images into your Square account.

```bash
npx ts-node src/scripts/import-catalog-with-images.ts
```

Configuration options:
- `--access-token` or `-t`: Square API access token (overrides .env AUTH_TOKEN)

Example:
```bash
# Import catalog using .env AUTH_TOKEN
npx ts-node src/scripts/import-catalog-with-images.ts

# Import catalog with custom access token
npx ts-node src/scripts/import-catalog-with-images.ts --access-token "your_token_here"
```

### Generate Orders

Generates orders with random quantities for each catalog item variation.

```bash
npx ts-node src/scripts/order-data-generator.ts --min-quantity 2 --max-quantity 5 --concurrency 10
```

Configuration options:
- `--min-quantity` or `-min`: Minimum quantity per order (default: 1)
- `--max-quantity` or `-max`: Maximum quantity per order (default: 3)
- `--concurrency` or `-c`: Number of concurrent orders to process (default: 10)
- `--access-token` or `-t`: Square API access token (overrides .env AUTH_TOKEN)

Example:
```bash
# Generate orders with quantities 2-5 using 10 concurrent workers
npx ts-node src/scripts/order-data-generator.ts --min-quantity 2 --max-quantity 5 --concurrency 10

# Generate orders with custom parameters and access token
npx ts-node src/scripts/order-data-generator.ts --min-quantity 1 --max-quantity 10 --concurrency 20 --access-token "your_token_here"
```

### Manage Taxes

Manages tax rates in your Square account.

```bash
# Create taxes
npx ts-node src/scripts/manage-taxes.ts create

# List taxes
npx ts-node src/scripts/manage-taxes.ts list

# Delete taxes
npx ts-node src/scripts/manage-taxes.ts delete
```

Configuration options:
- `--access-token` or `-t`: Square API access token (overrides .env AUTH_TOKEN)

Example:
```bash
# Create taxes using .env AUTH_TOKEN
npx ts-node src/scripts/manage-taxes.ts create

# List taxes with custom access token
npx ts-node src/scripts/manage-taxes.ts list --access-token "your_token_here"
```

## Performance Optimization

The order generation script (`order-data-generator.ts`) has been optimized for high performance:

1. **Parallel Processing**: Uses a worker pool to process multiple orders concurrently
2. **Configurable Concurrency**: Control the number of concurrent orders with the `--concurrency` option
3. **No Artificial Delays**: Processes orders as fast as possible while respecting API limits
4. **Efficient Resource Usage**: Uses `p-limit` for controlled concurrency without memory issues

Example of high-performance order generation:
```bash
# Process 60 orders with 10 concurrent workers
npx ts-node src/scripts/order-data-generator.ts --min-quantity 2 --max-quantity 5 --concurrency 10
```

## Error Handling

All scripts include comprehensive error handling:
- Validates access token presence
- Handles API rate limits
- Provides clear error messages
- Gracefully handles failed operations

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 