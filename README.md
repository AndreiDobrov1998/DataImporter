# Square Order Generator

A standalone tool for generating and managing orders in Square. This tool provides functionality for creating, managing, and deleting orders in your Square account.

## Features

- Generate random orders with items from your Square catalog
- Import and manage catalog items
- Manage taxes
- Delete orders
- Support for multiple locations

## Prerequisites

- Node.js (v14 or higher)
- npm
- Square Developer Account
- Square API Access Token

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
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
npm run dev
```

### Import Catalog
```bash
npm run import-catalog
```

### Delete Catalog
```bash
npm run delete-catalog
```

### Manage Taxes
```bash
# Create taxes
npm run manage-taxes create

# List taxes
npm run manage-taxes list

# Delete taxes
npm run manage-taxes delete
```

## Development

- `npm run build` - Build the project
- `npm run start` - Run the built project
- `npm run dev` - Run the project in development mode

## License

[Your License] 