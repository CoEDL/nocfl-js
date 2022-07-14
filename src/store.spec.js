import { S3, Bucket } from "./s3.js";
import { Store } from "./store.js";
import fsExtra from "fs-extra";
const { pathExists, remove, readJSON, readFile, readdir, stat: fileStat } = fsExtra;
import path from "path";

describe("Test storage actions", () => {
    const endpoint = "http://localhost:10000";
    const repository = "repository";
    const credentials = {
        bucket: repository,
        accessKeyId: "root",
        secretAccessKey: "rootpass",
        endpoint,
        forcePathStyle: true,
        region: "us-west-1",
    };
    const bucket = new Bucket(credentials);

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
    test("it should be able to init a connection to the storage", () => {
        const store = new Store({ className: "item", id: "test", credentials });
        expect(store.credentials).toEqual(credentials);
    });
    test("it fail to init a connection - missing classname", () => {
        try {
            new Store({ id: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'className'`);
        }
    });
    test("it fail to init a connection - missing id", () => {
        try {
            new Store({ className: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'id'`);
        }
    });
    test("it fail to init a connection - missing credentials", () => {
        try {
            new Store({ className: "test", id: "test" });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'credentials'`);
        }
    });
    test("it should not accept the identifier - disallowed characters", () => {
        try {
            new Store({ className: "test", id: "test&", credentials });
        } catch (error) {
            expect(error.message).toEqual(
                `The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
    });
    test("it should not accept the className - disallowed characters", () => {
        try {
            new Store({ className: "test&", id: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(
                `The className doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
    });
    test("it should be able to get the item path", () => {
        const store = new Store({ className: "item", id: "test", credentials });
        let itemPath = store.getItemPath();
        expect(itemPath).toEqual("item/t/test");
    });
    test("it should be able to get the item identifier", async () => {
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();
        let identifier = await store.getItemIdentifier();
        expect(identifier.id).toEqual("test");
        expect(identifier.className).toEqual("item");
        expect(identifier.itemPath).toEqual("item/t/test");
        await bucket.removeObjects({ prefix: path.join("item", "t", "test") });
    });
    test("it should be able to get the item identifier", async () => {
        await bucket.removeObjects({ prefix: path.join("item", "t", "test") });
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();
        let inventory = await store.getItemInventory();
        expect(inventory.content["ro-crate-metadata.json"]).toBeDefined;
        await bucket.removeObjects({ prefix: path.join("item", "t", "test") });
    });
    test("it should be able to create items with path splay = 2", () => {
        const store = new Store({ className: "item", id: "test", credentials, splay: 2 });
        let itemPath = store.getItemPath();
        expect(itemPath).toEqual("item/te/test");
    });
    test("it should be able to create items with path splay = 10", () => {
        const store = new Store({ className: "item", id: "test", credentials, splay: 10 });
        let itemPath = store.getItemPath();
        expect(itemPath).toEqual("item/test/test");
    });
    test("it should be able to create a new item", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();
        let resources = await store.listResources();
        expect(resources.length).toEqual(3);
        expect(getFile({ resources, file: "ro-crate-metadata.json" }).Key).toEqual(
            "ro-crate-metadata.json"
        );
        expect(getFile({ resources, file: "nocfl.inventory.json" }).Key).toEqual(
            "nocfl.inventory.json"
        );
        expect(getFile({ resources, file: "nocfl.inventory.json" }).Key).toEqual(
            "nocfl.inventory.json"
        );

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should fail to create a new item when one already exists", async () => {
        const itemPath = path.join("item", "t", "test");
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();
        try {
            await store.createItem();
        } catch (error) {
            expect(error.message).toEqual(`An item with that identifier already exists`);
        }

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should fail trying to overwrite an internal, special file", async () => {
        const itemPath = path.join("item", "t", "test");
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();
        try {
            await store.put({ json: {}, target: "nocfl.inventory.json" });
        } catch (error) {
            expect(error.message).toEqual(
                `You can't upload a file called 'nocfl.inventory.json as that's a special file used by the system`
            );
        }

        try {
            await store.put({ json: {}, target: "nocfl.identifier.json" });
        } catch (error) {
            expect(error.message).toEqual(
                `You can't upload a file called 'nocfl.identifier.json as that's a special file used by the system`
            );
        }

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should fail to upload data if the item has not been created yet", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const store = new Store({ className: "item", id: "test", credentials });
        const file = "s3.js";
        try {
            await store.put({ target: file, localPath: path.join(__dirname, file) });
        } catch (error) {
            expect(error.message).toEqual(
                `You need to 'createItem' before you can add content to it`
            );
        }

        await store.createItem();
        await store.put({ target: file, localPath: path.join(__dirname, file) });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("test file creation in item path without domain", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();
        await store.put({ target: file, localPath: path.join(__dirname, file) });

        let resources = await store.listResources();
        expect(getFile({ resources, file }).Key).toEqual(file);

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("file creation in item path with domain", async () => {
        const domain = "paradisec.org.au";
        const itemPath = path.join(domain, "item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();
        await store.put({ target: file, localPath: path.join(__dirname, file) });

        let resources = await store.listResources();
        expect(getFile({ resources, file }).Key).toEqual(file);

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should be able to see if an item exists or not", async () => {
        const store = new Store({ className: "item", id: "test", credentials });
        let pathExists = await store.itemExists();
        expect(pathExists).toBeFalse;

        let itemPath = path.join("item", "t", "test");
        await store.createItem();
        pathExists = await store.itemExists();
        expect(pathExists).toBeTrue;

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should be able to upload / download a file", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        expect(getFile({ resources, file }).Key).toEqual("s3.js");

        await store.get({ target: file, localPath: path.join("/tmp", file) });
        expect(await pathExists(path.join("/tmp", file))).toBe(true);
        await remove(path.join("/tmp", file));

        await bucket.removeObjects({ prefix: itemPath });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download a file to a subpath (not just the root)", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: `some/path/to/${file}` });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        expect(getFile({ resources, file }).Key).toEqual("some/path/to/s3.js");

        await bucket.removeObjects({ prefix: itemPath });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download json data", async () => {
        const itemPath = path.join("item", "t", "test");
        const file = "data.json";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ json: { data: true }, target: file });
        await store.get({ target: file, localPath: path.join("/tmp", file) });
        let data = await readJSON(path.join("/tmp", file));
        expect(data).toEqual({ data: true });

        await bucket.removeObjects({ prefix: itemPath });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download string content", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "data.txt";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ content: "some text from somewhere", target: file });
        await store.get({ target: file, localPath: path.join("/tmp", file) });
        let data = await readFile(path.join("/tmp", file));
        expect(data.toString()).toEqual("some text from somewhere");

        await bucket.removeObjects({ prefix: itemPath });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to download string content directly", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "data.txt";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ content: "some text from somewhere", target: file });
        let data = await store.get({ target: file });
        expect(data).toEqual("some text from somewhere");

        await bucket.removeObjects({ prefix: itemPath });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to download json content directly", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "data.json";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ json: { data: true }, target: file });
        let data = await store.get({ target: file });
        expect(JSON.parse(data)).toEqual({ data: true });

        await bucket.removeObjects({ prefix: itemPath });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to get a list of files in the item", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        resources.forEach((r) => expect(r.Key).not.toMatch(itemPath));

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should be able to verify a file path exists", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let exists = await store.pathExists({ path: file });
        expect(exists).toBe(true);

        exists = await store.pathExists({ path: "other.json" });
        expect(exists).toBe(false);

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should be able to return file stat", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let stat = await store.stat({ path: file });
        let fstat = await fileStat(path.join(__dirname, file));
        expect(stat.ContentLength).toEqual(fstat.size);

        await bucket.removeObjects({ prefix: itemPath });
    });
    test("it should be able to get a presigned link to a file", async () => {
        const itemPath = path.join("item", "t", "test");
        await bucket.removeObjects({ prefix: itemPath });

        const file = "s3.js";
        const store = new Store({ className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let link = await store.getPresignedUrl({ target: "s3.js" });
        expect(link).toMatch(`${endpoint}/${repository}/item/t/test/s3.js`);

        await bucket.removeObjects({ prefix: itemPath });
        await remove(path.join("/tmp", file));
    });
});

function getFile({ resources, file }) {
    return resources.filter((r) => r.Key.match(file))[0];
}
