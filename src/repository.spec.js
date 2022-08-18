import { Bucket } from "./s3.js";
import { Repository } from "./repository.js";
import { Store } from "./store.js";
import { range } from "lodash";
import Chance from "chance";
const chance = new Chance();

describe(`Test walking the repository - one domain`, () => {
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
    const domain = chance.domain();
    beforeAll(async () => {
        await setupTestData({
            domain,
            credentials,
        });
    });
    afterAll(async () => {
        await bucket.removeObjects({ prefix: domain });
    });
    it("Should find all items in the repository", async () => {
        const repository = new Repository({ credentials });
        let objects = [];
        repository.on("object", (object) => objects.push(object));
        await repository.walk({});
        expect(objects.length).toEqual(6);
    });

    it("Should find all items in the repository in the specified domain", async () => {
        const repository = new Repository({ credentials });
        let objects = [];
        repository.on("object", (object) => objects.push(object));
        await repository.walk({ domain });
        expect(objects.length).toEqual(6);
    });
});

describe(`Test walking the repository - 3 domains`, () => {
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
    const domains = [chance.domain(), chance.domain(), chance.domain()];
    beforeAll(async () => {
        for (let domain of domains) {
            await setupTestData({
                domain,
                credentials,
            });
        }
    });
    afterAll(async () => {
        for (let domain of domains) {
            await bucket.removeObjects({ prefix: domain });
        }
    });
    it("Should find all items in the repository", async () => {
        const repository = new Repository({ credentials });
        let objects = [];
        repository.on("object", (object) => objects.push(object));
        await repository.walk({});
        expect(objects.length).toEqual(18);
    });

    it("Should find all items in the repository in the specified domain", async () => {
        const repository = new Repository({ credentials });
        let objects = [];
        repository.on("object", (object) => objects.push(object));
        await repository.walk({ domain: domains[0] });
        expect(objects.length).toEqual(6);

        objects = [];
        await repository.walk({ domain: domains[1] });
        expect(objects.length).toEqual(6);

        objects = [];
        await repository.walk({ domain: domains[2] });
        expect(objects.length).toEqual(6);
    });
});

async function setupTestData({ domain, credentials }) {
    for (let type of ["collection", "item"]) {
        for (let i in range(3)) {
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
