/** Class representing an S3 Indexer. */
export class Indexer {
    /**
     * Handle content indices in an S3 bucket
     * @constructor
     * @param {Credentials} credentials - the AWS credentials to use for the connection
     * @param {string} [domain] - provide this to prefix the paths by domain
     */
    constructor({ credentials }: Credentials);
    roCrateFile: string;
    inventoryFile: string;
    identifierFile: string;
    credentials: Credentials;
    bucket: Bucket;
    /**
     * Create index files
     */
    createIndices({ domain }: {
        domain?: undefined;
    }): Promise<string[]>;
    patchIndex({ action, domain, className, id }: {
        action: any;
        domain: any;
        className: any;
        id: any;
    }): Promise<void>;
    listIndices({ domain, className }: {
        domain: any;
        className: any;
    }): Promise<void>;
    getIndex({ domain, className, prefix }: {
        domain: any;
        className: any;
        prefix: any;
    }): Promise<void>;
}
import { Bucket } from "./s3.js";
