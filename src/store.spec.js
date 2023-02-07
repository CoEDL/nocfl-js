import { S3, Bucket } from "./s3.js";
import { Store } from "./store.js";
import { Indexer } from "./indexer.js";
import fsExtra from "fs-extra";
const { pathExists, remove, readJSON, readFile, stat: fileStat } = fsExtra;
import path from "path";
import Chance from "chance";
const chance = new Chance();

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
    const indexer = new Indexer({ credentials });
    const prefix = chance.domain();

    beforeAll(async () => {
        await bucket.delete({ prefix });
    });
    afterAll(async () => {
        await bucket.delete({ prefix });
    });

    test("it should not be able to init a connection to the storage", () => {
        try {
            const store = new Store({});
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'id'`);
        }
    });
    test("it should be able to init a connection to the storage - v1 signature", () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        expect(store.credentials).toEqual(credentials);
    });
    test("it should be able to init a connection to the storage - v2 signature", () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        expect(store.credentials).toEqual(credentials);
    });
    test("it fail to init a connection - missing type", () => {
        try {
            new Store({ prefix, id: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'type'`);
        }
    });
    test("it fail to init a connection - missing id", () => {
        try {
            new Store({ prefix, type: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'id'`);
        }
    });
    test("it fail to init a connection - missing credentials", () => {
        try {
            new Store({ prefix, type: "test", id: "test" });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'credentials'`);
        }
    });
    test("it should not accept the identifier - disallowed characters", () => {
        try {
            new Store({ prefix, type: "test", id: "test&", credentials });
        } catch (error) {
            expect(error.message).toEqual(
                `The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
    });
    test("it should not accept the className - disallowed characters", () => {
        try {
            new Store({ prefix, type: "test&", id: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(
                `The className doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
    });
    test("it should be able to get the item path", () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        let itemPath = store.getObjectPath();
        expect(itemPath).toEqual(`${prefix}/item/t/test`);
    });
    test("it should be able to get the item identifier", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();
        let identifier = await store.getObjectIdentifier();
        expect(identifier.id).toEqual("test");
        expect(identifier.type).toEqual("item");
        expect(identifier.objectPath).toEqual(`${prefix}/item/t/test`);
        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to get the item inventory", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();
        let inventory = await store.getObjectInventory();
        expect(inventory.content["ro-crate-metadata.json"]).toBeDefined;
        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to create items with path splay = 2", () => {
        const store = new Store({
            prefix,
            type: "item",
            id: "test",
            credentials,
            splay: 2,
        });
        let itemPath = store.getObjectPath();
        expect(itemPath).toEqual(`${prefix}/item/te/test`);
    });
    test("it should be able to create items with path splay = 10", () => {
        const store = new Store({
            prefix,
            type: "item",
            id: "test",
            credentials,
            splay: 10,
        });
        let itemPath = store.getObjectPath();
        expect(itemPath).toEqual(`${prefix}/item/test/test`);
    });
    test("it should be able to create a new item", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();
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

        // check the index has been patched
        let index = await indexer.getIndex({ prefix: prefix, type: "item", file: "t.json" });
        expect(index).toEqual([{ prefix: prefix, type: "item", id: "test", splay: 1 }]);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should fail to create a new item when one already exists", async () => {
        const store = new Store({ prefix: prefix, type: "item", id: "test", credentials });
        await store.createObject();
        try {
            await store.createObject();
        } catch (error) {
            expect(error.message).toEqual(`An item with that identifier already exists`);
        }

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should fail trying to overwrite an internal, special file", async () => {
        const store = new Store({ prefix: prefix, type: "item", id: "test", credentials });
        await store.createObject();
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

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should fail to upload data if the item has not been created yet", async () => {
        const store = new Store({ prefix: prefix, type: "item", id: "test", credentials });
        const file = "s3.js";
        try {
            await store.put({ target: file, localPath: path.join(__dirname, file) });
        } catch (error) {
            expect(error.message).toEqual(`The item doesn't exist`);
        }

        await store.createObject();
        await store.put({ target: file, localPath: path.join(__dirname, file) });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to upload a file in item path with prefix", async () => {
        const file = "s3.js";
        const store = new Store({ prefix: prefix, type: "item", id: "test", credentials });
        await store.createObject();
        await store.put({
            target: file,
            localPath: path.join(__dirname, file),
            mimetype: "application/nothing",
        });

        let resources = await store.listResources();
        expect(getFile({ resources, file }).Key).toEqual(file);

        resources = resources.map((resource) => store.resolvePath({ path: resource.Key }));
        expect(resources).toEqual([
            `${prefix}/item/t/test/nocfl.identifier.json`,
            `${prefix}/item/t/test/nocfl.inventory.json`,
            `${prefix}/item/t/test/ro-crate-metadata.json`,
            `${prefix}/item/t/test/s3.js`,
        ]);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to upload a file and determine / set the mimetype", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        // figure out the mimetype
        await store.put({
            target: file,
            localPath: path.join(__dirname, file),
        });
        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let entity = crate["@graph"].filter((e) => e["@id"] === "s3.js")[0];
        expect(entity.encodingFormat).toEqual("application/javascript");
        await store.delete({ target: "s3.js" });

        // set the mimetype
        await store.put({
            target: file,
            localPath: path.join(__dirname, file),
            mimetype: "application/nothing",
        });
        crate = await store.getJSON({
            target: "ro-crate-metadata.json",
        });
        entity = crate["@graph"].filter((e) => e["@id"] === "s3.js")[0];
        expect(entity.encodingFormat).toEqual("application/nothing");

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should do nothing when target undefined and batch length = 0 in put method", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();
        await store.put({});
        await store.put({ batch: [] });

        let resources = await store.listResources();
        expect(resources.length).toEqual(3);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to see if an item exists or not", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        let pathExists = await store.exists();
        expect(pathExists).toBeFalse;

        await store.createObject();
        pathExists = await store.exists();
        expect(pathExists).toBeTrue;

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to upload a file and version it", async () => {
        const file = "file.json";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ json: { version: 1 }, target: file, version: true });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);

        await store.put({ json: { version: 2 }, target: file, version: true });
        resources = await store.listResources();
        expect(resources.filter((r) => r.Key.match(/^file.*/)).length).toEqual(2);
        expect(resources.length).toEqual(5);

        await store.put({ json: { version: 1 }, target: file, version: true });
        resources = await store.listResources();

        let versions = await store.listFileVersions({ target: file });
        expect(versions.length).toEqual(3);
        expect(versions[0]).toEqual(`file.json`);
        expect(versions[1]).toMatch(/file\.v.*\.json/);
        expect(versions[2]).toMatch(/file\.v.*\.json/);

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        expect(crate["@graph"].length).toEqual(5);
        expect(crate["@graph"].filter((e) => e["@type"] === "File").length).toEqual(3);

        let inventory = await store.getObjectInventory();
        expect(Object.keys(inventory.content).length).toEqual(4);

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload a file and register it in the crate file", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).toEqual([{ "@id": "s3.js" }]);
        let fileEntry = crate["@graph"].filter((e) => e["@id"] === "s3.js")[0];
        expect(fileEntry.name).toEqual("s3.js");
        expect(fileEntry["@reverse"]).toEqual({ hasPart: [{ "@id": "./" }] });
        // console.log(JSON.stringify(crate["@graph"], null, 2));

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload an ro crate metadata file and never register it in the crate file (or any version of it)", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        await store.put({
            json: crate,
            target: "ro-crate-metadata.json",
            registerFile: true,
        });

        crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).toEqual(undefined);

        await store.put({
            json: crate,
            target: `ro-crate-metadata.${new Date().toISOString()}.json`,
            registerFile: true,
        });
        crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).toEqual(undefined);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to upload a file, register it and not overwrite an existing entry", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        // add a file
        await store.put({ localPath: path.join(__dirname, file), target: file });

        // check that it's registered in the crate file
        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).toEqual([{ "@id": "s3.js" }]);
        let fileEntry = crate["@graph"].filter((e) => e["@id"] === "s3.js")[0];
        expect(fileEntry.contentSize).not.toHaveProperty("test");

        // add a property to its entry in the crate file
        crate["@graph"] = crate["@graph"].map((e) => {
            if (e["@id"] === "s3.js")
                return {
                    ...e,
                    test: true,
                };
            return e;
        });
        await store.put({ target: "ro-crate-metadata.json", json: crate });

        //  add it again
        await store.put({ localPath: path.join(__dirname, file), target: file });

        // check that the existing entry in the crate file was not overwritten
        crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).toEqual([{ "@id": "s3.js" }]);

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload a file and NOT register it in the crate file", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({
            localPath: path.join(__dirname, file),
            target: file,
            registerFile: false,
        });

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).not.toBeDefined;

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download and register two files simultaneously", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        let batch = [
            { localPath: path.join(__dirname, "s3.js"), target: "s3.js" },
            { json: { some: "thing" }, target: "something.json" },
        ];

        await store.put({ batch });
        let resources = await store.listResources();
        expect(resources.map((r) => r.Key).sort()).toEqual([
            "nocfl.identifier.json",
            "nocfl.inventory.json",
            "ro-crate-metadata.json",
            "s3.js",
            "something.json",
        ]);
        expect(resources.length).toEqual(5);

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart.length).toEqual(2);
        expect(rootDataset.hasPart).toEqual([
            {
                "@id": "s3.js",
            },
            {
                "@id": "something.json",
            },
        ]);
        let files = crate["@graph"].filter((e) => e["@type"] === "File");
        expect(files.length).toEqual(2);

        expect(files.map((f) => f.encodingFormat)).toEqual([
            "application/javascript",
            "application/json",
        ]);

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download two files simultaneously - register one only", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        let batch = [
            { localPath: path.join(__dirname, "s3.js"), target: "s3.js" },
            {
                localPath: path.join(__dirname, "s3.spec.js"),
                target: "s3.spec.js",
                registerFile: false,
            },
        ];

        await store.put({ batch });
        let resources = await store.listResources();
        expect(resources.map((r) => r.Key).sort()).toEqual([
            "nocfl.identifier.json",
            "nocfl.inventory.json",
            "ro-crate-metadata.json",
            "s3.js",
            "s3.spec.js",
        ]);
        expect(resources.length).toEqual(5);

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart.length).toEqual(1);
        expect(rootDataset.hasPart).toEqual([
            {
                "@id": "s3.js",
            },
        ]);
        let files = crate["@graph"].filter((e) => e["@type"] === "File");
        expect(files.length).toEqual(1);

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download 9 files in chunks of 5", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();
        const events = [];
        store.on("put", (msg) => events.push(msg));

        let files = ["s3.spec.js", "store.js", "store.spec.js", "index.js"];
        let batch = files.map((f) => ({ localPath: path.join(__dirname, f), target: f }));

        files = ["index.cjs", "index.mjs"];
        batch = [
            ...batch,
            ...files.map((f) => ({
                localPath: path.join(__dirname, "..", "dist", f),
                target: path.join("dist", f),
            })),
        ];

        await store.put({ batch });

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart.length).toEqual(batch.length);

        let resources = await store.listResources();
        expect(resources.length).toEqual(9);

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(events.length).toEqual(2);
        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to upload / download a file to a subpath (not just the root)", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, file), target: `some/path/to/${file}` });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        expect(getFile({ resources, file }).Key).toEqual("some/path/to/s3.js");

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download json data", async () => {
        const file = "data.json";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ json: { data: true }, target: file });
        await store.get({ target: file, localPath: path.join("/tmp", file) });
        let data = await readJSON(path.join("/tmp", file));
        expect(data).toEqual({ data: true });

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download string content", async () => {
        const file = "data.txt";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ content: "some text from somewhere", target: file });
        await store.get({ target: file, localPath: path.join("/tmp", file) });
        let data = await readFile(path.join("/tmp", file));
        expect(data.toString()).toEqual("some text from somewhere");

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to download string content directly", async () => {
        const file = "data.txt";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ content: "some text from somewhere", target: file });
        let data = await store.get({ target: file });
        expect(data).toEqual("some text from somewhere");

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to download json content directly", async () => {
        const file = "data.json";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ json: { data: true }, target: file });
        let data = await store.get({ target: file });
        expect(JSON.parse(data)).toEqual({ data: true });

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to remove a file from an item", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, file), target: file });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        expect(getFile({ resources, file }).Key).toEqual("s3.js");

        await store.delete({ target: file });
        resources = await store.listResources();
        expect(resources.length).toEqual(3);
        expect(getFile({ resources, file })).toBe(undefined);

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        expect(crate["@graph"][1].hasPart.length).toEqual(0);

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to remove multiple files from an item", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, "s3.js"), target: "s3.js" });
        await store.put({ localPath: path.join(__dirname, "s3.spec.js"), target: "s3.spec.js" });
        await store.put({ localPath: path.join(__dirname, "store.js"), target: "store.js" });
        let resources = await store.listResources();
        expect(resources.length).toEqual(6);

        await store.delete({ target: ["s3.js", "store.js"] });
        resources = await store.listResources();
        expect(resources.length).toEqual(4);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to remove files by prefix", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, "s3.js"), target: "s3.js" });
        await store.put({ localPath: path.join(__dirname, "s3.spec.js"), target: "s3.spec.js" });
        await store.put({ localPath: path.join(__dirname, "store.js"), target: "store.js" });
        let resources = await store.listResources();
        expect(resources.length).toEqual(6);

        await store.delete({ prefix: "s3" });
        resources = await store.listResources();
        expect(resources.length).toEqual(4);

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        expect(crate["@graph"][1].hasPart.length).toEqual(1);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to remove the whole item", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, "s3.js"), target: "s3.js" });
        await store.put({
            localPath: path.join(__dirname, "s3.spec.js"),
            target: "s3.spec.js",
        });
        await store.put({ localPath: path.join(__dirname, "store.js"), target: "store.js" });
        let resources = await store.listResources();
        expect(resources.length).toEqual(6);

        await store.removeObject({ prefix: store.getObjectPath() });
        let exists = await store.exists();
        expect(exists).toBe(false);
    });
    test("it should be able to remove the whole item and not any others", async () => {
        // delete item 1 and check item 2 is ok
        //   item1 = test, item2 = test2
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();
        let resources = await store.listResources();
        expect(resources.length).toEqual(3);

        const store2 = new Store({ prefix, type: "item", id: "test2", credentials });
        await store2.createObject();
        let resources2 = await store2.listResources();
        expect(resources2.length).toEqual(3);

        let index = await indexer.getIndex({ prefix, type: "item", file: "t.json" });
        expect(index).toEqual([
            { prefix, type: "item", id: "test", splay: 1 },
            { prefix, type: "item", id: "test2", splay: 1 },
        ]);
        await store.removeObject();
        let exists = await store.exists();
        expect(exists).toBe(false);

        resources2 = await store2.listResources();
        expect(resources2.length).toEqual(3);

        // check the index has been patched
        index = await indexer.getIndex({ prefix, type: "item", file: "t.json" });
        expect(index).toEqual([{ prefix, type: "item", id: "test2", splay: 1 }]);

        store2.removeObject();
        exists = await store.exists();
        expect(exists).toBe(false);

        await bucket.delete({ prefix: store.getObjectPath() });
        await bucket.delete({ prefix: store2.getObjectPath() });
    });
    test("it should fail with wrong argument type", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        try {
            await store.delete({ prefix: ["s3"] });
        } catch (error) {
            expect(error.message).toBe("prefix must be a string");
        }
        try {
            await store.delete({ target: {} });
        } catch (error) {
            expect(error.message).toBe("target must be a string or array of strings");
        }

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should refuse to delete special files", async () => {
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        try {
            await store.delete({ target: "nocfl.inventory.json" });
        } catch (error) {
            expect(error.message).toEqual(
                `You can't delete a file called 'nocfl.inventory.json as that's a special file used by the system`
            );
        }
        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to get a list of files in the item", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, file), target: file });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        resources.forEach((r) => expect(r.Key).not.toMatch(store.getObjectPath()));

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to verify a file path exists", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let exists = await store.fileExists({ path: file });
        expect(exists).toBe(true);

        exists = await store.fileExists({ path: "other.json" });
        expect(exists).toBe(false);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to return file stat", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let stat = await store.stat({ path: file });
        let fstat = await fileStat(path.join(__dirname, file));
        expect(stat.ContentLength).toEqual(fstat.size);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to get a presigned link to a file", async () => {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });
        await store.createObject();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let link = await store.getPresignedUrl({ target: "s3.js" });
        expect(link).toMatch(`${endpoint}/${repository}/${prefix}/item/t/test/s3.js`);

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able stream a file and calculate its checksum", async function () {
        const file = "s3.js";
        const store = new Store({ prefix, type: "item", id: "test", credentials });

        await store.createObject();
        await store.put({ localPath: path.join(__dirname, file), target: file });

        console.time();
        let hash = await store.hashTarget({ target: file });
        expect(hash).toEqual(
            "60d4813bcf348ac4f591cd45f8038cb9274d89449083b3e596e1938372981ec3da5962ddc00e9fbfc222dd153d1fa944bebacd3365afeb1a4563cfbf45468de1"
        );

        await bucket.delete({ prefix: store.getObjectPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to copy a file from another location in the bucket and not version it", async () => {
        const file = "file.json";
        const source = new Store({
            prefix: `${prefix}/workspace`,
            type: "item",
            id: "test",
            credentials,
        });
        await source.createObject();

        const target = new Store({
            prefix: `${prefix}/repository`,
            type: "item",
            id: "test",
            credentials,
        });
        await target.createObject();
        const events = [];
        target.on("copy", (msg) => events.push(msg));

        // put a file into the source
        await source.put({ json: { version: 1 }, target: file });

        // copy it into the target
        const filePath = source.resolvePath({ path: file });
        await target.copy({ source: filePath, target: "file.json" });

        // check that the inventory is correct
        let sourceInventory = await source.getObjectInventory();
        let targetInventory = await target.getObjectInventory();
        expect(sourceInventory.content[file]).toEqual(targetInventory.content[file]);

        // copy again and check the inventory hasn't changed
        await target.copy({ source: filePath, target: "file.json", version: true });
        let inventory = await target.getObjectInventory();
        expect(inventory.content[file]).toEqual(targetInventory.content[file]);

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(events.length).toEqual(2);
        await bucket.delete({ prefix: source.getObjectPath() });
        await bucket.delete({ prefix: target.getObjectPath() });
    });
    test("it should be able to copy a file from another location in the bucket and version it", async () => {
        const file = "file.json";
        const source = new Store({
            prefix: `${prefix}/workspace`,
            type: "item",
            id: "test",
            credentials,
        });
        await source.createObject();

        const target = new Store({
            prefix: `${prefix}/repository`,
            type: "item",
            id: "test",
            credentials,
        });
        await target.createObject();

        // put a file into the source
        await source.put({ json: { version: 1 }, target: file });

        // copy it to the target
        const filePath = source.resolvePath({ path: file });
        await target.copy({ source: filePath, target: "file.json" });

        let sourceInventory = await source.getObjectInventory();
        let targetInventory = await target.getObjectInventory();
        expect(sourceInventory.content[file]).toEqual(targetInventory.content[file]);
        expect(Object.keys(targetInventory.content).length).toEqual(2);

        // change the source file but don't version it
        await source.put({ json: { version: 2 }, target: file });

        // copy it to the target
        await target.copy({ source: filePath, target: "file.json", version: true });

        sourceInventory = await source.getObjectInventory();
        targetInventory = await target.getObjectInventory();
        expect(sourceInventory.content[file]).toEqual(targetInventory.content[file]);
        expect(Object.keys(targetInventory.content).length).toEqual(3);

        await bucket.delete({ prefix: source.getObjectPath() });
        await bucket.delete({ prefix: target.getObjectPath() });
    });
    test("it should be able to automatically register all files in the crate metadata file", async () => {
        const store = new Store({
            prefix: `${prefix}/workspace`,
            type: "item",
            id: "test",
            credentials,
        });
        await store.createObject();

        // put a file into the source
        await store.put({ json: { version: 1 }, target: "file1.json" });
        await store.put({ json: { version: 1 }, target: "file2.json" });
        await store.registerFilesInCrateMetadata({});

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        expect(crate["@graph"].length).toEqual(4);
        expect(crate["@graph"].filter((e) => e["@type"] === "File").length).toEqual(2);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
    test("it should be able to verify the files in an object", async () => {
        const store = new Store({
            prefix: `${prefix}/workspace`,
            type: "item",
            id: "test",
            credentials,
        });
        await store.createObject();

        // put a file into the source
        await store.put({ json: { version: 1 }, target: "file1.json" });
        await store.put({
            batch: [
                { json: { version: 2 }, target: "file1.json", version: true },
                { json: { version: 1 }, target: "file2.json" },
            ],
        });
        await store.registerFilesInCrateMetadata({});

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let inventory = await store.getObjectInventory();
        // console.log(crate);
        // console.log(inventory);

        await bucket.delete({ prefix: store.getObjectPath() });
    });
});

function getFile({ resources, file }) {
    return resources.filter((r) => r.Key.match(file))[0];
}
