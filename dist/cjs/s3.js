"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bucket = exports.S3 = void 0;
// API Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/index.html
// Developer Guide: docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/welcome.html
var client_s3_1 = require("@aws-sdk/client-s3");
var lib_storage_1 = require("@aws-sdk/lib-storage");
var s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
var fs_extra_1 = __importDefault(require("fs-extra"));
var createReadStream = fs_extra_1.default.createReadStream, createWriteStream = fs_extra_1.default.createWriteStream, readdir = fs_extra_1.default.readdir, ensureDir = fs_extra_1.default.ensureDir, stat = fs_extra_1.default.stat;
var lodash_1 = __importDefault(require("lodash"));
var isEmpty = lodash_1.default.isEmpty;
// const AWS = require("aws-sdk");
var path_1 = __importDefault(require("path"));
var MB = 1024 * 1024;
// https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
var maxFileNameLength = 1024;
var S3 = /** @class */ (function () {
    function S3(_a) {
        var accessKeyId = _a.accessKeyId, secretAccessKey = _a.secretAccessKey, region = _a.region, endpoint = _a.endpoint, _b = _a.forcePathStyle, forcePathStyle = _b === void 0 ? false : _b;
        if (!accessKeyId || !secretAccessKey) {
            throw new Error("You must pass in 'accessKeyId' && 'secretAccessKey'");
        }
        if (!region) {
            throw new Error("You must pass in 'region'");
        }
        this.configuration = {
            forcePathStyle: forcePathStyle,
            s3ForcePathStyle: forcePathStyle,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
            region: region,
        };
        if (endpoint)
            this.configuration.endpoint = endpoint;
        this.client = new client_s3_1.S3Client(this.configuration);
    }
    S3.prototype.listBuckets = function () {
        return __awaiter(this, void 0, void 0, function () {
            var command;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        command = new client_s3_1.ListBucketsCommand({});
                        _a = {};
                        return [4 /*yield*/, this.client.send(command)];
                    case 1: return [2 /*return*/, (_a.buckets = (_b.sent()).Buckets, _a)];
                }
            });
        });
    };
    S3.prototype.bucketExists = function (_a) {
        var bucket = _a.bucket;
        return __awaiter(this, void 0, void 0, function () {
            var command;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        bucket = bucket ? bucket : this.bucket;
                        command = new client_s3_1.HeadBucketCommand({ Bucket: bucket });
                        return [4 /*yield*/, this.client.send(command)];
                    case 1: return [2 /*return*/, (_b.sent()).$metadata.httpStatusCode === 200];
                }
            });
        });
    };
    return S3;
}());
exports.S3 = S3;
var Bucket = /** @class */ (function () {
    function Bucket(_a) {
        var bucket = _a.bucket, accessKeyId = _a.accessKeyId, secretAccessKey = _a.secretAccessKey, region = _a.region, endpoint = _a.endpoint, _b = _a.forcePathStyle, forcePathStyle = _b === void 0 ? false : _b;
        if (!bucket) {
            throw new Error("You must pass in a bucket name to operate on");
        }
        if (!accessKeyId || !secretAccessKey) {
            throw new Error("You must pass in 'accessKeyId' && 'secretAccessKey'");
        }
        if (!region) {
            throw new Error("You must pass in 'region'");
        }
        this.bucket = bucket;
        this.configuration = {
            forcePathStyle: forcePathStyle,
            s3ForcePathStyle: forcePathStyle,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
            region: region,
        };
        if (endpoint)
            this.configuration.endpoint = endpoint;
        this.client = new client_s3_1.S3Client(this.configuration);
    }
    Bucket.prototype.stat = function (_a) {
        var path = _a.path;
        return __awaiter(this, void 0, void 0, function () {
            var params, command, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        params = { Bucket: this.bucket, Key: path };
                        command = new client_s3_1.HeadObjectCommand(params);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.client.send(command)];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3:
                        error_1 = _b.sent();
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Bucket.prototype.pathExists = function (_a) {
        var _b, _c;
        var path = _a.path;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.stat({ path: path })];
                    case 1: return [2 /*return*/, ((_c = (_b = (_d.sent())) === null || _b === void 0 ? void 0 : _b.$metadata) === null || _c === void 0 ? void 0 : _c.httpStatusCode) === 200 ? true : false];
                }
            });
        });
    };
    Bucket.prototype.put = function (_a) {
        var _b = _a.localPath, localPath = _b === void 0 ? undefined : _b, _c = _a.content, content = _c === void 0 ? undefined : _c, _d = _a.json, json = _d === void 0 ? undefined : _d, _e = _a.target, target = _e === void 0 ? undefined : _e;
        return __awaiter(this, void 0, void 0, function () {
            // async function V3SinglePartUpload({ params }) {
            //     // Straight up V3 upload - not multipart
            //     const command = new PutObjectCommand(uploadParams);
            //     let response = await this.client.send(command);
            //     return response.$metadata;
            // }
            function V3MultipartUpload(_a) {
                var params = _a.params, partSize = _a.partSize;
                return __awaiter(this, void 0, void 0, function () {
                    var uploader, response;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                uploader = new lib_storage_1.Upload({
                                    client: this.client,
                                    partSize: partSize,
                                    queueSize: 4,
                                    leavePartsOnError: false,
                                    params: params,
                                });
                                return [4 /*yield*/, uploader.done()];
                            case 1:
                                response = _b.sent();
                                return [2 /*return*/, response.$metadata];
                        }
                    });
                });
            }
            var metadata, uploadParams, fileStream, chunkSize, fileStat, desiredChunkSize, minChunkSize, uploader, response;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        // check that key length is within the limits
                        if (target.length > maxFileNameLength) {
                            console.error("The target name '".concat(target, "' exceeds the max name length allowed by S3. This file can't be uploaded with that name."));
                            return [2 /*return*/];
                        }
                        metadata = {};
                        uploadParams = {
                            Bucket: this.bucket,
                            Key: target,
                            Metadata: metadata,
                        };
                        if (localPath !== undefined) {
                            fileStream = createReadStream(localPath);
                            fileStream.on("error", function (err) {
                                console.log("File Error", err);
                            });
                            uploadParams.Body = fileStream;
                        }
                        else if (content !== undefined && !isEmpty(content)) {
                            // create a file with this content
                            uploadParams.Body = Buffer.from(content);
                        }
                        else if (json !== undefined) {
                            // create a file with this json data
                            uploadParams.Body = Buffer.from(JSON.stringify(json));
                        }
                        else {
                            throw new Error("Define 'localPath' || 'content' || 'json'. Precedence is localPath, content, json if you specify more than one.");
                        }
                        chunkSize = 5 * MB;
                        if (!localPath) return [3 /*break*/, 3];
                        return [4 /*yield*/, stat(localPath)];
                    case 1:
                        fileStat = _f.sent();
                        return [4 /*yield*/, Math.ceil(fileStat.size / 10000)];
                    case 2:
                        desiredChunkSize = _f.sent();
                        minChunkSize = Math.max(5 * MB, Math.ceil(fileStat.size / 10000));
                        chunkSize = Math.max(desiredChunkSize, minChunkSize);
                        _f.label = 3;
                    case 3:
                        uploader = V3MultipartUpload.bind(this);
                        return [4 /*yield*/, uploader({
                                params: uploadParams,
                                partSize: chunkSize,
                            })];
                    case 4:
                        response = _f.sent();
                        return [2 /*return*/, response];
                }
            });
        });
    };
    Bucket.prototype.get = function (_a) {
        var e_1, _b;
        var target = _a.target, localPath = _a.localPath;
        return __awaiter(this, void 0, void 0, function () {
            var downloadParams, command, response, data, chunks, _c, _d, chunk, e_1_1;
            var _this = this;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        downloadParams = { Bucket: this.bucket, Key: target };
                        command = new client_s3_1.GetObjectCommand(downloadParams);
                        return [4 /*yield*/, this.client.send(command)];
                    case 1:
                        response = _e.sent();
                        if (!!localPath) return [3 /*break*/, 14];
                        chunks = [];
                        _e.label = 2;
                    case 2:
                        _e.trys.push([2, 7, 8, 13]);
                        _c = __asyncValues(response.Body);
                        _e.label = 3;
                    case 3: return [4 /*yield*/, _c.next()];
                    case 4:
                        if (!(_d = _e.sent(), !_d.done)) return [3 /*break*/, 6];
                        chunk = _d.value;
                        chunks.push(chunk);
                        _e.label = 5;
                    case 5: return [3 /*break*/, 3];
                    case 6: return [3 /*break*/, 13];
                    case 7:
                        e_1_1 = _e.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 13];
                    case 8:
                        _e.trys.push([8, , 11, 12]);
                        if (!(_d && !_d.done && (_b = _c.return))) return [3 /*break*/, 10];
                        return [4 /*yield*/, _b.call(_c)];
                    case 9:
                        _e.sent();
                        _e.label = 10;
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 12: return [7 /*endfinally*/];
                    case 13:
                        data = Buffer.concat(chunks).toString();
                        return [2 /*return*/, data];
                    case 14: return [4 /*yield*/, new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                            var stream;
                            return __generator(this, function (_a) {
                                stream = createWriteStream(localPath);
                                stream.on("close", resolve);
                                stream.on("error", function (error) {
                                    reject(error);
                                });
                                response.Body.pipe(stream);
                                return [2 /*return*/];
                            });
                        }); })];
                    case 15:
                        _e.sent();
                        return [2 /*return*/, response.$metadata];
                }
            });
        });
    };
    Bucket.prototype.readJSON = function (_a) {
        var target = _a.target;
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.get({ target: target })];
                    case 1:
                        data = _b.sent();
                        return [2 /*return*/, JSON.parse(data)];
                }
            });
        });
    };
    Bucket.prototype.copy = function (_a) {
        var source = _a.source, target = _a.target;
        return __awaiter(this, void 0, void 0, function () {
            var command;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        source = path_1.default.join(this.bucket, source);
                        target = path_1.default.join(target);
                        command = new client_s3_1.CopyObjectCommand({
                            Bucket: this.bucket,
                            CopySource: source,
                            Key: target,
                        });
                        return [4 /*yield*/, this.client.send(command)];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    Bucket.prototype.listObjects = function (_a) {
        var _b = _a.prefix, prefix = _b === void 0 ? undefined : _b, _c = _a.startAfter, startAfter = _c === void 0 ? undefined : _c, _d = _a.maxKeys, maxKeys = _d === void 0 ? undefined : _d, _e = _a.continuationToken, continuationToken = _e === void 0 ? undefined : _e;
        return __awaiter(this, void 0, void 0, function () {
            var params, command;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        params = {
                            Bucket: this.bucket,
                        };
                        if (prefix)
                            params.Prefix = prefix;
                        if (startAfter)
                            params.StartAfter = startAfter;
                        if (maxKeys)
                            params.MaxKeys = maxKeys;
                        if (continuationToken)
                            params.ContinuationToken = continuationToken;
                        command = new client_s3_1.ListObjectsV2Command(params);
                        return [4 /*yield*/, this.client.send(command)];
                    case 1: return [2 /*return*/, _f.sent()];
                }
            });
        });
    };
    Bucket.prototype.delete = function (_a) {
        var _b = _a.keys, keys = _b === void 0 ? [] : _b, _c = _a.prefix, prefix = _c === void 0 ? undefined : _c;
        return __awaiter(this, void 0, void 0, function () {
            var objects, objs, command;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!prefix) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.listObjects({ prefix: prefix })];
                    case 1:
                        objects = (_d.sent()).Contents;
                        if (objects)
                            keys = objects.map(function (entry) { return entry.Key; });
                        _d.label = 2;
                    case 2:
                        objs = keys.map(function (k) { return ({ Key: k }); });
                        if (!(objs === null || objs === void 0 ? void 0 : objs.length)) return [3 /*break*/, 4];
                        command = new client_s3_1.DeleteObjectsCommand({
                            Bucket: this.bucket,
                            Delete: { Objects: objs },
                        });
                        return [4 /*yield*/, this.client.send(command)];
                    case 3: return [2 /*return*/, (_d.sent()).$metadata];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Bucket.prototype.syncLocalPathToBucket = function (_a) {
        var localPath = _a.localPath;
        return __awaiter(this, void 0, void 0, function () {
            function walk(_a) {
                var root = _a.root, folder = _a.folder;
                return __awaiter(this, void 0, void 0, function () {
                    var entries, source, target, _i, entries_1, entry;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, readdir(folder, { withFileTypes: true })];
                            case 1:
                                entries = _b.sent();
                                _i = 0, entries_1 = entries;
                                _b.label = 2;
                            case 2:
                                if (!(_i < entries_1.length)) return [3 /*break*/, 5];
                                entry = entries_1[_i];
                                source = path_1.default.join(folder, entry.name);
                                target = source.replace(path_1.default.join(path_1.default.dirname(root), "/"), "");
                                paths.push({
                                    source: source,
                                    target: target,
                                    type: entry.isDirectory() ? "directory" : "file",
                                });
                                if (!entry.isDirectory()) return [3 /*break*/, 4];
                                return [4 /*yield*/, walk({ folder: path_1.default.join(folder, entry.name), root: root })];
                            case 3:
                                _b.sent();
                                _b.label = 4;
                            case 4:
                                _i++;
                                return [3 /*break*/, 2];
                            case 5: return [2 /*return*/];
                        }
                    });
                });
            }
            var paths, _i, paths_1, path_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        paths = [];
                        return [4 /*yield*/, walk({ root: localPath, folder: localPath })];
                    case 1:
                        _b.sent();
                        _i = 0, paths_1 = paths;
                        _b.label = 2;
                    case 2:
                        if (!(_i < paths_1.length)) return [3 /*break*/, 5];
                        path_2 = paths_1[_i];
                        if (!(path_2.type !== "directory")) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.put({
                                localPath: path_2.source,
                                target: path_2.target,
                            })];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    Bucket.prototype.getPresignedUrl = function (_a) {
        var target = _a.target, _b = _a.expiresIn, expiresIn = _b === void 0 ? 3600 : _b, _c = _a.download, download = _c === void 0 ? false : _c, host = _a.host;
        return __awaiter(this, void 0, void 0, function () {
            var filename, downloadParams, command;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        filename = path_1.default.basename(target);
                        downloadParams = {
                            Bucket: this.bucket,
                            Key: target,
                        };
                        if (download) {
                            downloadParams.ResponseContentDisposition = "response-content-disposition=attachment; filename: ".concat(filename);
                        }
                        command = new client_s3_1.GetObjectCommand(downloadParams);
                        return [4 /*yield*/, (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn: expiresIn })];
                    case 1: return [2 /*return*/, _d.sent()];
                }
            });
        });
    };
    return Bucket;
}());
exports.Bucket = Bucket;
