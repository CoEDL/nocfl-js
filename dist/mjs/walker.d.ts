/// <reference types="node" />
/** Class representing an S3 walker. */
export class Walker extends EventEmitter {
    /**
     * Walk a repository in an S3 bucket
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
     * Walk the repository and emit when an object is located. The object data
     *   to set up a store connection to it is emitted.
     * @param {Object} params
     * @param {string} [params.domain] - Walk only the defined domain
     */
    walk({ domain }: {
        domain?: string | undefined;
    }): Promise<void>;
}
import EventEmitter from "events";
import { Bucket } from "./s3.js";
