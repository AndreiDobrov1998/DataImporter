import { faker } from '@faker-js/faker';
import { SquareManager } from '../module/external/square/catalog/api/SquareCatalogClient';
import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import pLimit from 'p-limit';
import { Client } from 'square';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
    .option('min-quantity', {
        alias: 'min',
        type: 'number',
        description: 'Minimum quantity per order',
        default: 1
    })
    .option('max-quantity', {
        alias: 'max',
        type: 'number',
        description: 'Maximum quantity per order',
        default: 3
    })
    .option('concurrency', {
        alias: 'c',
        type: 'number',
        description: 'Number of concurrent orders to process',
        default: 10
    })
    .option('access-token', {
        alias: 't',
        type: 'string',
        description: 'Square API access token (overrides .env AUTH_TOKEN)'
    })
    .help()
    .argv as { [key: string]: unknown; 'min-quantity': number; 'max-quantity': number; concurrency: number; 'access-token'?: string };

// Get access token from command line or environment
const accessToken = argv['access-token'] || process.env.AUTH_TOKEN;
if (!accessToken) {
    console.error('Error: Access token is required. Provide it via --access-token or AUTH_TOKEN environment variable');
    process.exit(1);
}

// Constants
const MIN_QUANTITY = argv['min-quantity'];
const MAX_QUANTITY = argv['max-quantity'];
const CONCURRENCY = argv.concurrency;

interface CatalogVariation {
    id?: string;
    type?: string;
    updatedAt?: string;
    version?: number;
    isDeleted?: boolean;
    presentAtAllLocations?: boolean;
    itemVariationData?: {
        itemId?: string;
        name?: string;
        sku?: string;
        pricingType?: string;
        priceMoney?: {
            amount?: number;
            currency?: string;
        };
    };
}

async function verifyCatalogObject(client: Client, objectId: string): Promise<{ exists: boolean }> {
    try {
        const response = await client.catalogApi.retrieveCatalogObject(objectId);
        const object = response.result.object;
        return { exists: !!object };
    } catch (error) {
        console.error(`Error verifying catalog object ${objectId}:`, error);
        return { exists: false };
    }
}

async function createOrderWithPayment(
    client: Client,
    locationId: string,
    variationId: string,
    itemId: string,
    quantity: number
): Promise<void> {
    try {
        const verification = await verifyCatalogObject(client, variationId);
        if (!verification.exists) {
            console.log(`Skipping order creation for non-existent variation ${variationId}`);
            return;
        }
        console.log(`Creating order for variation ${variationId} (item ${itemId}) with quantity ${quantity}`);
        const orderResponse = await client.ordersApi.createOrder({
            order: {
                locationId,
                lineItems: [
                    {
                        quantity: quantity.toString(),
                        catalogObjectId: variationId,
                        appliedTaxes: []
                    }
                ],
                fulfillments: [
                    {
                        type: 'PICKUP',
                        pickupDetails: {
                            recipient: {
                                displayName: faker.person.fullName()
                            },
                            pickupAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                        }
                    }
                ]
            },
            idempotencyKey: crypto.randomUUID()
        });
        const order = orderResponse.result.order;
        if (!order) throw new Error('No order returned from API');
        console.log(`Creating payment for order ID: ${order.id}`);
        const paymentResponse = await client.paymentsApi.createPayment({
            sourceId: 'CASH',
            amountMoney: {
                amount: BigInt(order.totalMoney?.amount || 0),
                currency: 'USD'
            },
            locationId,
            orderId: order.id,
            idempotencyKey: crypto.randomUUID(),
            cashDetails: {
                buyerSuppliedMoney: {
                    amount: BigInt(order.totalMoney?.amount || 0),
                    currency: 'USD'
                }
            }
        });
        const payment = paymentResponse.result.payment;
        if (!payment) throw new Error('No payment returned from API');
        console.log(`Payment created successfully for order ID: ${order.id}, Payment ID: ${payment.id}, Amount: ${payment.amountMoney?.amount} ${payment.amountMoney?.currency}`);
        console.log(`                           Created order ${order.id} with payment ${payment.id} (${quantity} items)`);
    } catch (error: unknown) {
        if (typeof error === 'object' && error && 'statusCode' in error && (error as any).statusCode === 404 && (error as any).errors?.[0]?.code === 'NOT_FOUND') {
            try {
                console.log(`Retrying order creation for variation ${variationId} without version information`);
                const orderResponse = await client.ordersApi.createOrder({
                    order: {
                        locationId,
                        lineItems: [
                            {
                                quantity: quantity.toString(),
                                catalogObjectId: variationId,
                                appliedTaxes: []
                            }
                        ],
                        fulfillments: [
                            {
                                type: 'PICKUP',
                                pickupDetails: {
                                    recipient: {
                                        displayName: faker.person.fullName()
                                    },
                                    pickupAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                                }
                            }
                        ]
                    },
                    idempotencyKey: crypto.randomUUID()
                });
                const order = orderResponse.result.order;
                if (!order) throw new Error('No order returned from API');
                console.log(`Creating payment for order ID: ${order.id}`);
                const paymentResponse = await client.paymentsApi.createPayment({
                    sourceId: 'CASH',
                    amountMoney: {
                        amount: BigInt(order.totalMoney?.amount || 0),
                        currency: 'USD'
                    },
                    locationId,
                    orderId: order.id,
                    idempotencyKey: crypto.randomUUID(),
                    cashDetails: {
                        buyerSuppliedMoney: {
                            amount: BigInt(order.totalMoney?.amount || 0),
                            currency: 'USD'
                        }
                    }
                });
                const payment = paymentResponse.result.payment;
                if (!payment) throw new Error('No payment returned from API');
                console.log(`Payment created successfully for order ID: ${order.id}, Payment ID: ${payment.id}, Amount: ${payment.amountMoney?.amount} ${payment.amountMoney?.currency}`);
                console.log(`                           Created order ${order.id} with payment ${payment.id} (${quantity} items)`);
                return;
            } catch (retryError) {
                console.error(`Error creating order for variation ${variationId} of item ${itemId}:`);
                console.error('Detailed error:', JSON.stringify((retryError as any).errors || retryError, null, 2));
                return;
            }
        }
        console.error(`Error creating order for variation ${variationId} of item ${itemId}:`);
        console.error('Detailed error:', JSON.stringify((error as any).errors || error, null, 2));
    }
}

