import { S3, Bucket } from "./s3.js";
import { Store } from "./store.js";
import { Indexer } from "./indexer.js";
import fsExtra from "fs-extra";
const { pathExists, remove, readJSON, readFile, stat: fileStat } = fsExtra;
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
    const indexer = new Indexer({ credentials });
    const domain = "nyingarn.net";

    afterAll(async () => {});

    test("it should not be able to init a connection to the storage", () => {
        try {
            const store = new Store({});
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'id'`);
        }
    });
    test("it should be able to init a connection to the storage", () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        expect(store.credentials).toEqual(credentials);
    });
    test("it fail to init a connection - missing classname", () => {
        try {
            new Store({ domain, id: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'className'`);
        }
    });
    test("it fail to init a connection - missing id", () => {
        try {
            new Store({ domain, className: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'id'`);
        }
    });
    test("it fail to init a connection - missing credentials", () => {
        try {
            new Store({ domain, className: "test", id: "test" });
        } catch (error) {
            expect(error.message).toEqual(`Missing required property: 'credentials'`);
        }
    });
    test("it should not accept the identifier - disallowed characters", () => {
        try {
            new Store({ domain, className: "test", id: "test&", credentials });
        } catch (error) {
            expect(error.message).toEqual(
                `The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
    });
    test("it should not accept the className - disallowed characters", () => {
        try {
            new Store({ domain, className: "test&", id: "test", credentials });
        } catch (error) {
            expect(error.message).toEqual(
                `The className doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$`
            );
        }
    });
    test("it should be able to get the item path", () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        let itemPath = store.getItemPath();
        expect(itemPath).toEqual("nyingarn.net/item/t/test");
    });
    test("it should be able to get the item identifier", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();
        let identifier = await store.getItemIdentifier();
        expect(identifier.id).toEqual("test");
        expect(identifier.className).toEqual("item");
        expect(identifier.itemPath).toEqual("nyingarn.net/item/t/test");
        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to get the item identifier", async () => {
        await bucket.delete({ prefix: path.join("item", "t", "test") });
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();
        let inventory = await store.getItemInventory();
        expect(inventory.content["ro-crate-metadata.json"]).toBeDefined;
        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to create items with path splay = 2", () => {
        const store = new Store({ domain, className: "item", id: "test", credentials, splay: 2 });
        let itemPath = store.getItemPath();
        expect(itemPath).toEqual("nyingarn.net/item/te/test");
    });
    test("it should be able to create items with path splay = 10", () => {
        const store = new Store({ domain, className: "item", id: "test", credentials, splay: 10 });
        let itemPath = store.getItemPath();
        expect(itemPath).toEqual("nyingarn.net/item/test/test");
    });
    test("it should be able to create a new item", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
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

        // check the index has been patched
        let index = await indexer.getIndex({ domain, className: "item", prefix: "t" });
        expect(index).toEqual([
            { domain: "nyingarn.net", className: "item", id: "test", splay: 1 },
        ]);

        await bucket.delete({ prefix: "nyingarn.net/item/t/test" });
    });
    test("it should fail to create a new item when one already exists", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();
        try {
            await store.createItem();
        } catch (error) {
            expect(error.message).toEqual(`An item with that identifier already exists`);
        }

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should fail trying to overwrite an internal, special file", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
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

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should fail to upload data if the item has not been created yet", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        const file = "s3.js";
        try {
            await store.put({ target: file, localPath: path.join(__dirname, file) });
        } catch (error) {
            expect(error.message).toEqual(`The item doesn't exist`);
        }

        await store.createItem();
        await store.put({ target: file, localPath: path.join(__dirname, file) });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to upload a file in item path with domain", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();
        await store.put({ target: file, localPath: path.join(__dirname, file) });

        let resources = await store.listResources();
        expect(getFile({ resources, file }).Key).toEqual(file);

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should do nothing when target undefined and batch length = 0 in put", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();
        await store.put({});
        await store.put({ batch: [] });

        let resources = await store.listResources();
        expect(resources.length).toEqual(3);

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to see if an item exists or not", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        let pathExists = await store.itemExists();
        expect(pathExists).toBeFalse;

        await store.createItem();
        pathExists = await store.itemExists();
        expect(pathExists).toBeTrue;

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to upload a file and version it", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file, version: true });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);

        await store.put({ localPath: path.join(__dirname, file), target: file, version: true });
        resources = await store.listResources();
        expect(resources.filter((r) => r.Key.match(/^s3/)).length).toEqual(2);
        expect(resources.length).toEqual(5);

        await store.put({ localPath: path.join(__dirname, file), target: file, version: true });

        let versions = await store.listFileVersions({ target: file });
        expect(versions.length).toEqual(3);
        expect(versions[0]).toEqual("nyingarn.net/item/t/test/s3.js");
        expect(versions[1]).toMatch(/.*\/s3.v.*\.js/);
        expect(versions[2]).toMatch(/.*\/s3.v.*\.js/);

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload a file and register it in the crate file", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).toEqual([{ "@id": "s3.js" }]);
        let fileEntry = crate["@graph"].filter((e) => e["@id"] === "s3.js")[0];
        expect(fileEntry.name).toEqual("s3.js");
        expect(fileEntry["@reverse"]).toEqual({ hasPart: [{ "@id": "./" }] });
        // console.log(JSON.stringify(crate["@graph"], null, 2));

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload a file, register it and not overwrite an existing entry", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

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

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload a file and NOT register it in the crate file", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({
            localPath: path.join(__dirname, file),
            target: file,
            registerFile: false,
        });

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart).not.toBeDefined;

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download and register two files simultaneously", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        let batch = [
            { localPath: path.join(__dirname, "s3.js"), target: "s3.js" },
            { localPath: path.join(__dirname, "s3.spec.js"), target: "s3.spec.js" },
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
        expect(rootDataset.hasPart.length).toEqual(2);
        expect(rootDataset.hasPart).toEqual([
            {
                "@id": "s3.js",
            },
            {
                "@id": "s3.spec.js",
            },
        ]);
        let files = crate["@graph"].filter((e) => e["@type"] === "File");
        expect(files.length).toEqual(2);

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download 12 files in chunks of 5", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        let files = ["s3.spec.js", "store.js", "store.spec.js", "index.js"];
        let batch = files.map((f) => ({ localPath: path.join(__dirname, f), target: f }));

        files = [
            "index.d.ts",
            "index.js",
            "package.json",
            "s3.d.ts",
            "s3.js",
            "store.d.ts",
            "store.js",
        ];
        batch = [
            ...batch,
            ...files.map((f) => ({
                localPath: path.join(__dirname, "..", "dist", "cjs", f),
                target: path.join("dist", "cjs", f),
            })),
        ];

        await store.put({ batch });

        let crate = await store.getJSON({ target: "ro-crate-metadata.json" });
        let rootDataset = crate["@graph"].filter((e) => e["@id"] === "./")[0];
        expect(rootDataset.hasPart.length).toEqual(batch.length);

        let resources = await store.listResources();
        expect(resources.length).toEqual(14);

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to upload / download a file to a subpath (not just the root)", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: `some/path/to/${file}` });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        expect(getFile({ resources, file }).Key).toEqual("some/path/to/s3.js");

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download json data", async () => {
        const file = "data.json";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ json: { data: true }, target: file });
        await store.get({ target: file, localPath: path.join("/tmp", file) });
        let data = await readJSON(path.join("/tmp", file));
        expect(data).toEqual({ data: true });

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to upload / download string content", async () => {
        const file = "data.txt";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ content: "some text from somewhere", target: file });
        await store.get({ target: file, localPath: path.join("/tmp", file) });
        let data = await readFile(path.join("/tmp", file));
        expect(data.toString()).toEqual("some text from somewhere");

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to download string content directly", async () => {
        const file = "data.txt";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ content: "some text from somewhere", target: file });
        let data = await store.get({ target: file });
        expect(data).toEqual("some text from somewhere");

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to download json content directly", async () => {
        const file = "data.json";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ json: { data: true }, target: file });
        let data = await store.get({ target: file });
        expect(JSON.parse(data)).toEqual({ data: true });

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to remove a file from an item", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

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

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
    test("it should be able to remove multiple files from an item", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, "s3.js"), target: "s3.js" });
        await store.put({ localPath: path.join(__dirname, "s3.spec.js"), target: "s3.spec.js" });
        await store.put({ localPath: path.join(__dirname, "store.js"), target: "store.js" });
        let resources = await store.listResources();
        expect(resources.length).toEqual(6);

        await store.delete({ target: ["s3.js", "store.js"] });
        resources = await store.listResources();
        expect(resources.length).toEqual(4);

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to remove files by prefix", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

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

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to remove the whole item", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, "s3.js"), target: "s3.js" });
        await store.put({
            localPath: path.join(__dirname, "s3.spec.js"),
            target: "s3.spec.js",
        });
        await store.put({ localPath: path.join(__dirname, "store.js"), target: "store.js" });
        let resources = await store.listResources();
        expect(resources.length).toEqual(6);

        await store.deleteItem({ prefix: store.getItemPath() });
        let exists = await store.itemExists();
        expect(exists).toBe(false);
    });
    test("it should be able to remove the whole item and not any others", async () => {
        // delete item 1 and check item 2 is ok
        //   item1 = test, item2 = test2
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();
        let resources = await store.listResources();
        expect(resources.length).toEqual(3);

        const store2 = new Store({ domain, className: "item", id: "test2", credentials });
        await store2.createItem();
        let resources2 = await store2.listResources();
        expect(resources2.length).toEqual(3);

        let index = await indexer.getIndex({ domain, className: "item", prefix: "t" });
        expect(index).toEqual([
            { domain: "nyingarn.net", className: "item", id: "test", splay: 1 },
            { domain: "nyingarn.net", className: "item", id: "test2", splay: 1 },
        ]);
        await store.deleteItem();
        let exists = await store.itemExists();
        expect(exists).toBe(false);

        resources2 = await store2.listResources();
        expect(resources2.length).toEqual(3);

        // check the index has been patched
        index = await indexer.getIndex({ domain, className: "item", prefix: "t" });
        expect(index).toEqual([
            { domain: "nyingarn.net", className: "item", id: "test2", splay: 1 },
        ]);

        store2.deleteItem();
        exists = await store.itemExists();
        expect(exists).toBe(false);

        await bucket.delete({ prefix: store.getItemPath() });
        await bucket.delete({ prefix: store2.getItemPath() });
    });
    test("it should fail with wrong argument type", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

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

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should fail with wrong argument type", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

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

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should fail to delete special files", async () => {
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        try {
            await store.delete({ target: "nocfl.inventory.json" });
        } catch (error) {
            expect(error.message).toEqual(
                `You can't delete a file called 'nocfl.inventory.json as that's a special file used by the system`
            );
        }
        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to get a list of files in the item", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });
        let resources = await store.listResources();
        expect(resources.length).toEqual(4);
        resources.forEach((r) => expect(r.Key).not.toMatch(store.getItemPath()));

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to verify a file path exists", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let exists = await store.pathExists({ path: file });
        expect(exists).toBe(true);

        exists = await store.pathExists({ path: "other.json" });
        expect(exists).toBe(false);

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to return file stat", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let stat = await store.stat({ path: file });
        let fstat = await fileStat(path.join(__dirname, file));
        expect(stat.ContentLength).toEqual(fstat.size);

        await bucket.delete({ prefix: store.getItemPath() });
    });
    test("it should be able to get a presigned link to a file", async () => {
        const file = "s3.js";
        const store = new Store({ domain, className: "item", id: "test", credentials });
        await store.createItem();

        await store.put({ localPath: path.join(__dirname, file), target: file });

        let link = await store.getPresignedUrl({ target: "s3.js" });
        expect(link).toMatch(`${endpoint}/${repository}/nyingarn.net/item/t/test/s3.js`);

        await bucket.delete({ prefix: store.getItemPath() });
        await remove(path.join("/tmp", file));
    });
});

function getFile({ resources, file }) {
    return resources.filter((r) => r.Key.match(file))[0];
}
