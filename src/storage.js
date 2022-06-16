import { Bucket } from "./s3.js";
import path from "path";

export class Store {
    /*
     *   @param: {String} className - the class name of the item being operated on
     *   @param: {String} id - the id of the item being operated on
     *   @param: {String} bucket - the AWS bucket to connect to
     *   @param: {String} accessKeyId - the AWS accessKey
     *   @param: {String} secretAccessKey - the AWS secretAccessKey
     *   @param: {String} region - the AWS region
     *   @param: {String} [endpoint] - the endpoint URL when using an S3 like service (e.g. Minio)
     *   @param: {Boolean} [forPathStyle] - whether to force path style endpoints (required for Minio and the like)
     */
    constructor({ className, id, credentials }) {
        if (!id) throw new Error(`Missing required property: 'id'`);
        if (!className) throw new Error(`Missing required property: 'className'`);

        const requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
        requiredProperties.forEach((property) => {
            if (!credentials[property]) {
                throw new Error(`Missing required property: '${property}'`);
            }
        });
        this.credentials = credentials;
        this.bucket = new Bucket(credentials);
        this.id = id;
        this.className = className;
        this.itemPath = `${className}/${id.charAt(0)}/${id}`;
    }

    /*
     *   @description: Check wether the item exists in the storage
     *   @returns {Boolean}
     */
    async itemExists() {
        let entries = await this.loadResources({ prefix: this.itemPath });
        return entries ? true : false;
    }

    /*
     *   @description: get a file from the item on the storage
     *   @param: {String} localPath - the path to the file locally where you want to download the file to
     *   @param: {String} target - the file on the storage, relative to the item path, that you want to download
     */
    async get({ localPath, target }) {
        target = path.join(this.itemPath, target);
        await this.bucket.download({ target, localPath });
    }

    /*
     *   @description: put a file into the item on the storage
     *   @param: {String} localPath - the path to the file locally that you want to upload to the item folder
     *   @param: {String} target - the target name for the file; this will be set relative to the item path
     */
    async put({ localPath, target }) {
        target = path.join(this.itemPath, target);
        await this.bucket.upload({ localPath, target });
    }

    /*
     *   @description: load all of the files for the item
     *   @returns: a list of files
     */
    async loadResources({ continuationToken }) {
        let resources = await this.bucket.listObjects({ prefix: this.itemPath, continuationToken });
        if (resources.NextContinuationToken) {
            return [
                ...resources.Contents,
                ...(await loadResources({
                    continuationToken: resources.NextContinuationToken,
                })),
            ];
        } else {
            return resources.Contents;
        }
    }
}