async function processCatalogItems(catalogClient: SquareManager): Promise<void> {
    try {
        await catalogClient.initializeLocations();
        const catalogItems = await catalogClient.getAllCatalogItems(['ITEM']);
        console.log(`Found ${catalogItems.length} items in the catalog.`);
        let skippedItems = 0;
        let invalidVariations = 0;
        let skippedCombos = 0;
        const variationsToProcess: { variationId: string; itemId: string }[] = [];
        const verifyLimit = pLimit(CONCURRENCY);
        for (const item of catalogItems) {
            if (item.itemData?.type === 'COMBO') {
                console.log(`Skipping combo item ${item.id}`);
                skippedCombos++;
                continue;
            }
            if (!item.itemData?.variations || item.itemData.variations.length === 0) {
                skippedItems++;
                continue;
            }
            const verificationPromises = item.itemData.variations.map(async (variation: CatalogVariation) => {
                if (!variation.id) {
                    skippedItems++;
                    return null;
                }
                const variationId = variation.id;
                const exists = await verifyLimit(() => verifyCatalogObject(catalogClient.client, variationId));
                if (!exists) {
                    console.log(`Skipping variation ${variationId} of item ${item.id} - catalog object not found`);
                    invalidVariations++;
                    return null;
                }
                return {
                    variationId,
                    itemId: item.id
                };
            });
            const verifiedVariations = await Promise.all(verificationPromises);
            variationsToProcess.push(...verifiedVariations.filter((v): v is { variationId: string; itemId: string } => v !== null));
        }
        console.log(`Processing ${variationsToProcess.length} valid variations with concurrency ${CONCURRENCY}`);
        const orderLimit = pLimit(CONCURRENCY);
        const promises = variationsToProcess.map(({ variationId, itemId }) => {
            const location = catalogClient.getRandomLocation();
            const locationId = location.id;
            if (!locationId) {
                console.error('No location ID found, skipping order creation.');
                return Promise.resolve();
            }
            return orderLimit(() => createOrderWithPayment(
                catalogClient.client,
                locationId,
                variationId,
                itemId,
                faker.number.int({ min: MIN_QUANTITY, max: MAX_QUANTITY })
            ));
        });
        await Promise.all(promises);
        console.log('\nOrder Generation Summary:');
        console.log(`Total items processed: ${catalogItems.length}`);
        console.log(`Items skipped: ${skippedItems}`);
        console.log(`Invalid variations: ${invalidVariations}`);
        console.log(`Combo items skipped: ${skippedCombos}`);
        console.log(`Concurrency level: ${CONCURRENCY}`);
    } catch (error) {
        console.error('Fatal error:', error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        const catalogClient = new SquareManager(accessToken);
        await processCatalogItems(catalogClient);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main(); 