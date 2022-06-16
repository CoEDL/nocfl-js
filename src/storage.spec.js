import { S3, Bucket } from "./s3.js";
import { Store } from "./storage.js";
import fsExtra from "fs-extra";
const { pathExists, remove, readdir } = fsExtra;
import path from "path";
import hasha from "hasha";

describe.only("Test storage actions", () => {
    const bucket = "repository";
    const credentials = {
        bucket,
        accessKeyId: "root",
        secretAccessKey: "rootpass",
        endpoint: "http://localhost:10000",
        forcePathStyle: true,
        region: "us-west-1",
    };

    afterAll(async () => {});

    test("it should be able to init a connection to the storage", () => {
        const store = new Store({ className: "item", id: "test", credentials, bucket });
        expect(store.bucket).toBeDefined;
    });
    test("it should not be able to init a connection to the storage", () => {
        try {
            const store = new Store({});
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'id'`);
        }
    });
    test("it should be able to see if an item path exists or not", async () => {
        const store = new Store({ className: "item", id: "test", credentials });
        let pathExists = await store.itemExists();
        expect(pathExists).toBeFalse;

        let bucket = new Bucket(credentials);
        let itemPath = path.join("item", "t", "test");
        await bucket.upload({ json: {}, target: path.join(itemPath, "ro-crate-metadata.json") });

        pathExists = await store.itemExists();
        expect(pathExists).toBeTrue;

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should be able to upload / download a file", async () => {
        const itemPath = path.join("item", "t", "test");
        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });

        await store.put({ localPath: path.join(__dirname, file), target: file });
        let resources = await store.loadResources({});
        expect(resources.length).toEqual(1);
        expect(resources[0].Key).toEqual(path.join(itemPath, file));

        await store.get({ target: file, localPath: path.join("/tmp", file) });
        expect(await pathExists(path.join("/tmp", file))).toBe(true);
        await remove(path.join("/tmp", file));
        expect(await pathExists(path.join("/tmp", file))).toBe(false);

        let bucket = new Bucket(credentials);
        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should be able to get a list of files in the item", async () => {
        const itemPath = path.join("item", "t", "test");
        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });

        await store.put({ localPath: path.join(__dirname, file), target: file });
        let resources = await store.loadResources({});
        expect(resources.length).toEqual(1);

        let bucket = new Bucket(credentials);
        await bucket.removeObjects({ prefix: itemPath });
    });
});
