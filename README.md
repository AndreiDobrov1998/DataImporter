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

Generates orders with random quantities for each catalog item variation. The script now skips combo items and handles version checking more efficiently.

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

### Workday Simulator

A comprehensive tool for simulating a day's worth of catalog and order operations. The simulator provides an interactive interface to perform various operations on your Square catalog and generate orders.

```bash
npm start
```

The simulator offers the following operations:

1. **Edit Item Prices**: Randomly updates prices for selected items
2. **Edit Item Titles**: Updates item names with new generated titles
3. **Add Item Variations**: Adds new variations to existing items
4. **Remove Item Variations**: Removes random variations from items
5. **Assign Categories and Modifiers**: Assigns random categories and modifiers to items
6. **Run Order Generator**: Generates orders with configurable parameters

Configuration options:
- `--access-token` or `-t`: Square API access token (overrides .env AUTH_TOKEN)

Example:
```bash
# Run simulator using .env AUTH_TOKEN
npm start

# Run simulator with custom access token
npm start -- --access-token "your_token_here"
```

Features:
- Interactive menu-driven interface
- Configurable number of items to process
- Automatic order generation with payment processing
- Error handling and retry mechanisms
- Detailed operation summaries
- Concurrent order processing

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

## Terminal UI for Running Scripts

You can now run any script from `src/scripts/` using an interactive terminal UI powered by Enquirer.

### How to Use

1. **Start the TUI:**
   ```sh
   npx ts-node scripts/tui.ts
   ```
2. **Select a script** from the list.
3. The script's `--help` output will be shown for reference.
4. **Enter parameters** as CLI flags (comma separated), for example:
   ```
   --access-token=YOUR_TOKEN, --min-quantity=2, --max-quantity=5
   ```
   - Use double dashes (`--`) for flags, just like you would on the command line.
   - You can leave it blank if no parameters are needed.
5. The script will run and output will be shown in the terminal.

### Example

```
? Select a script to run · order-data-generator.ts

--- Script Help ---
Options:
      --version              Show version number                       [boolean]
      --min-quantity, --min  Minimum quantity per order    [number] [default: 1]
      --max-quantity, --max  Maximum quantity per order    [number] [default: 3]
  -c, --concurrency          Number of concurrent orders to process
                                                          [number] [default: 10]
  -t, --access-token         Square API access token (overrides .env AUTH_TOKEN)
                                                                        [string]
      --help                 Show help                                 [boolean]
-------------------
? Enter parameters as key=value pairs (comma separated), or leave blank: · --access-token=YOUR_TOKEN, --min-quantity=2
```

**Note:**
- You can also set environment variables (like `AUTH_TOKEN`) when running the TUI:
  ```sh
  AUTH_TOKEN=your_token npx ts-node scripts/tui.ts
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

## Token Management

The project includes a flexible token management script (`run-all-tokens.sh`) that allows you to process orders with multiple Square API tokens sequentially.

### Features
- Process multiple tokens in sequence
- Configurable order parameters
- Clear progress tracking
- Easy token management

### Usage

1. Make the script executable:
```bash
chmod +x run-all-tokens.sh
```

2. Edit the script to add your tokens:
```bash
# Array of tokens
tokens=(
    "your_first_token_here"
    "your_second_token_here"
    "your_third_token_here"
)
```

3. Configure the parameters (optional):
```bash
# Default parameters
MIN_QUANTITY=2
MAX_QUANTITY=5
CONCURRENCY=10
```

4. Run the script:
```bash
./run-all-tokens.sh
```

### Example Output
```
Starting order generation with 3 tokens...
Parameters: min-quantity=2, max-quantity=5, concurrency=10
----------------------------------------
Running with token 1...
[Order generation output]
----------------------------------------
Running with token 2...
[Order generation output]
----------------------------------------
Running with token 3...
[Order generation output]
----------------------------------------
All tokens processed!
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