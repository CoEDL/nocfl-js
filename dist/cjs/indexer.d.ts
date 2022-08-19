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
     * @param {string} [domain] - Create indices for this domain only
     */
    createIndices({ domain }?: string | undefined): Promise<string[]>;
    /**
     * Patch an index file - add new item to it or remove an existing item
     * @param {'PUT'|'DELETE'} action - the class name of the item being operated on
     * @param {string} className - the class name of the item being operated on
     * @param {string} id - the id of the item being operated on
     * @param {string} domain - provide this to prefix the paths by domain
     * @param {number} splay=1 - the number of characters (from the start of the identifer) when converting the id to a path
     */
    patchIndex({ action, domain, className, id, splay }: 'PUT' | 'DELETE'): Promise<void>;
    /**
     * List indices in a given domain
     * @param {string} domain - provide the domain of the index file
     * @param {string} className - the class name of the item being operated on
     */
    listIndices({ domain, className }: string): Promise<import("@aws-sdk/client-s3")._Object[] | undefined>;
    /**
     * Get an index file
     * @param {string} domain - provide the domain of the index file
     * @param {string} className - the class name of the item being operated on
     * @param {string} [prefix] - the prefix of the index: i.e. the first letter
     * @param {string} [file] - the index file name
     */
    getIndex({ domain, className, prefix, file }: string): Promise<any>;
}
import { Bucket } from "./s3.js";
