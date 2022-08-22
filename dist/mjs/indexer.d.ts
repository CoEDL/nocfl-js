/** Class representing an S3 Indexer. */
export class Indexer {
    /**
     * Handle content indices in an S3 bucket
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     */
    constructor({ credentials }: {
        credentials: Credentials;
    });
    roCrateFile: string;
    inventoryFile: string;
    identifierFile: string;
    credentials: Credentials;
    bucket: Bucket;
    /**
     * Create index files
     * @param {Object} params
     * @param {string} [params.domain] - Create indices for this domain only
     */
    createIndices({ domain }: {
        domain?: string | undefined;
    }): Promise<string[]>;
    /**
     * Patch an index file - add new item to it or remove an existing item
     * @param {Object} params
     * @param {'PUT'|'DELETE'} params.action - the action to perform
     * @param {string} params.className - the class name of the item being operated on
     * @param {string} params.id - the id of the item being operated on
     * @param {string} params.domain - provide this to prefix the paths by domain
     * @param {number} params.splay=1 - the number of characters (from the start of the identifer) when converting the id to a path
     */
    patchIndex({ action, domain, className, id, splay }: {
        action: 'PUT' | 'DELETE';
        className: string;
        id: string;
        domain: string;
        splay: number;
    }): Promise<void>;
    /**
     * List indices in a given domain
     * @param {Object} params
     * @param {string} params.domain - provide the domain of the index file
     * @param {string} params.className - the class name of the item being operated on
     */
    listIndices({ domain, className }: {
        domain: string;
        className: string;
    }): Promise<import("@aws-sdk/client-s3")._Object[] | undefined>;
    /**
     * Get an index file
     * @param {Object} params
     * @param {string} params.domain - provide the domain of the index file
     * @param {string} params.className - the class name of the item being operated on
     * @param {string} [params.prefix] - the prefix of the index: i.e. the first letter
     * @param {string} [params.file] - the index file name
     */
    getIndex({ domain, className, prefix, file }: {
        domain: string;
        className: string;
        prefix?: string | undefined;
        file?: string | undefined;
    }): Promise<any>;
}
import { Bucket } from "./s3.js";
