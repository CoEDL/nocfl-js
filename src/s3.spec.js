import { S3, Bucket } from "./s3.js";
import fsExtra from "fs-extra";
const { remove, readFile } = fsExtra;
import path from "path";
import hasha from "hasha";

describe("Test S3 actions", () => {
    let s3client, bucket;
    beforeAll(() => {
        s3client = new S3({
            accessKeyId: "root",
            secretAccessKey: "rootpass",
            endpoint: "http://localhost:10000",
            forcePathStyle: true,
            region: "us-west-1",
        });

        bucket = new Bucket({
            bucket: "repository",
            accessKeyId: "root",
            secretAccessKey: "rootpass",
            endpoint: "http://localhost:10000",
            forcePathStyle: true,
            region: "us-west-1",
        });
    });
    afterAll(async () => {
        await remove(path.join(__dirname, "..", "s3-testing"));
    });
    test("it should be able to list all of a users' buckets in S3", async () => {
        let data = await s3client.listBuckets();
        expect(data.buckets.length).toEqual(1);
    });
    test("it should confirm that a given bucket exists", async () => {
        let response = await s3client.bucketExists({
            bucket: "repository",
        });
        expect(response).toEqual(true);
    });
    test("it should fail to find a given bucket", async () => {
        try {
            let data = await s3client.bucketExists({
                bucket: "bucket",
            });
        } catch (error) {
            expect(error.name).toBe("NotFound");
        }
    });
    test("it should be able to upload a file to the bucket root and then remove it", async () => {
        let data = await bucket.upload({
            localPath: path.join(__dirname, "./s3.js"),
            target: "s3.js",
        });
        expect(data.httpStatusCode).toEqual(200);
        data = (await bucket.listObjects({})).Contents;
        expect(data.length).toBe(2);

        data = await bucket.removeObjects({
            keys: ["s3.js"],
        });
        expect(data.httpStatusCode).toEqual(200);
    });
    test("it should be able to write a string to a bucket object", async () => {
        let response = await bucket.upload({
            target: "file.txt",
            content: "some text",
        });
        expect(response.httpStatusCode).toEqual(200);

        response = await bucket.download({
            target: "file.txt",
            localPath: path.join("/tmp", "s3-testing"),
        });
        let content = await readFile(path.join("/tmp", "s3-testing"));
        expect(content.toString()).toEqual("some text");

        response = await bucket.removeObjects({
            keys: ["file.txt"],
        });
        expect(response.httpStatusCode).toEqual(200);
        await remove(path.join("/tmp", "s3-testing"));
    });
    test("it should be able to write json to a bucket object", async () => {
        let response = await bucket.upload({
            target: "file.txt",
            json: { property: "value" },
        });
        expect(response.httpStatusCode).toEqual(200);

        response = await bucket.download({
            target: "file.txt",
            localPath: path.join("/tmp", "s3-testing"),
        });
        let content = await readFile(path.join("/tmp", "s3-testing"));
        expect(JSON.parse(content.toString())).toEqual({ property: "value" });

        response = await bucket.removeObjects({
            keys: ["file.txt"],
        });
        expect(response.httpStatusCode).toEqual(200);
        await remove(path.join("/tmp", "s3-testing"));
    });
    test("it should be able to upload a file to a bucket (pseudo) folder and then remove it", async () => {
        let data = await bucket.upload({
            localPath: path.join(__dirname, "./s3.js"),
            target: "folder/s3.js",
        });
        expect(data.httpStatusCode).toEqual(200);
        data = (
            await bucket.listObjects({
                path: "folder/s3.js",
            })
        ).Contents;
        expect(data[0].Key).toBe("folder/s3.js");

        data = await bucket.removeObjects({
            keys: ["folder/s3.js"],
        });
    });
    test("it should be able to download an object from the bucket root", async () => {
        // test downloading an object at the bucket root
        let response = await bucket.upload({
            localPath: path.join(__dirname, "./s3.js"),
            target: "s3.js",
        });
        expect(response.httpStatusCode).toEqual(200);

        response = await bucket.download({
            target: "s3.js",
            localPath: path.join("/tmp", "s3-testing"),
        });
        expect(response.httpStatusCode).toEqual(200);

        const originalHash = await hasha.fromFile(path.join(__dirname, "./s3.js"), {
            algorithm: "md5",
        });

        const newHash = await hasha.fromFile(path.join("/tmp", "s3-testing"), {
            algorithm: "md5",
        });
        expect(originalHash).toEqual(newHash);
        response = await bucket.removeObjects({
            keys: ["s3.js"],
        });
        expect(response.httpStatusCode).toEqual(200);
        await remove(path.join("/tmp", "s3-testing"));
    });
    test("it should be able to download an object from the bucket root and return the data", async () => {
        // test downloading an object at the bucket root
        let data = await bucket.upload({
            localPath: path.join(__dirname, "./s3.js"),
            target: "s3.js",
        });
        expect(data.httpStatusCode).toEqual(200);

        data = await bucket.download({
            target: "s3.js",
        });
        expect(data).toBeTruthy;
    });
    test("it should be able to download a json file and return the data", async () => {
        // test downloading an object at the bucket root
        let data = await bucket.upload({
            json: { property: "value" },
            target: "s3.js",
        });
        expect(data.httpStatusCode).toEqual(200);

        data = await bucket.readJSON({
            target: "s3.js",
        });
        expect(data).toEqual({ property: "value" });
    });
    test("it should be able to download an object from some nested path and maintain that path locally", async () => {
        //  test downloading an object at a path - ensure we keep the path locally
        let data = await bucket.upload({
            localPath: path.join(__dirname, "./s3.js"),
            target: "a/b/c/s3.js",
        });
        expect(data.httpStatusCode).toEqual(200);

        data = await bucket.download({
            target: "a/b/c/s3.js",
            localPath: path.join(__dirname, "..", "s3-testing"),
        });
        expect(data.httpStatusCode).toEqual(200);
        data = await bucket.removeObjects({
            keys: ["a/b/c/s3.js"],
        });
        expect(data.httpStatusCode).toEqual(200);
    });
    test("checking a path exists - stat", async () => {
        let data = await bucket.stat({
            path: "a/b/c",
        });
        expect(data).toBeFalse;

        await bucket.upload({
            localPath: path.join(__dirname, "./s3.js"),
            target: "folder/s3.js",
        });
        data = await bucket.stat({
            path: "folder/s3.js",
        });
        expect(data.$metadata.httpStatusCode).toEqual(200);

        await bucket.removeObjects({
            keys: ["folder/s3.js"],
        });
    });
    test(`sync local path to bucket`, async () => {
        await bucket.syncLocalPathToBucket({
            localPath: path.join(__dirname, "..", "src"),
        });

        let data = await bucket.stat({
            path: "src/s3.js",
        });
        expect(data["$metadata"].httpStatusCode).toEqual(200);

        data = await bucket.removeObjects({
            prefix: "src",
        });
        let content = await bucket.listObjects({});
    });
    test(`it should get a presigned url to an object`, async () => {
        let data = await bucket.upload({
            target: "file.txt",
            json: { property: "value" },
        });
        expect(data.httpStatusCode).toEqual(200);

        let url = await bucket.getPresignedUrl({ target: "file.txt" });
        expect(url).toMatch(
            "http://localhost:10000/repository/file.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256"
        );

        await bucket.removeObjects({ keys: ["file.txt"] });
    });
});
