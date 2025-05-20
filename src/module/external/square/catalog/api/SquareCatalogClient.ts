import { SquareBaseClient } from '../../common/SquareBaseClient';
import { 
    CatalogApi, 
    OrdersApi, 
    PaymentsApi, 
    LocationsApi,
    SearchCatalogItemsResponse,
    CreateOrderRequest,
    CreatePaymentRequest,
    Location,
    CatalogObject,
    CatalogObjectBatch,
    BatchUpsertCatalogObjectsRequest,
    BatchUpsertCatalogObjectsResponse,
    BatchDeleteCatalogObjectsRequest,
    BatchDeleteCatalogObjectsResponse,
    ListCatalogResponse,
    Order
} from 'square';
import * as crypto from 'crypto';
import { Client, Environment } from 'square';

interface IItemObject {
    name: string;
    categoryId: string;
    quantity: number;
    modifierId?: string;
    variations: IItemVariationObject[];
}

interface IItemVariationObject {
    quantity: number;
    price: number;
    priceLambda: number;
}

interface IModifierObject {
    price: number;
    priceLambda: number;
    quantity: number;
}

interface IModifierObjectList {
    name: string;
    quantity: number;
}

interface ITaxObject {
    name: string;
    calculationPhase: 'TAX_SUBTOTAL_PHASE' | 'TAX_TOTAL_PHASE';
    percentage: string;
    appliesToCustomAmounts: boolean;
    enabled: boolean;
    inclusionType: 'ADDITIVE' | 'INCLUSIVE';
}

export class SquareManager extends SquareBaseClient {
    public client: Client;
    private catalogApi: CatalogApi;
    private ordersApi: OrdersApi;
    private paymentsApi: PaymentsApi;
    private locationsApi: LocationsApi;
    private locations: Location[] = [];
    private taxes: CatalogObject[] = [];

    constructor() {
        super();
        this.client = new Client({
            accessToken: process.env.AUTH_TOKEN,
            environment: Environment.Production
        });
        this.catalogApi = this.client.catalogApi;
        this.ordersApi = this.client.ordersApi;
        this.paymentsApi = this.client.paymentsApi;
        this.locationsApi = this.client.locationsApi;
    }

    async initializeLocationsAndTaxes(): Promise<void> {
        await this.initializeLocations();
        this.taxes = await this.listTaxes();
        console.log(`Found ${this.taxes.length} taxes`);
    }

    async initializeLocations(): Promise<void> {
        try {
            const response = await this.locationsApi.listLocations();
            if (response.result.locations) {
                this.locations = response.result.locations;
                console.log(`Found ${this.locations.length} locations`);
            }
        } catch (error) {
            console.error('Error fetching locations:', error);
            throw error;
        }
    }

    getRandomLocation(): Location {
        if (this.locations.length === 0) {
            throw new Error('No locations available');
        }
        const randomIndex = Math.floor(Math.random() * this.locations.length);
        return this.locations[randomIndex];
    }

    getRandomTax(): CatalogObject | undefined {
        if (this.taxes.length === 0) {
            return undefined;
        }
        const randomIndex = Math.floor(Math.random() * this.taxes.length);
        return this.taxes[randomIndex];
    }

    async searchCatalogItems(): Promise<string[]> {
        try {
            const location = this.getRandomLocation();
            if (!location.id) {
                throw new Error('Location ID is required');
            }

            const response = await this.catalogApi.searchCatalogItems({
                enabledLocationIds: [location.id],
                productTypes: ['REGULAR']
            });

            if (!response.result.items) {
                return [];
            }

            return response.result.items
                .filter(item => item.itemData?.variations && item.itemData.variations.length > 0)
                .map(item => item.itemData?.variations?.[0].id ?? '')
                .filter(id => id !== '');
        } catch (error) {
            console.error('Error searching catalog items:', error);
            throw error;
        }
    }

