import { Bucket } from "./s3.js";
import { Walker } from "./walker";
import { orderBy, uniqBy } from "lodash";
/** Class representing an S3 Indexer. */
export class Indexer {
    /**
     * Handle content indices in an S3 bucket
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
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
     * @param {Object} params
     * @param {string} [params.domain] - Create indices for this domain only
     */
    async createIndices({ domain = undefined }) {
        const walker = new Walker({ credentials: this.credentials, domain });
        let indices = {};
        walker.on("object", (object) => {
            let { domain, className, id, splay } = object;
            let idPrefix = id.slice(0, 1).toLowerCase();
            if (!indices[domain])
                indices[domain] = {};
            if (!indices[domain][className])
                indices[domain][className] = {};
            if (!indices[domain][className][idPrefix])
                indices[domain][className][idPrefix] = [];
            indices[domain][className][idPrefix].push({ domain, className, id, splay });
        });
        await walker.walk({ domain });
        let indexFiles = [];
        for (let domain of Object.keys(indices)) {
            for (let className of Object.keys(indices[domain])) {
                for (let idPrefix of Object.keys(indices[domain][className])) {
                    let indexFile = `${domain}/indices/${className}/${idPrefix}.json`;
                    indexFiles.push(indexFile);
                    await this.bucket.put({
                        target: indexFile,
                        json: orderBy(indices[domain][className][idPrefix], "id"),
                    });
                }
            }
        }
        return indexFiles;
    }
    /**
     * Patch an index file - add new item to it or remove an existing item
     * @param {Object} params
     * @param {'PUT'|'DELETE'} params.action - the action to perform
     * @param {string} params.className - the class name of the item being operated on
     * @param {string} params.id - the id of the item being operated on
     * @param {string} params.domain - provide this to prefix the paths by domain
     * @param {number} params.splay=1 - the number of characters (from the start of the identifer) when converting the id to a path
     */
    async patchIndex({ action, domain, className, id, splay = 1 }) {
        if (!["PUT", "DELETE"].includes(action)) {
            throw new Error(`'action' must be one of 'PUT' or 'DELETE'`);
        }
        let indexFileName = `${domain}/indices/${className}/${id.slice(0, 1).toLowerCase()}.json`;
        let indexFile = [];
        try {
            indexFile = await this.bucket.readJSON({ target: indexFileName });
        }
        catch (error) { }
        if (action === "PUT") {
            indexFile.push({ domain, className, id, splay });
        }
        else if (action === "DELETE") {
            indexFile = indexFile.filter((i) => i.id !== id);
        }
        indexFile = uniqBy(indexFile, "id");
        await this.bucket.put({ target: indexFileName, json: indexFile });
    }
    /**
     * List indices in a given domain
     * @param {Object} params
     * @param {string} params.domain - provide the domain of the index file
     * @param {string} params.className - the class name of the item being operated on
     */
    async listIndices({ domain, className }) {
        if (!domain)
            throw new Error(`You must provide 'domain'`);
        let prefix = `${domain}/indices`;
        if (className)
            prefix = `${prefix}/${className}`;
        let files = (await this.bucket.listObjects({ prefix })).Contents;
        files = files.map((f) => f.Key);
        return files;
    }
    /**
     * Get an index file
     * @param {Object} params
     * @param {string} params.domain - provide the domain of the index file
     * @param {string} params.className - the class name of the item being operated on
     * @param {string} [params.prefix] - the prefix of the index: i.e. the first letter
     * @param {string} [params.file] - the index file name
     */
    async getIndex({ domain, className, prefix, file }) {
        if (!domain)
            throw new Error(`You must provide 'domain'`);
        if (!className)
            throw new Error(`You must provide 'className'`);
        if (!prefix && !file)
            throw new Error(`You must provide one of 'prefix' or 'file'`);
        let indexFile;
        if (file) {
            indexFile = `${domain}/indices/${className}/${file}`;
        }
        else if (prefix) {
            indexFile = `${domain}/indices/${className}/${prefix}.json`;
        }
        return await this.bucket.readJSON({ target: indexFile });
    }
}
