import { Bucket } from "./s3.js";
import fsExtra from "fs-extra";
const { createReadStream } = fsExtra;
import crypto from "crypto";
import * as nodePath from "path";
import hasha from "hasha";
import { Indexer } from "./indexer.js";
import lodashPkg from "lodash";
const { isString, isArray, chunk } = lodashPkg;
const specialFiles = ["nocfl.inventory.json", "nocfl.identifier.json"];
/**
 * A transfer Object
 * @typedef {Object} Transfer
 * @property {String} localPath - the path to the file locally that you want to upload to the item folder
 * @property {String} json - a JSON object to store in the file directly
 * @property {String} content - some content to store in the file directly
 * @property {String} target - the target name for the file; this will be set relative to the item path
 * @property {Boolean} registerFile=true - whether the file should be registered in ro-crate-metadata.json.
 *  The file will be registered in the hasPart property of the root dataset if there isn't already an entry for the file.
 * @property {Boolean} version=false - whether the file should be versioned. If true, the existing file will be copied
 *  to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
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
     * Interact with a store in an S3 bucket.
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     * @param {string} params.className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} params.id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} params.domain - provide this to prefix the paths by domain
     * @param {number} [params.splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    constructor({ domain = undefined, className, id, credentials, splay = 1 }) {
        if (!id)
            throw new Error(`Missing required property: 'id'`);
        if (!domain)
            throw new Error(`Missing required property: 'domain'`);
        if (!className)
            throw new Error(`Missing required property: 'className'`);
        if (!credentials)
            throw new Error(`Missing required property: 'credentials'`);
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
        if (!isString(domain)) {
            throw new Error(`The 'domain' must be a string`);
        }
        if (!id.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error(`The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`);
        }
        if (!className.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error(`The className doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`);
        }
        this.credentials = credentials;
        this.bucket = new Bucket(credentials);
        this.id = id;
        this.className = className;
        this.domain = domain;
        this.itemPath = `${domain.toLowerCase()}/${className.toLowerCase()}/${id.slice(0, splay)}/${id}`;
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
                    name: "My Research Object Crate",
                },
            ],
        };
        this.indexer = new Indexer({ credentials });
    }
    /**
     * Check whether the item exists in the storage.
     * @return {Boolean}
     */
    async itemExists() {
        if (await this.bucket.pathExists({ path: this.identifierFile })) {
            return true;
        }
        return false;
    }
    /**
     * Get the item path.
     * @return {String}
     */
    getItemPath() {
        return this.itemPath;
    }
    /**
     * Get the item identifier.
     * @return {Object}
     */
    async getItemIdentifier() {
        return await this.getJSON({ target: "nocfl.identifier.json" });
    }
    /**
     * Get the item inventory file.
     * @return {Object}
     */
    async getItemInventory() {
        return await this.getJSON({ target: "nocfl.inventory.json" });
    }
    /**
     * Check whether the path exists in the storage.
     * @param {Object} params
     * @param {String} params.path - the path of the file to check - this is relative to the item root
     * @return {Boolean}
     */
    async pathExists({ path }) {
        let target = nodePath.join(this.itemPath, path);
        return await this.bucket.pathExists({ path: target });
    }
    /**
     * Return the file stat.
     * @param {Object} params
     * @param {String} params.path - the path of the file to stat- this is relative to the item root
     * @return {Boolean}
     */
    async stat({ path }) {
        let target = nodePath.join(this.itemPath, path);
        return await this.bucket.stat({ path: target });
    }
    /**
     * Create the item in the storage.
     * @return {Boolean}
     */
    async createItem() {
        if (await this.itemExists()) {
            throw new Error(`An item with that identifier already exists`);
        }
        let roCrateFileHash = hasha(JSON.stringify(this.roCrateSkeleton));
        await this.bucket.put({
            target: this.roCrateFile,
            json: this.roCrateSkeleton,
        });
        await this.bucket.put({
            target: this.inventoryFile,
            json: { content: { "ro-crate-metadata.json": roCrateFileHash } },
        });
        await this.bucket.put({
            target: this.identifierFile,
            json: {
                id: this.id,
                className: this.className,
                domain: this.domain,
                itemPath: this.itemPath,
                splay: this.splay,
            },
        });
        // patch the index file
        await this.indexer.patchIndex({
            action: "PUT",
            domain: this.domain,
            className: this.className,
            id: this.id,
            splay: this.splay,
        });
    }
    /**
     * Get a file from the item on the storage.
     * @param {Object} params
     * @param {String} params.localPath - the local path where you want to download the file to
     * @param {String} params.target - the file on the storage, relative to the item path, that you want to download
     */
    async get({ localPath, target }) {
        target = nodePath.join(this.itemPath, target);
        return await this.bucket.get({ target, localPath });
    }
    /**
     * Get file versions.
     * @param {Object} params
     * @param {String} params.target - the file whose versions to retrieve
     * @return {Array} - versions of the specified file ordered newest to oldest. The file as named (ie without a version
     *   string will be the first - newest - entry)
     */
    async listFileVersions({ target }) {
        target = nodePath.basename(target, nodePath.extname(target));
        let files = await this.bucket.listObjects({ prefix: nodePath.join(this.itemPath, target) });
        let versions = files.Contents.map((c) => c.Key).sort();
        return [...versions.slice(1), versions[0]].reverse();
    }
    /**
     * Get a JSON file from the item on the storage.
     * @param {Object} params
     * @param {String} params.localPath - the local path where you want to download the file to
     * @param {String} params.target - the file on the storage, relative to the item path, that you want to download
     */
    async getJSON({ localPath, target }) {
        return JSON.parse(await this.get({ localPath, target }));
    }
    /**
     * Get a presigned link to the file.
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path, that you want the url for
     * @param {String} params.download - get link that can be used to trigger a direct file download
     */
    async getPresignedUrl({ target, download }) {
        target = nodePath.join(this.itemPath, target);
        return await this.bucket.getPresignedUrl({ target, download });
    }
    /**
     * Put a file into the item on the storage.
     * @param {Object} params
     * @param {String} params.localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} params.json - a JSON object to store in the file directly
     * @param {String} params.content - some content to store in the file directly
     * @param {String} params.target - the target name for the file; this will be set relative to the item path
     * @param {Boolean} params.registerFile=true - whether the file should be registered in ro-crate-metadata.json.
     *  The file will be registered in the hasPart property of the root dataset if there isn't already an entry for the file.
     * @param {Boolean} params.version=false - whether the file should be versioned. If true, the existing file will be copied
     *  to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
     * @param {Transfer[]} params.batch - an array of objects defining content to put into the store where the params
     *  are as for the single case. Uploads will be run 5 at a time.
     */
    async put({ localPath = undefined, json = undefined, content = undefined, target = undefined, registerFile = true, version = false, batch = [], }) {
        if (!(await this.itemExists())) {
            throw new Error(`The item doesn't exist`);
        }
        if (!batch.length && !target) {
            // nothing to do
            return;
        }
        transfer = transfer.bind(this);
        updateCrateMetadata = updateCrateMetadata.bind(this);
        if (batch.length) {
            let chunks = chunk(batch, 5);
            for (let chunk of chunks) {
                let transfers = chunk.map((t) => transfer(t));
                await Promise.all(transfers);
            }
        }
        else {
            await transfer({ localPath, json, content, target, registerFile, version });
        }
        // get the crate file
        let crate = await this.getJSON({ target: "ro-crate-metadata.json" });
        // console.log(crate["@graph"]);
        // patch in any updates that need to be patched in
        if (target) {
            crate["@graph"] = await updateCrateMetadata({
                graph: crate["@graph"],
                target,
                registerFile,
            });
        }
        if (batch.length) {
            for (let { target, registerFile } of batch) {
                crate["@graph"] = await updateCrateMetadata({
                    graph: crate["@graph"],
                    target,
                    registerFile,
                });
            }
        }
        // update the ro crate file
        await this.bucket.put({
            target: this.roCrateFile,
            json: crate,
        });
        async function transfer({ localPath, json, content, target, registerFile, version }) {
            if (specialFiles.includes(target)) {
                throw new Error(`You can't upload a file called '${target} as that's a special file used by the system`);
            }
            if (localPath) {
                let hash = await sha512(localPath);
                await this.__updateInventory({ target, hash });
            }
            else if (json) {
                await this.__updateInventory({ target, hash: hasha(JSON.stringify(json)) });
            }
            else {
                await this.__updateInventory({ target, hash: hasha(content) });
            }
            let s3Target = nodePath.join(this.itemPath, target);
            if (version) {
                const date = new Date().toISOString();
                let versionFile = nodePath.join(this.itemPath, `${nodePath.basename(target, nodePath.extname(target))}.v${date}${nodePath.extname(target)}`);
                try {
                    await this.bucket.copy({ source: s3Target, target: versionFile });
                }
                catch (error) {
                    if (error.message === "The specified key does not exist.") {
                        // no source file available - that's ok - ignore it - nothing to version yet
                    }
                    else {
                        throw new Error(error.message);
                    }
                }
                await this.bucket.put({ localPath, json, content, target: s3Target });
            }
            else {
                await this.bucket.put({ localPath, json, content, target: s3Target });
            }
        }
        async function updateCrateMetadata({ graph, target, registerFile }) {
            // we don't register the ro crate file
            if (registerFile && target === "ro-crate-metadata.json")
                return graph;
            // find the root dataset
            let rootDescriptor = graph.filter((e) => e["@id"] === "ro-crate-metadata.json" && e["@type"] === "CreativeWork")[0];
            let rootDataset = graph.filter((e) => e["@id"] === rootDescriptor.about["@id"])[0];
            if (!rootDataset) {
                console.log(`${this.itemPath}/ro-crate-metadata.json DOES NOT have a root dataset`);
                return;
            }
            // update the hasPart property if required
            if (!rootDataset.hasPart) {
                rootDataset.hasPart = [{ "@id": target }];
            }
            else {
                let partReferenced = rootDataset.hasPart.filter((p) => p["@id"] === target);
                if (!partReferenced.length) {
                    rootDataset.hasPart.push({ "@id": target });
                }
            }
            // add a File entry to the crate is none there already
            let fileEntry = graph.filter((e) => e["@id"] === target);
            if (!fileEntry.length) {
                let stat = await this.stat({ path: target });
                graph.push({
                    "@id": target,
                    "@type": "File",
                    name: target,
                    contentSize: stat.ContentLength,
                    dateModified: stat.LastModified,
                    "@reverse": {
                        hasPart: [{ "@id": "./" }],
                    },
                });
            }
            graph = graph.map((e) => {
                if (e["@id"] === rootDescriptor.about["@id"])
                    return rootDataset;
                return e;
            });
            return graph;
        }
    }
    /**
     * Remove a file or files from an item in the storage. Files will also be removed from the hasPart property of the root dataset.
     * @param {Object} params
     * @param {String|Array.<String>} [params.target] - the target name for the file or array of target files; this will be set relative to the item path
     * @param {String} [params.prefix] - file prefix; this will be set relative to the item path
     */
    async delete({ target = undefined, prefix = undefined }) {
        if (specialFiles.includes(target)) {
            throw new Error(`You can't delete a file called '${target} as that's a special file used by the system`);
        }
        if (!(await this.itemExists())) {
            throw new Error(`The item doesn't exist`);
        }
        let crate = await this.getJSON({ target: "ro-crate-metadata.json" });
        if (target) {
            if (!isString(target) && !isArray(target)) {
                throw new Error(`target must be a string or array of strings`);
            }
            if (isString(target))
                target = [target];
            let keys = target.map((t) => nodePath.join(this.itemPath, t));
            await this.bucket.delete({ keys });
            crate["@graph"] = updateCrateMetadata({ graph: crate["@graph"], keys: target });
        }
        else if (prefix) {
            if (!isString(prefix)) {
                throw new Error(`prefix must be a string`);
            }
            await this.bucket.delete({ prefix: nodePath.join(this.itemPath, prefix) });
            crate["@graph"] = updateCrateMetadata({ graph: crate["@graph"], prefix });
        }
        // update the ro crate file
        await this.bucket.put({
            target: this.roCrateFile,
            json: crate,
        });
        function updateCrateMetadata({ graph, keys = [], prefix }) {
            // find the root dataset
            let rootDescriptor = graph.filter((e) => e["@id"] === "ro-crate-metadata.json" && e["@type"] === "CreativeWork")[0];
            let rootDataset = graph.filter((e) => e["@id"] === rootDescriptor.about["@id"])[0];
            if (!rootDataset) {
                console.log(`${this.itemPath}/ro-crate-metadata.json DOES NOT have a root dataset`);
                return;
            }
            if (keys.length) {
                let hasPart = rootDataset.hasPart.filter((e) => {
                    return !keys.includes(e["@id"]);
                });
                rootDataset.hasPart = hasPart;
                graph = graph.filter((e) => !keys.includes(e["@id"]));
            }
            else if (prefix) {
                let re = new RegExp(prefix);
                let hasPart = rootDataset.hasPart.filter((e) => !e["@id"].match(re));
                rootDataset.hasPart = hasPart;
                graph = graph.filter((e) => !e["@id"].match(re));
            }
            graph = graph.map((e) => {
                if (e["@id"] === rootDescriptor.about["@id"])
                    return rootDataset;
                return e;
            });
            return graph;
        }
    }
    /**
     * Delete the item.
     */
    async deleteItem() {
        if (!(await this.itemExists())) {
            throw new Error(`The item doesn't exist`);
        }
        await this.bucket.delete({ prefix: `${this.itemPath}/` });
        // patch the index file
        await this.indexer.patchIndex({
            action: "DELETE",
            domain: this.domain,
            className: this.className,
            id: this.id,
            splay: this.splay,
        });
    }
    /**
     * Recursively walk and list all of the files for the item.
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
            }
            else {
                return resources.Contents;
            }
        }
    }
    /**
     * Update the file inventory.
     * @private
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path
     * @param {String} params.hash - the hash (checksum) of the file
     * @return a list of files
     */
    async __updateInventory({ target, hash }) {
        let inventory = JSON.parse(await this.bucket.get({ target: this.inventoryFile }));
        inventory.content[target] = hash;
        await this.bucket.put({
            target: this.inventoryFile,
            json: inventory,
        });
    }
}
const sha512 = (path) => new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    const rs = createReadStream(path);
    rs.on("error", reject);
    rs.on("data", (chunk) => hash.update(chunk));
    rs.on("end", () => resolve(hash.digest("hex")));
});
