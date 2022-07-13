export class S3 {
    constructor({ accessKeyId, secretAccessKey, region, endpoint, forcePathStyle }: {
        accessKeyId: any;
        secretAccessKey: any;
        region: any;
        endpoint: any;
        forcePathStyle?: boolean | undefined;
    });
    configuration: {
        forcePathStyle: boolean;
        s3ForcePathStyle: boolean;
        credentials: {
            accessKeyId: any;
            secretAccessKey: any;
        };
        region: any;
    };
    client: S3Client;
    listBuckets(): Promise<{
        buckets: import("@aws-sdk/client-s3").Bucket[] | undefined;
    }>;
    bucketExists({ bucket }: {
        bucket: any;
    }): Promise<boolean>;
}
export class Bucket {
    constructor({ bucket, accessKeyId, secretAccessKey, region, endpoint, forcePathStyle, }: {
        bucket: any;
        accessKeyId: any;
        secretAccessKey: any;
        region: any;
        endpoint: any;
        forcePathStyle?: boolean | undefined;
    });
    bucket: any;
    configuration: {
        forcePathStyle: boolean;
        s3ForcePathStyle: boolean;
        credentials: {
            accessKeyId: any;
            secretAccessKey: any;
        };
        region: any;
    };
    client: S3Client;
    stat({ path }: {
        path: any;
    }): Promise<false | import("@aws-sdk/client-s3").HeadObjectCommandOutput>;
    pathExists({ path }: {
        path: any;
    }): Promise<boolean>;
    upload({ localPath, content, json, target, }: {
        localPath?: undefined;
        content?: undefined;
        json?: undefined;
        target?: undefined;
    }): Promise<import("@aws-sdk/types").ResponseMetadata | undefined>;
    download({ target, localPath }: {
        target: any;
        localPath: any;
    }): Promise<string | import("@aws-sdk/types").ResponseMetadata>;
    readJSON({ target }: {
        target: any;
    }): Promise<any>;
    listObjects({ prefix, startAfter, maxKeys, continuationToken, }: {
        prefix?: undefined;
        startAfter?: undefined;
        maxKeys?: undefined;
        continuationToken?: undefined;
    }): Promise<import("@aws-sdk/client-s3").ListObjectsV2CommandOutput>;
    removeObjects({ keys, prefix }: {
        keys?: any[] | undefined;
        prefix?: undefined;
    }): Promise<import("@aws-sdk/types").ResponseMetadata | undefined>;
    syncLocalPathToBucket({ localPath }: {
        localPath: any;
    }): Promise<void>;
    getPresignedUrl({ target, expiresIn, download, host }: {
        target: any;
        expiresIn?: number | undefined;
        download?: boolean | undefined;
        host: any;
    }): Promise<string>;
}
import { S3Client } from "@aws-sdk/client-s3/dist-types/S3Client";
