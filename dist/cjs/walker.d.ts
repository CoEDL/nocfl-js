/// <reference types="node" />
/** Class representing an S3 walker. */
export class Walker extends EventEmitter {
    /**
     * Walk a repository in an S3 bucket
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
     * Walk the repository and emit when an object is located. The object data
     *   to set up a store connection to it is emitted.
     * @param {string} [domain] - Walk only the defined domain
     */
    walk({ domain }?: string | undefined): Promise<void>;
}
import EventEmitter from "events";
import { Bucket } from "./s3.js";
