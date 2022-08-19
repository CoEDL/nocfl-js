import { Bucket } from "./s3.js";
import { Walker } from "./walker";
import { orderBy } from "lodash";
/** Class representing an S3 Indexer. */
export class Indexer {
    /**
     * Handle content indices in an S3 bucket
     * @constructor
     * @param {Credentials} credentials - the AWS credentials to use for the connection
     * @param {string} [domain] - provide this to prefix the paths by domain
     */
    constructor({ credentials }) {
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
    /**
     * Create index files
     */
    async createIndices({ domain = undefined }) {
        const walker = new Walker({ credentials: this.credentials, domain });
        let indices = {};
        walker.on("object", (object) => {
            let { domain, className, id, itemPath, splay } = object;
            let idPrefix = id.slice(0, 1).toLowerCase();
            if (!indices[domain])
                indices[domain] = {};
            if (!indices[domain][className])
                indices[domain][className] = {};
            if (!indices[domain][className][idPrefix])
                indices[domain][className][idPrefix] = [];
            indices[domain][className][idPrefix].push(object);
        });
        await walker.walk({ domain });
        let indexFiles = [];
        for (let domain of Object.keys(indices)) {
            for (let className of Object.keys(indices[domain])) {
                for (let idPrefix of Object.keys(indices[domain][className])) {
                    let indexFile = `${domain}/indices/${className}/${idPrefix}.json`;
                    indexFiles.push(indexFile);
                    await this.bucket.upload({
                        target: indexFile,
                        json: orderBy(indices[domain][className][idPrefix], "id"),
                    });
                }
            }
        }
        return indexFiles;
    }
    async patchIndex({ action, domain, className, id }) {
        if (!["PUT, DELETE"].includes(action)) {
            throw new Error(`'action' must be one of 'PUT' or 'DELETE'`);
        }
    }
    async listIndices({ domain, className }) { }
    async getIndex({ domain, className, prefix }) { }
}
