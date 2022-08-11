import { Bucket } from "./s3.js";
import fsExtra from "fs-extra";
const { createReadStream } = fsExtra;
import crypto from "crypto";
import * as nodePath from "path";
import hasha from "hasha";
import lodashPkg from "lodash";
const { isString, isUndefined, isArray, chunk } = lodashPkg;

const specialFiles = ["nocfl.inventory.json", "nocfl.identifier.json"];

/**
 * A transfer Object
 * @typedef {Object} Transfer
 * @property {String} localPath - the path to the file locally that you want to upload to the item folder
 * @property {String} json - a JSON object to store in the file directly
 * @property {String} content - some content to store in the file directly
 * @property {String} target - the target name for the file; this will be set relative to the item path
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
     * Interact with a store in an S3 bucket
     * @constructor
     * @param {Credentials} credentials - the AWS credentials to use for the connection
     * @param {string} className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} [domain] - provide this to prefix the paths by domain
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
        this.splay = splay;
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
                {
                    "@id": "./",
                    "@type": ["Dataset"],
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
            await this.bucket.pathExists({
                path: nodePath.join(this.itemPath, "nocfl.inventory.json"),
            })
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
     * @return {Object}
     */
    async getItemIdentifier() {
        return await this.getJSON({ target: "nocfl.identifier.json" });
    }

    /**
     * Get the item inventory file
     * @return {Object}
     */
    async getItemInventory() {
        return await this.getJSON({ target: "nocfl.inventory.json" });
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
                splay: this.splay,
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
     * Get a JSON file from the item on the storage
     * @param {String} localPath - the local path where you want to download the file to
     * @param {String} target - the file on the storage, relative to the item path, that you want to download
     */
    async getJSON({ localPath, target }) {
        return JSON.parse(await this.get({ localPath, target }));
    }

    /**
     * Get a presigned link to the file
     * @param {String} target - the file on the storage, relative to the item path, that you want the url for
     */
    async getPresignedUrl({ target, download }) {
        target = nodePath.join(this.itemPath, target);
        return await this.bucket.getPresignedUrl({ target, download });
    }

    /**
     * Put a file into the item on the storage
     * @param {String} localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} json - a JSON object to store in the file directly
     * @param {String} content - some content to store in the file directly
     * @param {String} target - the target name for the file; this will be set relative to the item path
     * @param {Boolean} registerFile = true - the target name for the file; this will be set relative to the item path
     * @param {Transfer[]} batch - an array of objects defining content to put into the store where the params
     *  are as for the single case. Uploads will be run 5 at a time.
     */
    async put({ localPath, json, content, target, registerFile = true, batch = [] }) {
        if (!(await this.itemExists())) {
            throw new Error(`The item doesn't exist`);
        }

        transfer = transfer.bind(this);
        updateCrateMetadata = updateCrateMetadata.bind(this);
        if (batch.length) {
            let chunks = chunk(batch, 5);
            for (let chunk of chunks) {
                let transfers = chunk.map((t) => transfer(t));
                await Promise.all(transfers);
            }
        } else {
            await transfer({ localPath, json, content, target, registerFile });
        }

        async function transfer({ localPath, json, content, target, registerFile }) {
            if (specialFiles.includes(target)) {
                throw new Error(
                    `You can't upload a file called '${target} as that's a special file used by the system`
                );
            }
            if (localPath) {
                let hash = await sha512(localPath);
                await this.__updateInventory({ target, hash });
            } else if (json) {
                await this.__updateInventory({ target, hash: hasha(JSON.stringify(json)) });
            } else {
                await this.__updateInventory({ target, hash: hasha(content) });
            }
            let s3Target = nodePath.join(this.itemPath, target);
            await this.bucket.upload({ localPath, json, content, target: s3Target });

            await updateCrateMetadata({ target, registerFile });
        }

        async function updateCrateMetadata({ target, registerFile }) {
            // we don't register the ro crate file
            if (registerFile && target === "ro-crate-metadata.json") return;

            // get the crate file
            let crate = await this.getJSON({ target: "ro-crate-metadata.json" });

            // find the root dataset
            let rootDescriptor = crate["@graph"].filter(
                (e) => e["@id"] === "ro-crate-metadata.json" && e["@type"] === "CreativeWork"
            )[0];
            let rootDataset = crate["@graph"].filter(
                (e) => e["@id"] === rootDescriptor.about["@id"]
            )[0];

            // update the hasPart property if required
            if (!rootDataset.hasPart) {
                rootDataset.hasPart = [{ "@id": target }];
            } else {
                let partReferenced = rootDataset.hasPart.filter((p) => p["@id"] === target);
                if (!partReferenced.length) {
                    rootDataset.hasPart.push({ "@id": target });
                }
            }
            crate["@graph"] = crate["@graph"].map((e) => {
                if (e["@id"] === rootDescriptor.about["@id"]) return rootDataset;
                return e;
            });
            await this.bucket.upload({
                target: this.roCrateFile,
                json: crate,
            });
        }
    }

    /**
     * Remove a file from an item in the storage
     * @param {String|Array.<String>} [target] - the target name for the file or array of target files; this will be set relative to the item path
     * @param {String} [prefix] - file prefix; this will be set relative to the item path
     */
    async delete({ target = undefined, prefix = undefined }) {
        if (specialFiles.includes(target)) {
            throw new Error(
                `You can't delete a file called '${target} as that's a special file used by the system`
            );
        }

        if (!(await this.itemExists())) {
            throw new Error(`The item doesn't exist`);
        }

        if (target) {
            if (!isString(target) && !isArray(target)) {
                throw new Error(`target must be a string or array of strings`);
            }
            if (isString(target)) target = [target];
            let keys = target.map((t) => nodePath.join(this.itemPath, t));
            return await this.bucket.removeObjects({ keys });
        } else if (prefix) {
            if (!isString(prefix)) {
                throw new Error(`prefix must be a string`);
            }
            prefix = nodePath.join(this.itemPath, prefix);
            return await this.bucket.removeObjects({ prefix });
        }
    }

    /**
     * Delete the item
     */
    async deleteItem() {
        if (!(await this.itemExists())) {
            throw new Error(`The item doesn't exist`);
        }
        return await this.bucket.removeObjects({ prefix: `${this.itemPath}/` });
    }

    /**
     * Recursively walk and list all of the files for the item
     * @return a list of files
     */
    async listResources() {
        listItemResources = listItemResources.bind(this);
        let resources = await listItemResources({});
        resources = resources.map((r) => {
            r.Key = r.Key.replace(`${this.itemPath}/`, "");
            return r;
        });
        return resources;

        async function listItemResources({ continuationToken }) {
            let resources = await this.bucket.listObjects({
                prefix: `${this.itemPath}/`,
                continuationToken,
            });
            if (resources.NextContinuationToken) {
                return [
                    ...resources.Contents,
                    ...(await listResources(resources.NextContinuationToken)),
                ];
            } else {
                return resources.Contents;
            }
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
