import { Bucket } from "./s3.js";
import fsExtra from "fs-extra";
const { createReadStream } = fsExtra;
import crypto from "crypto";
import * as nodePath from "path";
import hasha from "hasha";

export class Store {
    /*
     *   @param: {String} className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     *   @param: {String} id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     *   @param: {String} [domain] - provide this to prefix the paths by domain
     *   @param: {String} credentials.bucket - the AWS bucket to connect to
     *   @param: {String} credentials.accessKeyId - the AWS accessKey
     *   @param: {String} credentials.secretAccessKey - the AWS secretAccessKey
     *   @param: {String} credentials.region - the AWS region
     *   @param: {String} [credentials.endpoint] - the endpoint URL when using an S3 like service (e.g. Minio)
     *   @param: {Boolean} [credentials.forcePathStyle] - whether to force path style endpoints (required for Minio and the like)
     *   @param: {Number} [splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    constructor({ domain, className, id, credentials, splay = 1 }) {
        if (!id) throw new Error(`Missing required property: 'id'`);
        if (!className) throw new Error(`Missing required property: 'className'`);
        if (!credentials) throw new Error(`Missing required property: 'credentials'`);

        const requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
        requiredProperties.forEach((property) => {
            if (!credentials[property]) {
                throw new Error(`Missing required property: '${property}'`);
            }
        });

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
        this.itemPath = domain
            ? `${domain}/${className}/${id.slice(0, splay)}/${id}`
            : `${className}/${id.slice(0, splay)}/${id}`;
        this.roCrateFile = nodePath.join(this.itemPath, "ro-crate-metadata.json");
        this.inventoryFile = nodePath.join(this.itemPath, "inventory.json");
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

    /*
     *   @description {String}: Check whether the item exists in the storage
     *   @returns {Boolean}
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

    /*
     *   @description {String}: Get the item path
     *   @returns {String}
     */
    getItemPath() {
        return this.itemPath;
    }

    /*
     *   @description {String}: Check whether the path exists in the storage
     *   @returns {Boolean}
     */
    async pathExists({ path }) {
        let target = nodePath.join(this.itemPath, path);
        return await this.bucket.pathExists({ path: target });
    }

    async stat({ path }) {
        let target = nodePath.join(this.itemPath, path);
        return await this.bucket.stat({ path: target });
    }

    /*
     *   @description {String}: Create the item in the storage
     *   @returns {Boolean}
     */
    async createItem() {
        if (await this.itemExists()) {
            throw new Error(`An item with that identifier already exists`);
        }
        let roCrateFileHash = hasha(JSON.stringify(this.roCrateSkeleton));
        await this.bucket.upload({
            target: nodePath.join(this.itemPath, "ro-crate-metadata.json"),
            json: this.roCrateSkeleton,
        });

        await this.bucket.upload({
            target: nodePath.join(this.itemPath, "inventory.json"),
            json: { content: { "ro-crate-metadata.json": roCrateFileHash } },
        });
    }

    /*
     *   @description {String}: get a file from the item on the storage
     *   @param: {String} localPath - the path to the file locally where you want to download the file to
     *   @param: {String} target - the file on the storage, relative to the item path, that you want to download
     */
    async get({ localPath, target }) {
        target = nodePath.join(this.itemPath, target);

        return await this.bucket.download({ target, localPath });
    }

    /*
     *   @description {String}: get a presigned-url to the file
     *   @param: {String} target - the file on the storage, relative to the item path, that you want the url for
     */
    async getPresignedUrl({ target }) {
        target = nodePath.join(this.itemPath, target);
        return await this.bucket.getPresignedUrl({ target });
    }

    /*
     *   @description {String}: put a file into the item on the storage
     *   @param: {String} localPath - the path to the file locally that you want to upload to the item folder
     *   @param: {String} target - the target name for the file; this will be set relative to the item path
     */
    async put({ localPath, json, content, target }) {
        let s3Target = nodePath.join(this.itemPath, target);
        if (!(await this.itemExists())) {
            throw new Error(`You need to 'createItem' before you can add content to it`);
        }

        if (localPath) {
            let hash = await sha512(localPath);
            await this.updateInventory({ target, hash });
        } else if (json) {
            await this.updateInventory({ target, hash: hasha(JSON.stringify(json)) });
        } else {
            await this.updateInventory({ target, hash: hasha(content) });
        }
        return await this.bucket.upload({ localPath, json, content, target: s3Target });
    }

    /*
     *   @description {String}: recursively walk and list all of the files for the item
     *   @returns: a list of files
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

    async updateInventory({ target, hash }) {
        let inventoryFile = nodePath.join(this.itemPath, "inventory.json");
        let inventory = JSON.parse(await this.bucket.download({ target: inventoryFile }));
        inventory.content[target] = hash;
        await this.bucket.upload({
            target: inventoryFile,
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
