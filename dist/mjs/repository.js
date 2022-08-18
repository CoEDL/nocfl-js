import { Bucket } from "./s3.js";
import EventEmitter from "events";
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
    constructor({ credentials }) {
        super();
        if (!credentials)
            throw new Error(`Missing required property: 'credentials'`);
        const requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
        requiredProperties.forEach((property) => {
            if (!credentials[property]) {
                throw new Error(`Missing required property: '${property}'`);
            }
        });
        this.roCrateFile = "ro-crate-metadata.json";
        this.inventoryFile = "nocfl.inventory.json";
        this.identifierFile = "nocfl.identifier.json";
        this.credentials = credentials;
        this.bucket = new Bucket(credentials);
    }
    async walk({ domain = undefined }) {
        const walker = __walker.bind(this);
        await walker({ domain });
        async function __walker({ continuationToken }) {
            let objects = await this.bucket.listObjects({ continuationToken });
            for (let entry of objects.Contents) {
                let match = false;
                if (domain &&
                    entry.Key.match(`${domain}/`) &&
                    entry.Key.match(this.identifierFile)) {
                    match = true;
                }
                else if (!domain && entry.Key.match(this.identifierFile)) {
                    match = true;
                }
                if (match) {
                    let inventory = await this.bucket.readJSON({
                        target: entry.Key,
                    });
                    this.emit("object", inventory);
                }
            }
            if (objects.NextContinuationToken) {
                await walker({ domain, continuationToken: objects.NextContinuationToken });
            }
        }
    }
    createIndices() { }
}
