/// <reference types="node" />
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
/** Class representing an S3 repository. */
export class Repository extends EventEmitter {
    /**
     * Interact with a repository in an S3 bucket
     * @constructor
     * @param {Credentials} credentials - the AWS credentials to use for the connection
     * @param {string} [domain] - provide this to prefix the paths by domain
     */
    constructor({ credentials }: Credentials);
    roCrateFile: string;
    inventoryFile: string;
    identifierFile: string;
    credentials: any;
    bucket: Bucket;
    walk({ domain }: {
        domain?: undefined;
    }): Promise<void>;
    createIndices(): void;
}
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
import EventEmitter from "events";
import { Bucket } from "./s3.js";
