import { Bucket } from "./s3.js";
import * as nodePath from "path";
import hasha from "hasha";
import { Indexer } from "./indexer.js";
import mime from "mime-types";
import lodashPkg from "lodash";
const { isUndefined, isString, isArray, chunk, uniqBy } = lodashPkg;

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
 * @property {String} bucket - the AWS bucket to connect to
 * @property {String} accessKeyId - the AWS accessKey
 * @property {String} secretAccessKey - the AWS secretAccessKey
 * @property {String} region - the AWS region
 * @property {String} [endpoint] - the endpoint URL when using an S3 like service (e.g. Minio)
 * @property {Boolean} [forcePathStyle] - whether to force path style endpoints (required for Minio and the like)
 */

/** Class representing an S3 store. */
export class Store {
    /**
     * Interact with an object in an S3 bucket.
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     * @param {string} params.prefix -  define a path prefix
     * @param {string} params.type - the class / type of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} params.id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {number} [params.splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    //  /**
    //  * Interact with a store in an S3 bucket.
    //  * @deprecated From version 2
    //  * @constructor
    //  * @param {Object} params
    //  * @param {Credentials} params.credentials - the AWS credentials to use for the connection
    //  * @param {string} params.className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
    //  * @param {string} params.id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
    //  * @param {string} params.domain - provide this to prefix the paths by domain
    //  * @param {number} [params.splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
    //  */

