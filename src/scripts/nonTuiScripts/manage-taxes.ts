import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
    .command('create', 'Create default taxes')
    .command('list', 'List all taxes')
    .command('delete', 'Delete all taxes')
    .option('access-token', {
        alias: 't',
        type: 'string',
        description: 'Square API access token (overrides .env AUTH_TOKEN)'
    })
    .demandCommand(1, 'You need to specify a command')
    .help()
    .argv as any;

// Get access token from command line or environment
const accessToken = argv['access-token'] || process.env.AUTH_TOKEN;
if (!accessToken) {
    console.error('Error: Access token is required. Provide it via --access-token or AUTH_TOKEN environment variable');
    process.exit(1);
}

async function createTaxes() {
    const squareManager = new SquareManager(accessToken);
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
    const squareManager = new SquareManager(accessToken);
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
    const squareManager = new SquareManager(accessToken);
    try {
        console.log('Deleting all taxes...');
        await squareManager.deleteTaxes();
        console.log('All taxes deleted successfully');
    } catch (error) {
        console.error('Error deleting taxes:', error);
        process.exit(1);
    }
}

// Execute the command
const command = argv._[0];

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
        console.error('Invalid command. Use --help to see available commands.');
        process.exit(1);
} 