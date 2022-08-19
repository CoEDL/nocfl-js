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

describe(`Test creating index files - 1 domain`, () => {
    const domain = chance.domain();
    beforeAll(async () => {
        await setupTestData({
            domain,
            credentials,
            count: 3,
        });
    });
    afterAll(async () => {
        await bucket.removeObjects({ prefix: domain });
    });
    it("Should find all items in the repository and create index files to them", async () => {
        const indexer = new Indexer({ credentials });
        let indexFiles = await indexer.createIndices({ domain });
        for (let file of indexFiles) {
            expect(await bucket.pathExists({ path: file })).toBe(true);
        }
    });
});

describe(`Test creating index files - 3 domains`, () => {
    const domains = [chance.domain(), chance.domain(), chance.domain()];
    beforeAll(async () => {
        for (let domain of domains) {
            await setupTestData({
                domain,
                credentials,
                count: 3,
            });
        }
    });
    afterAll(async () => {
        for (let domain of domains) {
            await bucket.removeObjects({ prefix: domain });
        }
    });
    it("Should find all items in the repository and create index files to them", async () => {
        const indexer = new Indexer({ credentials });
        let indexFiles = await indexer.createIndices({});
        let domains = uniq(indexFiles.map((file) => file.split("/").shift()));
        expect(domains.length).toEqual(3);

        indexFiles = await indexer.createIndices({ domain: domains[1] });
        domains = uniq(indexFiles.map((file) => file.split("/").shift()));
        expect(domains.length).toEqual(1);
    });
});

async function setupTestData({ domain, credentials, count = 3 }) {
    for (let type of ["collection", "item"]) {
        for (let i in range(count)) {
            const store = new Store({
                domain,
                className: type,
                id: chance.word(),
                credentials,
            });
            await store.createItem();
        }
    }
}