    constructor({
        domain = undefined,
        prefix = undefined,
        className,
        type,
        id,
        credentials,
        splay = 1,
    }) {
        if (!id) throw new Error(`Missing required property: 'id'`);
        if (!domain && !prefix) throw new Error(`Missing required property: 'domain' || 'prefix'`);
        if (!className && !type)
            throw new Error(`Missing required property: 'className' || 'type'`);
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

        if (!isUndefined && !isString(className)) {
            throw new Error(`The 'className' must be a string`);
        }
        if (!isUndefined && !isString(type)) {
            throw new Error(`The 'type' must be a string`);
        }
        if (!isUndefined && !isString(domain)) {
            throw new Error(`The 'domain' must be a string`);
        }
        if (!isUndefined && !isString(prefix)) {
            throw new Error(`The 'prefix' must be a string`);
        }

        if (!id.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error(
                `The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
        if (!isUndefined && !className.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error(
                `The 'className' doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
        if (!isUndefined && !type.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error(
                `The 'type' doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }

        this.credentials = credentials;
        this.bucket = new Bucket(credentials);
        this.id = id;
        this.type = type ? type : className;
        this.prefix = prefix ? prefix : domain;
        this.objectPath = `${this.prefix.toLowerCase()}/${this.type.toLowerCase()}/${id.slice(
            0,
            splay
        )}/${id}`;

        // @deprecate v2
        this.domain = this.prefix;
        this.itemPath = this.objectPath;
        this.className = this.type;
        //

        this.splay = splay;
        this.roCrateFile = nodePath.join(this.objectPath, "ro-crate-metadata.json");
        this.inventoryFile = nodePath.join(this.objectPath, "nocfl.inventory.json");
        this.identifierFile = nodePath.join(this.objectPath, "nocfl.identifier.json");
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
     * @deprecated Use exists from version 2
     * @see {@link exists}
     * @return {Boolean}
     */
    async itemExists() {
        if (await this.bucket.pathExists({ path: this.identifierFile })) {
            return true;
        }
        return false;
    }

    /**
     * Check whether the object exists in the storage.
     * @since 1.17.0
     * @return {Boolean}
     */
    async exists() {
        if (await this.bucket.pathExists({ path: this.identifierFile })) {
            return true;
        }
        return false;
    }

    /**
     * Check whether the path exists in the storage.
     * @deprecated use fileExists from version 2
     * @see {@link fileExists}
     * @param {Object} params
     * @param {String} params.path - the path of the file to check - this is relative to the item root
     * @return {Boolean}
     */
    async pathExists({ path }) {
        let target = nodePath.join(this.itemPath, path);
        return await this.bucket.pathExists({ path: target });
    }

    /**
     * Check whether the path exists in the storage.
     * @since 1.17.0
     * @param {Object} params
     * @param {String} params.path - the path of the file to check - this is relative to the item root
     * @return {Boolean}
     */
    async fileExists({ path }) {
        let target = nodePath.join(this.objectPath, path);
        return await this.bucket.pathExists({ path: target });
    }

    /**
     * Get the item path.
     * @deprecated use getObjectPath from version 2
     * @see {@link getObjectPath}
     * @return {String}
     */
    getItemPath() {
        return this.objectPath;
    }

    /**
     * Get the path of the object in the storage.
     * @since 1.17.0
     * @return {String}
     */
    getObjectPath() {
        return this.objectPath;
    }

    /**
     * Get the item identifier.
     * @deprecated use getObjectIdentifier from version 2
     * @see {@link getObjectIdentifier}
     * @return {Object}
     */
    async getItemIdentifier() {
        return await this.getJSON({ target: "nocfl.identifier.json" });
    }

    /**
     * Get the object identifier.
     * @since 1.17.0
     * @return {Object}
     */
    async getObjectIdentifier() {
        return await this.getJSON({ target: "nocfl.identifier.json" });
    }

    /**
     * Get the item inventory file.
     * @deprecated use getObjectInventory from version 2
     * @see {@link getObjectInventory}
     * @return {Object}
     */
    async getItemInventory() {
        return await this.getJSON({ target: "nocfl.inventory.json" });
    }

    /**
     * Get the object inventory file.
     * @since 1.17.0
     * @return {Object}
     */
    async getObjectInventory() {
        return await this.getJSON({ target: "nocfl.inventory.json" });
    }

    /**
     * Return the file stat.
     * @param {Object} params
     * @param {String} params.path - the path of the file to stat- this is relative to the item root
     * @return {Boolean}
     */
    async stat({ path }) {
        let target = nodePath.join(this.objectPath, path);
        return await this.bucket.stat({ path: target });
    }

    /**
     * Create the item in the storage.
     * @deprecated use createObject from version 2
     * @see {@link createObject}
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
     * Create the object in the storage.
     * @since 1.17.0
     * @return {Boolean}
     */
    async createObject() {
        if (await this.exists()) {
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
                type: this.type,
                prefix: this.prefix,
                objectPath: this.objectPath,
                splay: this.splay,
            },
        });

        // patch the index file
        await this.indexer.patchIndex({
            action: "PUT",
            prefix: this.prefix,
            type: this.type,
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
        target = nodePath.join(this.objectPath, target);
        return await this.bucket.get({ target, localPath });
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
     * Get file versions.
     * @param {Object} params
     * @param {String} params.target - the file whose versions to retrieve
     * @return {Array} - versions of the specified file ordered newest to oldest. The file as named (ie without a version
     *   string will be the first - newest - entry)
     */
    async listFileVersions({ target }) {
        target = nodePath.basename(target, nodePath.extname(target));
        let files = await this.bucket.listObjects({
            prefix: nodePath.join(this.objectPath, target),
        });
        let versions = files.Contents.map((c) => c.Key).sort();
        versions = [...versions.slice(1), versions[0]].reverse();
        return versions.map((v) => v.replace(`${this.getObjectPath()}/`, ""));
    }

    /**
     * Get a presigned link to the file.
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path, that you want the url for
     * @param {String} params.download - get link that can be used to trigger a direct file download
     */
    async getPresignedUrl({ target, download }) {
        target = nodePath.join(this.objectPath, target);
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
     * @param {String} params.mimetype - the mimetype of the file. If not defined, the library will try to determine it.
     * @param {Transfer[]} params.batch - an array of objects defining content to put into the store where the params
     *  are as for the single case. Uploads will be run 5 at a time.
     */
    async put({
        localPath = undefined,
        json = undefined,
        content = undefined,
        target = undefined,
        registerFile = true,
        version = false,
        mimetype = undefined,
        batch = [],
    }) {
        if (!(await this.exists())) {
            throw new Error(`The item doesn't exist`);
        }

        if (!batch.length && !target) {
            // nothing to do
            return;
        }

        putFile = putFile.bind(this);
        if (batch.length) {
            let chunks = chunk(batch, 5);
            for (let chunk of chunks) {
                let transfers = chunk.map((params) => putFile(params));
                await Promise.all(transfers);
            }
        } else {
            await putFile({ localPath, json, content, target, registerFile, version });
        }

        // get the crate file
        let crate = await this.getJSON({ target: "ro-crate-metadata.json" });

        // patch in any updates that need to be patched in
        if (target && registerFile) {
            crate["@graph"] = await this.__updateCrateMetadata({
                graph: crate["@graph"],
                add_target: target,
                mimetype,
            });
        }
        if (batch.length) {
            for (let { target, registerFile } of batch) {
                // if registerFile = undefined set to true by default
                registerFile = registerFile !== undefined ? registerFile : true;
                if (registerFile) {
                    crate["@graph"] = await this.__updateCrateMetadata({
                        graph: crate["@graph"],
                        add_target: target,
                        mimetype,
                    });
                }
            }
        }

        // update the ro crate file
        await this.bucket.put({
            target: this.roCrateFile,
            json: crate,
        });

        async function putFile({ localPath, json, content, target, version }) {
            if (specialFiles.includes(target)) {
                throw new Error(
                    `You can't upload a file called '${target} as that's a special file used by the system`
                );
            }
            let newContentHash;
            if (localPath) {
                newContentHash = await hasha.fromFile(localPath, { algorithm: "sha512" });
            } else if (json) {
                newContentHash = hasha(JSON.stringify(json), { algorithm: "sha512" });
            } else {
                newContentHash = hasha(content, { algorithm: "sha512" });
            }

            if (version && (await this.fileExists({ path: target }))) {
                let currentContentHash = await this.hashTarget({ target });
                if (currentContentHash !== newContentHash) {
                    await this.version({ target, hash: currentContentHash });
                }
            }
            try {
                await this.bucket.put({
                    localPath,
                    json,
                    content,
                    target: nodePath.join(this.getObjectPath(), target),
                });
                await this.updateInventory({ target, hash: newContentHash });
            } catch (error) {
                console.log(error);
            }
        }
    }

    /**
     * Copy a file into the item from another part of the storage. This capability is specifically to support using
     *  different locations in the bucket for working data and repository data where the repository data might contain versioned
     *  copies of the working data.
     * @param {Object} params
     * @param {String} params.source - the source file to be copied - this must be a full path to the file inside the bucket
     * @param {String} params.target - the target location to copy the source file to; this is relative to the object path
     * @param {Boolean} params.version=false - whether the file should be versioned. If true, the existing file will be copied
     *  to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
     * @param {Transfer[]} params.batch - an array of objects defining content to put into the store where the params
     *  are as for the single case. Uploads will be run 5 at a time.
     */
    async copy({
        source = undefined,
        bucket = undefined,
        target = undefined,
        version = false,
        batch = [],
    }) {
        if (!(await this.exists())) {
            throw new Error(`The item doesn't exist`);
        }

        if (!batch.length && !target) {
            // nothing to do
            return;
        }

        copyFile = copyFile.bind(this);
        if (batch.length) {
            let chunks = chunk(batch, 5);
            for (let chunk of chunks) {
                let transfers = chunk.map((params) => copyFile(params));
                await Promise.all(transfers);
            }
        } else {
            await copyFile({ source, bucket, target, registerFile, version });
        }

        async function copyFile({ source, target, version }) {
            if (specialFiles.includes(target)) {
                throw new Error(
                    `You can't upload a file called '${target} as that's a special file used by the system`
                );
            }
            let sourceHash = await this.hashTarget({ target: source, relative: false });
            if (version && (await this.fileExists({ path: target }))) {
                let targetHash = await this.hashTarget({ target });
                if (sourceHash !== targetHash) {
                    await this.version({ target, hash: targetHash });
                }
            }
            try {
                await this.bucket.copy({ source, target: `${this.getObjectPath()}/${target}` });
                await this.updateInventory({ target, hash: sourceHash });
            } catch (error) {
                console.log(error);
            }
        }
    }

    // TODO method to add all files to the crate
    //   TODO it should not overwrite any files that were added by the user
    //  deprecate registerfile from put
    async registerFilesInCrateMetadata() {}

    /**
     * Version a file.
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path, that is to be versioned
     */
    async version({ target, hash }) {
        // can't version a target that isn't there
        if (!(await this.fileExists({ path: target }))) return;

        const source = nodePath.join(this.objectPath, target);
        const date = new Date().toISOString();
        const extension = nodePath.extname(source);
        const basename = nodePath.basename(source, extension);
        target = `${basename}.v${date}${extension}`;
        try {
            await this.bucket.copy({ source, target: nodePath.join(this.objectPath, target) });
            await this.updateInventory({ target, hash });
        } catch (error) {
            throw new Error(error.message);
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
            throw new Error(
                `You can't delete a file called '${target} as that's a special file used by the system`
            );
        }

        let crate = await this.getJSON({ target: "ro-crate-metadata.json" });

        if (target) {
            if (!isString(target) && !isArray(target)) {
                throw new Error(`target must be a string or array of strings`);
            }
            if (isString(target)) target = [target];
            let keys = target.map((t) => nodePath.join(this.objectPath, t));
            await this.bucket.delete({ keys });
            crate["@graph"] = await this.__updateCrateMetadata({
                graph: crate["@graph"],
                remove_keys: target,
            });
        } else if (prefix) {
            if (!isString(prefix)) {
                throw new Error(`prefix must be a string`);
            }
            await this.bucket.delete({ prefix: nodePath.join(this.objectPath, prefix) });
            crate["@graph"] = await this.__updateCrateMetadata({
                graph: crate["@graph"],
                remove_prefix: prefix,
            });
        }
        // update the ro crate file
        await this.bucket.put({
            target: this.roCrateFile,
            json: crate,
        });
    }

    /**
     * Delete the item.
     * @deprecated use removeObject from version 2
     * @see {@link removeObject}
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
     * Delete the object in the storage.
     * @since 1.17.0
     */
    async removeObject() {
        await this.bucket.delete({ prefix: `${this.objectPath}/` });

        // patch the index file
        await this.indexer.patchIndex({
            action: "DELETE",
            prefix: this.prefix,
            type: this.type,
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
            r.Key = r.Key.replace(`${this.objectPath}/`, "");
            return r;
        });
        return resources;

        async function listItemResources({ continuationToken }) {
            let resources = await this.bucket.listObjects({
                prefix: `${this.objectPath}/`,
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
     * Resolve the full path of a file in the storage
     * @since 1.17.0
     * @param {String} params.path - the path to the file relative to the object root that it to be resolved
     * @return the full path to a file
     */
    resolvePath({ path }) {
        return `${this.objectPath}/${path}`;
    }

    /**
     * Calculate the SHA512 hash of a file in storage
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path, that is to be hashed
     * @return the hash of the file or undefined
     */
    async hashTarget({ target, relative = true }) {
        if (relative) target = nodePath.join(this.objectPath, target);

        const stream = await this.bucket.stream({ target });
        if (stream) {
            let hash = await hasha.fromStream(stream, { algorithm: "sha512" });
            return hash;
        }
    }

    /**
     * Update the file inventory.
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path
     * @param {String} params.hash - the hash (checksum) of the file
     * @return a list of files
     */
    async updateInventory({ target, hash }) {
        let inventory = JSON.parse(await this.bucket.get({ target: this.inventoryFile }));
        inventory.content[target] = hash;
        await this.bucket.put({
            target: this.inventoryFile,
            json: inventory,
        });
    }

    /**
     * Update the hasPart property of the root dataset.
     * @private
     * @param {Object} params
     * @param {Object} params.graph - crate['@graph']
     * @param {String} params.add_target - the name of a file to add to the hasPart property
     * @param {Array.<String>} params.remove_keys - an array of keys and entities to remove from the graph
     * @param {String} params.remove_prefix - a string prefix to match on and remove from the graph
     * @return the graph
     */
    async __updateCrateMetadata({
        graph,
        add_target = undefined,
        remove_keys = [],
        remove_prefix = "",
        mimetype = undefined,
    }) {
        // find the root dataset
        let rootDescriptor = graph.filter(
            (e) => e["@id"] === "ro-crate-metadata.json" && e["@type"] === "CreativeWork"
        )[0];
        let rootDataset = graph.filter((e) => e["@id"] === rootDescriptor.about["@id"])[0];
        if (!rootDataset) {
            console.log(`${this.objectPath}/ro-crate-metadata.json DOES NOT have a root dataset`);
            return;
        }

        // ensure hasPart defined and is array
        if (!rootDataset.hasPart) rootDataset.hasPart = [];
        if (!isArray(rootDataset.hasPart)) rootDataset.hasPart = [rootDataset.hasPart];

        if (add_target && add_target !== "ro-crate-metadata.json") {
            const target = add_target;
            // we don't register the ro crate file

            // update the hasPart property
            rootDataset.hasPart.push({ "@id": target });
            rootDataset.hasPart = uniqBy(rootDataset.hasPart, "@id");

            // add a File entry to the crate is none there already
            let fileEntry = graph.filter((e) => e["@id"] === target);
            if (!fileEntry.length) {
                let stat = await this.stat({ path: target });
                if (!mimetype) mimetype = mime.lookup(target);
                let entity = {
                    "@id": target,
                    "@type": "File",
                    name: target,
                    contentSize: stat.ContentLength,
                    dateModified: stat.LastModified,
                    "@reverse": {
                        hasPart: [{ "@id": "./" }],
                    },
                };
                if (mimetype) entity.encodingFormat = mimetype;
                graph.push(entity);
            }
        } else if (remove_keys.length) {
            let hasPart = rootDataset.hasPart.filter((e) => {
                return !remove_keys.includes(e["@id"]);
            });
            rootDataset.hasPart = hasPart;
            graph = graph.filter((e) => !remove_keys.includes(e["@id"]));
        } else if (remove_prefix) {
            let re = new RegExp(remove_prefix);
            let hasPart = rootDataset.hasPart.filter((e) => !e["@id"].match(re));
            rootDataset.hasPart = hasPart;
            graph = graph.filter((e) => !e["@id"].match(re));
        } else {
            // nothing to do - just return the graph
            return graph;
        }

        graph = graph.map((e) => {
            if (e["@id"] === rootDescriptor.about["@id"]) return rootDataset;
            return e;
        });
        return graph;
    }
}
