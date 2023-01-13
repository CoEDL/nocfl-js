import { Bucket } from "./s3.js";
import EventEmitter from "events";

/** Class representing an S3 walker. */
export class Walker extends EventEmitter {
    /**
     * Walk a repository in an S3 bucket
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     */
    constructor({ credentials }) {
        super();

        if (!credentials) throw new Error(`Missing required property: 'credentials'`);
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

    /**
     * Walk the repository and emit when an object is located. The object data
     *   to set up a store connection to it is emitted.
     * @param {Object} params
     * @param {string} [params.prefix] - Walk only the defined prefix. This can be any path from the root of the bucket.
     */

    async walk({ domain = undefined, prefix = undefined }) {
        const walker = __walker.bind(this);
        await walker({});

        async function __walker({ continuationToken }) {
            prefix = prefix ? prefix : domain;
            let objects = await this.bucket.listObjects({ continuationToken });
            for (let entry of objects.Contents) {
                let match = false;
                if (
                    prefix &&
                    entry.Key.match(`${prefix}/`) &&
                    entry.Key.match(this.identifierFile)
                ) {
                    match = true;
                } else if (!prefix && entry.Key.match(this.identifierFile)) {
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
}
