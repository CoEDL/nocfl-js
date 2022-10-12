/**
 * A transfer Object
 * @typedef {Object} Transfer
 * @property {String} localPath - the path to the file locally that you want to upload to the item folder
 * @property {String} json - a JSON object to store in the file directly
 * @property {String} content - some content to store in the file directly
 * @property {String} target - the target name for the file; this will be set relative to the item path
 * @property {Boolean} registerFile=true - whether the file should be registered in ro-crate-metadata.json.
 *  The file will be registered in the hasPart property of the root dataset if there isn't already an entry for the file.
 * @property {Boolean} version=false - whether the file should be versioned. If true, the existing file will be copied
 *  to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
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
     * Interact with a store in an S3 bucket.
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     * @param {string} params.className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} params.id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} params.domain - provide this to prefix the paths by domain
     * @param {number} [params.splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    constructor({ domain, className, id, credentials, splay }: {
        credentials: Credentials;
        className: string;
        id: string;
        domain: string;
        splay?: number | undefined;
    });
    credentials: Credentials;
    bucket: Bucket;
    id: string;
    className: string;
    domain: string;
    itemPath: string;
    splay: number;
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
    indexer: Indexer;
    /**
     * Check whether the item exists in the storage.
     * @return {Boolean}
     */
    itemExists(): boolean;
    /**
     * Get the item path.
     * @return {String}
     */
    getItemPath(): string;
    /**
     * Get the item identifier.
     * @return {Object}
     */
    getItemIdentifier(): Object;
    /**
     * Get the item inventory file.
     * @return {Object}
     */
    getItemInventory(): Object;
    /**
     * Check whether the path exists in the storage.
     * @param {Object} params
     * @param {String} params.path - the path of the file to check - this is relative to the item root
     * @return {Boolean}
     */
    pathExists({ path }: {
        path: string;
    }): boolean;
    /**
     * Return the file stat.
     * @param {Object} params
     * @param {String} params.path - the path of the file to stat- this is relative to the item root
     * @return {Boolean}
     */
    stat({ path }: {
        path: string;
    }): boolean;
    /**
     * Create the item in the storage.
     * @return {Boolean}
     */
    createItem(): boolean;
    /**
     * Get a file from the item on the storage.
     * @param {Object} params
     * @param {String} params.localPath - the local path where you want to download the file to
     * @param {String} params.target - the file on the storage, relative to the item path, that you want to download
     */
    get({ localPath, target }: {
        localPath: string;
        target: string;
    }): Promise<string | import("@aws-sdk/types").ResponseMetadata>;
    /**
     * Get file versions.
     * @param {Object} params
     * @param {String} params.target - the file whose versions to retrieve
     * @return {Array} - versions of the specified file ordered newest to oldest. The file as named (ie without a version
     *   string will be the first - newest - entry)
     */
    listFileVersions({ target }: {
        target: string;
    }): any[];
    /**
     * Get a JSON file from the item on the storage.
     * @param {Object} params
     * @param {String} params.localPath - the local path where you want to download the file to
     * @param {String} params.target - the file on the storage, relative to the item path, that you want to download
     */
    getJSON({ localPath, target }: {
        localPath: string;
        target: string;
    }): Promise<any>;
    /**
     * Get a presigned link to the file.
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path, that you want the url for
     * @param {String} params.download - get link that can be used to trigger a direct file download
     */
    getPresignedUrl({ target, download }: {
        target: string;
        download: string;
    }): Promise<string>;
    /**
     * Put a file into the item on the storage.
     * @param {Object} params
     * @param {String} params.localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} params.json - a JSON object to store in the file directly
     * @param {String} params.content - some content to store in the file directly
     * @param {String} params.target - the target name for the file; this will be set relative to the item path
     * @param {Boolean} params.registerFile=true - whether the file should be registered in ro-crate-metadata.json.
     *  The file will be registered in the hasPart property of the root dataset if there isn't already an entry for the file.
     * @param {Boolean} params.version=false - whether the file should be versioned. If true, the existing file will be copied
     *  to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
     * @param {Transfer[]} params.batch - an array of objects defining content to put into the store where the params
     *  are as for the single case. Uploads will be run 5 at a time.
     */
    put({ localPath, json, content, target, registerFile, version, batch, }: {
        localPath: string;
        json: string;
        content: string;
        target: string;
        registerFile: boolean;
        version: boolean;
        batch: Transfer[];
    }): Promise<void>;
    /**
     * Remove a file or files from an item in the storage. Files will also be removed from the hasPart property of the root dataset.
     * @param {Object} params
     * @param {String|Array.<String>} [params.target] - the target name for the file or array of target files; this will be set relative to the item path
     * @param {String} [params.prefix] - file prefix; this will be set relative to the item path
     */
    delete({ target, prefix }: {
        target?: string | string[] | undefined;
        prefix?: string | undefined;
    }): Promise<void>;
    /**
     * Delete the item.
     */
    deleteItem(): Promise<void>;
    /**
     * Recursively walk and list all of the files for the item.
     * @return a list of files
     */
    listResources(): Promise<any>;
    /**
     * Update the file inventory.
     * @private
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path
     * @param {String} params.hash - the hash (checksum) of the file
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
    /**
     * =true - whether the file should be registered in ro-crate-metadata.json.
     * The file will be registered in the hasPart property of the root dataset if there isn't already an entry for the file.
     */
    registerFile: boolean;
    /**
     * =false - whether the file should be versioned. If true, the existing file will be copied
     * to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
     */
    version: boolean;
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
import { Indexer } from "./indexer.js";
