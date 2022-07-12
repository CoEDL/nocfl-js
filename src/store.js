import { Bucket } from "./s3.js";
import fsExtra from "fs-extra";
const { createReadStream } = fsExtra;
import crypto from "crypto";
import * as nodePath from "path";
import hasha from "hasha";
import { isString, isUndefined } from "lodash";

const specialFiles = ["nocfl.inventory.json", "nocfl.identifier.json"];

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
    constructor({ domain = undefined, className, id, credentials, splay = 1 }) {
        if (!id) throw new Error(`Missing required property: 'id'`);
        if (!className) throw new Error(`Missing required property: 'className'`);
        if (!credentials) throw new Error(`Missing required property: 'credentials'`);

        const requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
        requiredProperties.forEach((property) => {
            if (!credentials[property]) {
                throw new Error(`Missing required property: '${property}'`);
            }
        });

        if (!isString(id)) {
            throw new Error(`The 'id' must be a string`);
        }
        if (!isString(className)) {
            throw new Error(`The 'className' must be a string`);
        }
        if (!isString(domain) && !isUndefined(domain)) {
            throw new Error(`The 'domain' must be a string`);
        }

        if (!id.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error(
                `The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
        if (!className.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error(
                `The className doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }

        this.credentials = credentials;
        this.bucket = new Bucket(credentials);
        this.id = id;
        this.className = className;
        this.domain = domain;
        this.itemPath = domain
            ? `${domain.toLowerCase()}/${className.toLowerCase()}/${id.slice(0, splay)}/${id}`
            : `${className.toLowerCase()}/${id.slice(0, splay)}/${id}`;
        this.roCrateFile = nodePath.join(this.itemPath, "ro-crate-metadata.json");
        this.inventoryFile = nodePath.join(this.itemPath, "nocfl.inventory.json");
        this.identifierFile = nodePath.join(this.itemPath, "nocfl.identifier.json");
        this.roCrateSkeleton = {
            "@context": [
                "https://w3id.org/ro/crate/1.1/context",
                {
                    "@vocab": "http://schema.org/",
                },
                {
                    txc: "https://purl.archive.org/textcommons/terms#",
                },
                {
                    "@base": null,
                },
            ],
            "@graph": [
                {
                    "@id": "ro-crate-metadata.json",
                    "@type": "CreativeWork",
                    conformsTo: {
                        "@id": "https://w3id.org/ro/crate/1.1",
                    },
                    about: {
                        "@id": "./",
                    },
                    identifier: "ro-crate-metadata.json",
                },
            ],
        };
    }

    /**
     * Check whether the item exists in the storage
     * @return {Boolean}
     */
    async itemExists() {
        if (
            (await this.bucket.pathExists({
                path: nodePath.join(this.itemPath, "ro-crate-metadata.json"),
            })) &&
            (await this.bucket.pathExists({
                path: nodePath.join(this.itemPath, "ro-crate-metadata.json"),
            }))
        ) {
            return true;
        }
        return false;
    }

    /**
     * Get the item path
     * @return {String}
     */
    getItemPath() {
        return this.itemPath;
    }

    /**
     * Get the item identifier
     * @return {String}
     */
    async getItemIdentifier() {
        return JSON.parse(await this.get({ target: "nocfl.identifier.json" }));
    }

    /**
     * Check whether the path exists in the storage
     * @param {String} path - the path of the file to check - this is relative to the item root
     * @return {Boolean}
     */
    async pathExists({ path }) {
        let target = nodePath.join(this.itemPath, path);
        return await this.bucket.pathExists({ path: target });
    }

    /**
     * Return the file stat
     * @param {String} path - the path of the file to stat- this is relative to the item root
     * @return {Boolean}
     */
    async stat({ path }) {
        let target = nodePath.join(this.itemPath, path);
        return await this.bucket.stat({ path: target });
    }

    /**
     * Create the item in the storage
     * @return {Boolean}
     */
    async createItem() {
        if (await this.itemExists()) {
            throw new Error(`An item with that identifier already exists`);
        }
        let roCrateFileHash = hasha(JSON.stringify(this.roCrateSkeleton));
        await this.bucket.upload({
            target: this.roCrateFile,
            json: this.roCrateSkeleton,
        });

        await this.bucket.upload({
            target: this.inventoryFile,
            json: { content: { "ro-crate-metadata.json": roCrateFileHash } },
        });

        await this.bucket.upload({
            target: this.identifierFile,
            json: {
                id: this.id,
                className: this.className,
                domain: this.domain,
                itemPath: this.itemPath,
            },
        });
    }

    /**
     * Get a file from the item on the storage
     * @param {String} localPath - the local path where you want to download the file to
     * @param {String} target - the file on the storage, relative to the item path, that you want to download
     */
    async get({ localPath, target }) {
        target = nodePath.join(this.itemPath, target);

        return await this.bucket.download({ target, localPath });
    }

    /**
     * Get a presigned link to the file
     * @param {String} target - the file on the storage, relative to the item path, that you want the url for
     */
    async getPresignedUrl({ target }) {
        target = nodePath.join(this.itemPath, target);
        return await this.bucket.getPresignedUrl({ target });
    }

    /**
     * Put a file into the item on the storage
     * @param {String} localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} target - the target name for the file; this will be set relative to the item path
     */
    async put({ localPath, json, content, target }) {
        let s3Target = nodePath.join(this.itemPath, target);
        if (!(await this.itemExists())) {
            throw new Error(`You need to 'createItem' before you can add content to it`);
        }

        if (localPath) {
            let hash = await sha512(localPath);
            await this.__updateInventory({ target, hash });
        } else if (json) {
            await this.__updateInventory({ target, hash: hasha(JSON.stringify(json)) });
        } else {
            await this.__updateInventory({ target, hash: hasha(content) });
        }
        return await this.bucket.upload({ localPath, json, content, target: s3Target });
    }

    /**
     * Recursively walk and list all of the files for the item
     * @return a list of files
     */
    async listResources({ continuationToken }) {
        let resources = await this.bucket.listObjects({ prefix: this.itemPath, continuationToken });
        if (resources.NextContinuationToken) {
            return [
                ...resources.Contents,
                ...(await listResources({
                    continuationToken: resources.NextContinuationToken,
                })),
            ];
        } else {
            return resources.Contents;
        }
    }

    /**
     * Update the file inventory
     * @private
     * @param {String} target - the file on the storage, relative to the item path
     * @param {String} hash - the hash (checksum) of the file
     * @return a list of files
     */
    async __updateInventory({ target, hash }) {
        let inventory = JSON.parse(await this.bucket.download({ target: this.inventoryFile }));
        inventory.content[target] = hash;
        await this.bucket.upload({
            target: this.inventoryFile,
            json: inventory,
        });
    }
}

const sha512 = (path) =>
    new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha512");
        const rs = createReadStream(path);
        rs.on("error", reject);
        rs.on("data", (chunk) => hash.update(chunk));
        rs.on("end", () => resolve(hash.digest("hex")));
    });
