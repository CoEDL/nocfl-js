import { Bucket } from "./s3.js";
import { Indexer } from "./indexer.js";
import { Store } from "./store.js";
import { range, uniq } from "lodash";
import Chance from "chance";
const chance = new Chance();

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

describe(`Test managing index files - 1 domain`, () => {
    const domain = chance.domain();
    beforeEach(async () => {
        await setupTestData({
            prefix: domain,
            credentials,
            count: 1,
        });
    });
    afterEach(async () => {
        await bucket.delete({ prefix: domain });
    });
    it("Should find all items in the repository and create index files to them", async () => {
        const indexer = new Indexer({ credentials });
        let indexFiles = await indexer.createIndices({ prefix: domain });
        for (let file of indexFiles) {
            expect(await bucket.pathExists({ path: file })).toBe(true);
        }
    });
    it(`should be able to PUT a reference into an index file - index file doesn't exist yet`, async () => {
        const prefix = domain;
        const indexer = new Indexer({ credentials });
        const id = chance.word();
        const type = "collection";
        await indexer.patchIndex({
            action: "PUT",
            prefix,
            type,
            id,
        });

        let indexFileName = `${prefix}/indices/${type}/${id.slice(0, 1).toLowerCase()}.json`;
        let indexFile = await bucket.readJSON({ target: indexFileName });
        expect(indexFile.length).toEqual(1);
        expect(indexFile[0].id).toEqual(id);
        expect(indexFile[0].type).toEqual(type);
    });
    it(`should be able to PUT a reference into an index file - index file exists`, async () => {
        const indexer = new Indexer({ credentials });
        const prefix = domain;

        const store = new Store({
            prefix,
            type: "collection",
            id: "identifier1",
            credentials,
        });
        await store.createObject();
        await indexer.createIndices({});

        let indexFileName = `${prefix}/indices/collection/i.json`;
        let indexFileBefore = await bucket.readJSON({ target: indexFileName });
        expect(indexFileBefore.length).toBeGreaterThanOrEqual(1);

        await indexer.patchIndex({
            action: "PUT",
            prefix,
            type: "collection",
            id: "identifier2",
        });

        indexFileName = `${prefix}/indices/collection/i.json`;
        let indexFileAfter = await bucket.readJSON({ target: indexFileName });
        expect(indexFileAfter.length).toBeGreaterThanOrEqual(2);
    });
    it(`should be able to DELETE a reference from an index file - index file exists`, async () => {
        const indexer = new Indexer({ credentials });
        const prefix = domain;

        const store = new Store({
            prefix: domain,
            type: "collection",
            id: "identifier1",
            credentials,
        });
        await store.createObject();
        await indexer.createIndices({});

        let indexFileName = `${prefix}/indices/collection/i.json`;
        let indexFileBefore = await bucket.readJSON({ target: indexFileName });
        expect(indexFileBefore.length).toBeGreaterThanOrEqual(1);

        await indexer.patchIndex({
            action: "DELETE",
            prefix,
            type: "collection",
            id: "identifier1",
        });

        indexFileName = `${prefix}/indices/collection/i.json`;
        let indexFileAfter = await bucket.readJSON({ target: indexFileName });
        expect(indexFileAfter.length).toEqual(indexFileBefore.length - 1);
    });
    it(`should be able to retrieve a specified index file`, async () => {
        const indexer = new Indexer({ credentials });
        const prefix = domain;

        const store = new Store({
            prefix,
            type: "collection",
            id: "identifier1",
            credentials,
        });
        await store.createObject();
        await indexer.createIndices({});

        let indexFile = await indexer.getIndex({ prefix, type: "collection", file: "i.json" });
        expect(indexFile.length).toBeGreaterThanOrEqual(1);
    });
    it(`should be able to list all domain indexes`, async () => {
        const indexer = new Indexer({ credentials });
        let indexFiles = await indexer.createIndices({});

        let indexFilesList = await indexer.listIndices({
            prefix: domain,
        });
        expect(indexFilesList.length).toEqual(indexFiles.length);

        indexFilesList = await indexer.listIndices({
            prefix: domain,
            type: "collection",
        });
        expect(indexFilesList.length).toEqual(
            indexFiles.filter((i) => i.match("collection")).length
        );
    });
});

async function setupTestData({ prefix, credentials, count = 3 }) {
    for (let type of ["collection", "item"]) {
        for (let i in range(count)) {
            const id = chance.word();
            const store = new Store({
                prefix,
                type,
                id,
                credentials,
            });
            await store.createObject();
        }
    }
}
