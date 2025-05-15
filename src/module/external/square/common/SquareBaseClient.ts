import { Client, Environment } from 'square';
import { v4 as uuidV4 } from 'uuid';

export class SquareBaseClient {
    protected readonly client: Client;

    constructor() {
        this.client = new Client({
            bearerAuthCredentials: {
                accessToken: process.env.AUTH_TOKEN!,
            },
            environment: Environment.Production,
            httpClientOptions: {
                retryConfig: {
                    maxNumberOfRetries: Number(process.env.SQ_MAX_RETRIES) || 3,
                    maximumRetryWaitTime: 5,
                    httpMethodsToRetry: ['GET', 'POST', 'DELETE'],
                },
            },
        });
    }

    protected generateIdempotencyKey(): string {
        return uuidV4();
    }
} 