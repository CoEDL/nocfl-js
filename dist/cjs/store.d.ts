/**
 * A transfer Object
 * @typedef {Object} Transfer
 * @property {String} localPath - the path to the file locally that you want to upload to the item folder
 * @property {String} json - a JSON object to store in the file directly
 * @property {String} content - some content to store in the file directly
 * @property {String} target - the target name for the file; this will be set relative to the item path
 */
/**
 * An AWS Credentials Object
 * @typedef {Object} Credentials
 * @property{string} bucket - the AWS bucket to connect to
 * @property {string} accessKeyId - the AWS accessKey
 * @property {string} secretAccessKey - the AWS secretAccessKey
 * @property {string} region - the AWS region
 * @property {string} [endpoint] - the endpoint URL when using an S3 like service (e.g. Minio)
 * @property {boolean} [forcePathStyle] - whether to force path style endpoints (required for Minio and the like)
 */
/** Class representing an S3 store. */
export class Store {
    /**
     * Interact with a store in an S3 bucket
     * @constructor
     * @param {Credentials} credentials - the AWS credentials to use for the connection
     * @param {string} className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} [domain] - provide this to prefix the paths by domain
     * @param {number} [splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    constructor({ domain, className, id, credentials, splay }: Credentials);
    credentials: any;
    bucket: Bucket;
    id: any;
    className: any;
    domain: any;
    itemPath: string;
    splay: any;
    roCrateFile: string;
    inventoryFile: string;
    identifierFile: string;
    roCrateSkeleton: {
        "@context": (string | {
            "@vocab": string;
            txc?: undefined;
            "@base"?: undefined;
        } | {
            txc: string;
            "@vocab"?: undefined;
            "@base"?: undefined;
        } | {
            "@base": null;
            "@vocab"?: undefined;
            txc?: undefined;
        })[];
        "@graph": ({
            "@id": string;
            "@type": string;
            conformsTo: {
                "@id": string;
            };
            about: {
                "@id": string;
            };
            identifier: string;
            name?: undefined;
        } | {
            "@id": string;
            "@type": string[];
            name: string;
            conformsTo?: undefined;
            about?: undefined;
            identifier?: undefined;
        })[];
    };
    /**
     * Check whether the item exists in the storage
     * @return {Boolean}
     */
    itemExists(): boolean;
    /**
     * Get the item path
     * @return {String}
     */
    getItemPath(): string;
    /**
     * Get the item identifier
     * @return {Object}
     */
    getItemIdentifier(): Object;
    /**
     * Get the item inventory file
     * @return {Object}
     */
    getItemInventory(): Object;
    /**
     * Check whether the path exists in the storage
     * @param {String} path - the path of the file to check - this is relative to the item root
     * @return {Boolean}
     */
    pathExists({ path }: string): boolean;
    /**
     * Return the file stat
     * @param {String} path - the path of the file to stat- this is relative to the item root
     * @return {Boolean}
     */
    stat({ path }: string): boolean;
    /**
     * Create the item in the storage
     * @return {Boolean}
     */
    createItem(): boolean;
    /**
     * Get a file from the item on the storage
     * @param {String} localPath - the local path where you want to download the file to
     * @param {String} target - the file on the storage, relative to the item path, that you want to download
     */
    get({ localPath, target }: string): Promise<string | import("@aws-sdk/types").ResponseMetadata>;
    /**
     * Get a JSON file from the item on the storage
     * @param {String} localPath - the local path where you want to download the file to
     * @param {String} target - the file on the storage, relative to the item path, that you want to download
     */
    getJSON({ localPath, target }: string): Promise<any>;
    /**
     * Get a presigned link to the file
     * @param {String} target - the file on the storage, relative to the item path, that you want the url for
     */
    getPresignedUrl({ target, download }: string): Promise<string>;
    /**
     * Put a file into the item on the storage
     * @param {String} localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} json - a JSON object to store in the file directly
     * @param {String} content - some content to store in the file directly
     * @param {String} target - the target name for the file; this will be set relative to the item path
     * @param {Boolean} registerFile = true - the target name for the file; this will be set relative to the item path
     * @param {Transfer[]} batch - an array of objects defining content to put into the store where the params
     *  are as for the single case. Uploads will be run 5 at a time.
     */
    put({ localPath, json, content, target, registerFile, batch, }: string): Promise<void>;
    /**
     * Remove a file from an item in the storage
     * @param {String|Array.<String>} [target] - the target name for the file or array of target files; this will be set relative to the item path
     * @param {String} [prefix] - file prefix; this will be set relative to the item path
     */
    delete({ target, prefix }?: string | string[] | undefined): Promise<import("@aws-sdk/types").ResponseMetadata | undefined>;
    /**
     * Delete the item
     */
    deleteItem(): Promise<import("@aws-sdk/types").ResponseMetadata | undefined>;
    /**
     * Recursively walk and list all of the files for the item
     * @return a list of files
     */
    listResources(): Promise<any>;
    /**
     * Update the file inventory
     * @private
     * @param {String} target - the file on the storage, relative to the item path
     * @param {String} hash - the hash (checksum) of the file
     * @return a list of files
     */
    private __updateInventory;
}
/**
 * A transfer Object
 */
export type Transfer = {
    /**
     * - the path to the file locally that you want to upload to the item folder
     */
    localPath: string;
    /**
     * - a JSON object to store in the file directly
     */
    json: string;
    /**
     * - some content to store in the file directly
     */
    content: string;
    /**
     * - the target name for the file; this will be set relative to the item path
     */
    target: string;
};
/**
 * An AWS Credentials Object
 */
export type Credentials = {
    /**
     * - the AWS bucket to connect to
     */
    bucket: string;
    /**
     * - the AWS accessKey
     */
    accessKeyId: string;
    /**
     * - the AWS secretAccessKey
     */
    secretAccessKey: string;
    /**
     * - the AWS region
     */
    region: string;
    /**
     * - the endpoint URL when using an S3 like service (e.g. Minio)
     */
    endpoint?: string | undefined;
    /**
     * - whether to force path style endpoints (required for Minio and the like)
     */
    forcePathStyle?: boolean | undefined;
};
import { Bucket } from "./s3.js";
