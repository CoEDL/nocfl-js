import { Bucket } from "./s3.js";
import { Walker } from "./walker.js";
import lodashPkg from "lodash";
const { orderBy, uniqBy } = lodashPkg;

/** Class representing an S3 Indexer. */
export class Indexer {
    /**
     * Handle content indices in an S3 bucket
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     */
    constructor({ credentials }) {
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
     * Create index files
     * @param {Object} params
     * @param {string} [params.prefix] - Create indices for this prefix only
     */
    async createIndices({ domain = null, prefix = null }) {
        prefix = prefix ?? domain;
        const walker = new Walker({ credentials: this.credentials, prefix });
        let indices = {};

        walker.on("object", (object) => {
            let { prefix, type, id, splay } = object;
            let idPrefix = id.slice(0, 1).toLowerCase();
            if (!indices[prefix]) indices[prefix] = {};
            if (!indices[prefix][type]) indices[prefix][type] = {};
            if (!indices[prefix][type][idPrefix]) indices[prefix][type][idPrefix] = [];
            indices[prefix][type][idPrefix].push({ prefix, type, id, splay });
        });
        await walker.walk({ domain });

        let indexFiles = [];
        for (let prefix of Object.keys(indices)) {
            for (let type of Object.keys(indices[prefix])) {
                for (let idPrefix of Object.keys(indices[prefix][type])) {
                    let indexFile = `${prefix}/indices/${type}/${idPrefix}.json`;
                    indexFiles.push(indexFile);
                    await this.bucket.put({
                        target: indexFile,
                        json: orderBy(indices[prefix][type][idPrefix], "id"),
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
    async patchIndex({ action, domain = null, prefix = null, type, className, id, splay = 1 }) {
        if (!["PUT", "DELETE"].includes(action)) {
            throw new Error(`'action' must be one of 'PUT' or 'DELETE'`);
        }

        prefix = prefix ?? domain;
        type = type ?? className;

        let indexFileName = `${prefix}/indices/${type}/${id.slice(0, 1).toLowerCase()}.json`;
        let indexFile = [];
        try {
            indexFile = await this.bucket.readJSON({ target: indexFileName });
        } catch (error) {}

        if (action === "PUT") {
            indexFile.push({ prefix, type, id, splay });
        } else if (action === "DELETE") {
            indexFile = indexFile.filter((i) => i.id !== id);
        }
        indexFile = uniqBy(indexFile, "id");
        await this.bucket.put({ target: indexFileName, json: indexFile });
    }

    /**
     * List indices in a given domain
     * @param {Object} params
     * @param {string} params.prefix - provide the domain of the index file
     * @param {string} params.type - the class name of the item being operated on
     */
    async listIndices({ prefix = null, domain = null, type = null, className = null }) {
        if (!prefix) throw new Error(`You must provide 'prefix'`);
        prefix = prefix ?? domain;
        prefix = `${prefix}/indices`;
        type = type ?? className;
        if (type) prefix = `${prefix}/${type}`;
        let files = (await this.bucket.listObjects({ prefix })).Contents;
        files = files.map((f) => f.Key);
        return files;
    }

    /**
     * Get an index file
     * @since 1.17.0
     * @param {Object} params
     * @param {string} params.prefix - provide the domain of the index file
     * @param {string} params.type - the class name of the item being operated on
     * @param {string} params.file - the index file name
     */
    async getIndex({ prefix, type, file }) {
        if (!prefix) throw new Error(`You must provide 'prefix'`);
        if (!type) throw new Error(`You must provide 'type'`);
        if (!file) throw new Error(`You must provide 'file'`);
        let indexFile;
        indexFile = `${prefix}/indices/${type}/${file}`;
        return await this.bucket.readJSON({ target: indexFile });
    }
}