    private generateRandomName(): string {
        const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Emma'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Rodriguez'];
        return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    }

    private generateRandomFutureDate(): string {
        const now = new Date();
        const futureDate = new Date(now.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date within next 30 days
        return futureDate.toISOString();
    }

    async createOrder(
        locationId: string,
        lineItems: Array<{
            catalogObjectId: string;
            quantity: string;
        }>,
        applyTax: boolean = true
    ): Promise<Order> {
        try {
            const order: Order = {
                locationId,
                lineItems: lineItems.map(item => ({
                    quantity: item.quantity,
                    catalogObjectId: item.catalogObjectId,
                    appliedTaxes: []
                })),
                fulfillments: [{
                    type: 'PICKUP',
                    pickupDetails: {
                        recipient: {
                            displayName: this.generateRandomName()
                        },
                        pickupAt: this.generateRandomFutureDate()
                    }
                }]
            };

            if (applyTax && this.taxes.length > 0) {
                const tax = this.taxes[Math.floor(Math.random() * this.taxes.length)];
                if (tax && tax.id) {
                    // Apply tax to all line items using the new tax adjustment fields
                    if (order.lineItems) {
                        order.lineItems.forEach(item => {
                            item.appliedTaxes = [{
                                taxUid: tax.id
                            }];
                        });
                    }
                }
            }

            const response = await this.client.ordersApi.createOrder({
                order,
                idempotencyKey: crypto.randomUUID()
            });

            return response.result.order!;
        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    }

    async deleteOrder(orderId: string): Promise<void> {
        try {
            console.log(`Attempting to cancel order ${orderId}...`);
            const location = this.getRandomLocation();
            if (!location.id) {
                throw new Error('Location ID is required');
            }

            await this.ordersApi.updateOrder(
                orderId,
                {
                    order: {
                        locationId: location.id,
                        state: 'CANCELED'
                    }
                }
            );
            console.log(`Successfully canceled order ${orderId}`);
        } catch (error) {
            console.error(`Failed to cancel order ${orderId}:`, error);
            throw error;
        }
    }

    async listCatalog(types?: string[]): Promise<ListCatalogResponse> {
        const { result } = await this.catalogApi.listCatalog(undefined, types?.join());
        return result;
    }

    async listCatalogIds(types?: string[]): Promise<string[]> {
        const { objects = [] } = await this.listCatalog(types);
        return objects.map(({ id }) => id);
    }

    async batchCreateCategories(categoryName: string, quantity: number): Promise<BatchUpsertCatalogObjectsResponse> {
        const body: BatchUpsertCatalogObjectsRequest = {
            idempotencyKey: this.generateIdempotencyKey(),
            batches: [{ objects: this.generateCategoryObjects(categoryName, quantity) }],
        };

        const { result } = await this.catalogApi.batchUpsertCatalogObjects(body);
        return result;
    }

    async batchCreateModifierLists(
        modifierList: IModifierObjectList,
        modifier: IModifierObject
    ): Promise<BatchUpsertCatalogObjectsResponse> {
        const body: BatchUpsertCatalogObjectsRequest = {
            idempotencyKey: this.generateIdempotencyKey(),
            batches: [
                {
                    objects: this.generateModifierObjectList(modifierList, modifier),
                },
            ],
        };

        const { result } = await this.catalogApi.batchUpsertCatalogObjects(body);
        return result;
    }

    async batchDeleteCatalogObjects(ids: string[]): Promise<BatchDeleteCatalogObjectsResponse> {
        const body: BatchDeleteCatalogObjectsRequest = { objectIds: ids };
        const { result } = await this.catalogApi.batchDeleteCatalogObjects(body);
        return result;
    }

    async batchUpsertItemObjects(catalogObjectBatches: CatalogObjectBatch[]): Promise<BatchUpsertCatalogObjectsResponse> {
        const body: BatchUpsertCatalogObjectsRequest = {
            idempotencyKey: this.generateIdempotencyKey(),
            batches: catalogObjectBatches,
        };

        const { result } = await this.catalogApi.batchUpsertCatalogObjects(body);
        return result;
    }

    public generateItemObjects(items: IItemObject[]): any[] {
        return items.map(item => {
            const itemId = this.generateId();
            const variationId = this.generateId();
            return {
                type: 'ITEM',
                id: itemId,
                item_data: {
                    name: item.name,
                    category_id: item.categoryId,
                    variations: [
                        {
                            type: 'ITEM_VARIATION',
                            id: variationId,
                            item_variation_data: {
                                name: 'Default',
                                pricing_type: 'FIXED_PRICING',
                                price_money: {
                                    amount: item.variations[0]?.price ?? 100,
                                    currency: 'USD'
                                }
                            }
                        }
                    ],
                    modifier_list_info: item.modifierId
                        ? [{
                            modifier_list_id: item.modifierId,
                            enabled: true
                        }]
                        : undefined
                }
            };
        });
    }

    private generateCategoryObjects(categoryName: string = 'test', quantity: number = 1): CatalogObject[] {
        return Array.from({ length: quantity }, () => ({
            type: 'CATEGORY',
            id: this.generateId(),
            categoryData: {
                name: `${categoryName}-${this.generateId()}`,
            },
        }));
    }

    private generateModifierObjectList(modifierList: IModifierObjectList, modifier: IModifierObject): CatalogObject[] {
        const modifierListId = this.generateId();
        return [
            {
                type: 'MODIFIER_LIST',
                id: modifierListId,
                modifierListData: {
                    name: modifierList.name,
                    modifiers: Array.from({ length: modifierList.quantity }, () => ({
                        type: 'MODIFIER',
                        id: this.generateId(),
                        modifierData: {
                            name: `Modifier ${this.generateId()}`,
                            priceMoney: {
                                amount: BigInt(modifier.price),
                                currency: 'USD',
                            },
                        },
                    })),
                },
            },
        ];
    }

    private generateItemVariations(variations: IItemVariationObject[]): any[] {
        return variations.map(variation => ({
            type: 'ITEM_VARIATION',
            id: this.generateId(),
            item_variation_data: {
                name: `Variation #${this.generateIdempotencyKey()}`,
                pricing_type: 'FIXED_PRICING',
                price_money: {
                    amount: variation.price,
                    currency: 'USD'
                }
            }
        }));
    }

    private generateId(id: string = crypto.randomUUID()): string {
        return `#${id}`;
    }

    async batchCreateTaxes(taxes: ITaxObject[]): Promise<BatchUpsertCatalogObjectsResponse> {
        const body: BatchUpsertCatalogObjectsRequest = {
            idempotencyKey: this.generateIdempotencyKey(),
            batches: [{
                objects: this.generateTaxObjects(taxes)
            }]
        };

        const { result } = await this.catalogApi.batchUpsertCatalogObjects(body);
        return result;
    }

    private generateTaxObjects(taxes: ITaxObject[]): CatalogObject[] {
        return taxes.map(tax => ({
            type: 'TAX',
            id: this.generateId(),
            taxData: {
                name: tax.name,
                calculationPhase: tax.calculationPhase,
                percentage: tax.percentage,
                appliesToCustomAmounts: tax.appliesToCustomAmounts,
                enabled: tax.enabled,
                inclusionType: tax.inclusionType
            }
        }));
    }

    async listTaxes(): Promise<CatalogObject[]> {
        const { objects = [] } = await this.listCatalog(['TAX']);
        return objects;
    }

    async deleteTaxes(): Promise<void> {
        const taxes = await this.listTaxes();
        if (taxes.length > 0) {
            const taxIds = taxes.map(tax => tax.id);
            await this.batchDeleteCatalogObjects(taxIds);
        }
    }
} 