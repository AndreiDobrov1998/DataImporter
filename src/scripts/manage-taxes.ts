import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['AUTH_TOKEN'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: ${envVar} environment variable is required`);
        process.exit(1);
    }
}

async function createTaxes() {
    const squareManager = new SquareManager();
    try {
        // Example taxes
        const taxes = [
            {
                name: 'Sales Tax',
                calculationPhase: 'TAX_SUBTOTAL_PHASE' as const,
                percentage: '8.5',
                appliesToCustomAmounts: true,
                enabled: true,
                inclusionType: 'ADDITIVE' as const
            },
            {
                name: 'Local Tax',
                calculationPhase: 'TAX_SUBTOTAL_PHASE' as const,
                percentage: '1.5',
                appliesToCustomAmounts: true,
                enabled: true,
                inclusionType: 'ADDITIVE' as const
            }
        ];

        console.log('Creating taxes...');
        const result = await squareManager.batchCreateTaxes(taxes);
        console.log('Taxes created successfully:', result);
    } catch (error) {
        console.error('Error creating taxes:', error);
        process.exit(1);
    }
}

async function listTaxes() {
    const squareManager = new SquareManager();
    try {
        console.log('Listing taxes...');
        const taxes = await squareManager.listTaxes();
        console.log('Current taxes:', taxes);
    } catch (error) {
        console.error('Error listing taxes:', error);
        process.exit(1);
    }
}

async function deleteTaxes() {
    const squareManager = new SquareManager();
    try {
        console.log('Deleting all taxes...');
        await squareManager.deleteTaxes();
        console.log('All taxes deleted successfully');
    } catch (error) {
        console.error('Error deleting taxes:', error);
        process.exit(1);
    }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
    case 'create':
        createTaxes();
        break;
    case 'list':
        listTaxes();
        break;
    case 'delete':
        deleteTaxes();
        break;
    default:
        console.log('Usage: npm run manage-taxes <command>');
        console.log('Commands:');
        console.log('  create - Create default taxes');
        console.log('  list   - List all taxes');
        console.log('  delete - Delete all taxes');
        process.exit(1);
} 