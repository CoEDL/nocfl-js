import { Bucket } from "./s3.js";
import { Walker } from "./walker.js";
import lodashPkg from "lodash";
const { orderBy, uniqBy, random } = lodashPkg;
import hasha from "hasha";

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
     * Patch an index file - add new item to it or remove an existing item. This method works by uploading a patch file
     *  and then running a process to patch all the relevant index files. If it detects a lockfile (a patching process is running)
     *  it will sleep for a short time and then try again. Given this, you probably don't want to 'await'
     *  this in your code as it could take a while to run; depending on how many parallel patch operations are run.
     *
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

        let indexBase = `${prefix}/indices/${type}`;
        let patch = {
            action,
            data: { prefix, type, id, splay },
        };
        let patchFile = `patch-${hasha(JSON.stringify(patch), { algorithm: "sha256" })}`;

        await this.bucket.put({ target: `${indexBase}/${patchFile}`, json: patch });
        await new Promise((resolve) => setTimeout(resolve, random(0, 1, true) * 300));
        await this.__patchIndices({ prefix, type });
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
        if (!files) return [];
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
        try {
            return await this.bucket.readJSON({ target: indexFile });
        } catch (error) {
            if (error.message === "The specified key does not exist.")
                return `Index file does not exist`;
            throw new Error(error.message);
        }
    }

    /**
     * Apply the index files patches to the relevant index files
     * @private
     * @param {Object} params
     * @param {string} params.prefix - provide the domain of the index file
     * @param {string} params.type - the class name of the item being operated on
     */
    async __patchIndices({ prefix, type, count = 1 }) {
        const base = `${prefix}/indices/${type}`;
        const lockFile = `${base}/.update`;

        let exists = await this.bucket.pathExists({ path: lockFile });
        if (exists) {
            if (count < 3) {
                count += 1;

                // wait a little then try this again
                await new Promise((resolve) => setTimeout(resolve, random(1, 2, true) * 1000));
                await this.__patchIndices({ prefix, type, count });
            }
        }

        // upload lock file
        await this.bucket.put({ target: lockFile, json: { date: new Date() } });

        // get list of patch files to be applied
        let patchFiles = await this.bucket.listObjects({ prefix: `${base}/patch` });
        patchFiles = patchFiles?.Contents?.map((f) => f.Key);
        if (!patchFiles?.length) {
            await this.bucket.delete({ keys: [lockFile] });
            return;
        }

        // walk the patchFiles, download the relevant index and patch it
        let indexFiles = {};
        for (let file of patchFiles) {
            let patch;
            try {
                patch = await this.bucket.readJSON({ target: file });
            } catch (error) {
                continue;
            }
            let indexFileName = `${base}/${patch.data.id.slice(0, 1).toLowerCase()}.json`;
            let indexFile = indexFiles[indexFileName];
            if (!indexFile) {
                try {
                    indexFiles[indexFileName] = await this.bucket.readJSON({
                        target: indexFileName,
                    });
                } catch (error) {
                    indexFiles[indexFileName] = [];
                }
            }

            if (patch.action === "PUT") {
                indexFiles[indexFileName].push(patch.data);
            } else if (patch.action === "DELETE") {
                indexFiles[indexFileName] = indexFiles[indexFileName].filter(
                    (i) => i.id !== patch.data.id
                );
            }
            indexFiles[indexFileName] = uniqBy(indexFiles[indexFileName], "id");
        }

        // upload the index files
        for (let file of Object.keys(indexFiles)) {
            await this.bucket.put({ target: file, json: indexFiles[file] });
        }

        // remove the lockfile and patchFiles that we just processed
        await this.bucket.delete({ keys: [lockFile, ...patchFiles] });
    }
}
