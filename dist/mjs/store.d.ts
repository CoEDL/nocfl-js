/** Class representing an S3 store. */
export class Store {
    /**
     * Interact with a store in an S3 bucket
     * @constructor
     * @param {string} className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} [domain] - provide this to prefix the paths by domain
     * @param {string} credentials.bucket - the AWS bucket to connect to
     * @param {string} credentials.accessKeyId - the AWS accessKey
     * @param {string} credentials.secretAccessKey - the AWS secretAccessKey
     * @param {string} credentials.region - the AWS region
     * @param {string} [credentials.endpoint] - the endpoint URL when using an S3 like service (e.g. Minio)
     * @param {boolean} [credentials.forcePathStyle] - whether to force path style endpoints (required for Minio and the like)
     * @param {number} [splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    constructor({ domain, className, id, credentials, splay }: string);
    credentials: any;
    bucket: Bucket;
    id: any;
    className: any;
    domain: any;
    itemPath: string;
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
        "@graph": {
            "@id": string;
            "@type": string;
            conformsTo: {
                "@id": string;
            };
            about: {
                "@id": string;
            };
            identifier: string;
        }[];
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
     * Get a presigned link to the file
     * @param {String} target - the file on the storage, relative to the item path, that you want the url for
     */
    getPresignedUrl({ target }: string): Promise<string>;
    /**
     * Put a file into the item on the storage
     * @param {String} localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} target - the target name for the file; this will be set relative to the item path
     */
    put({ localPath, json, content, target }: string): Promise<import("@aws-sdk/types").ResponseMetadata | undefined>;
    /**
     * Remove a file from an item in the storage
     * @param {String} target - the target name for the file; this will be set relative to the item path
     */
    delete({ target }: string): Promise<import("@aws-sdk/types").ResponseMetadata | undefined>;
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
import { Bucket } from "./s3.js";
