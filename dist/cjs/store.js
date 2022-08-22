"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
var s3_js_1 = require("./s3.js");
var fs_extra_1 = __importDefault(require("fs-extra"));
var createReadStream = fs_extra_1.default.createReadStream;
var crypto_1 = __importDefault(require("crypto"));
var nodePath = __importStar(require("path"));
var hasha_1 = __importDefault(require("hasha"));
var indexer_js_1 = require("./indexer.js");
var lodash_1 = __importDefault(require("lodash"));
var isString = lodash_1.default.isString, isArray = lodash_1.default.isArray, chunk = lodash_1.default.chunk;
var specialFiles = ["nocfl.inventory.json", "nocfl.identifier.json"];
/**
 * A transfer Object
 * @typedef {Object} Transfer
 * @property {String} localPath - the path to the file locally that you want to upload to the item folder
 * @property {String} json - a JSON object to store in the file directly
 * @property {String} content - some content to store in the file directly
 * @property {String} target - the target name for the file; this will be set relative to the item path
 * @property {Boolean} registerFile=true - whether the file should be registered in ro-crate-metadata.json.
 *  The file will be registered in the hasPart property of the root dataset if there isn't already an entry for the file.
 * @property {Boolean} version=false - whether the file should be versioned. If true, the existing file will be copied
 *  to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
 */
/**
 * An AWS Credentials Object
 * @typedef {Object} Credentials
 * @property{string} bucket - the AWS bucket to connect to
 * @property {string} accessKeyId - the AWS accessKey
 * @property {string} secretAccessKey - the AWS secretAccessKey
 * @property {string} region - the AWS region
 * @property {string} [endpoint] - the endpoint URL when using an S3 like service (e.g. Minio)
 * @property {boolean} [forcePathStyle] - whether to force path style endpoints (required for Minio and the like)
 */
/** Class representing an S3 store. */
var Store = /** @class */ (function () {
    /**
     * Interact with a store in an S3 bucket
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     * @param {string} params.className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} params.id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} params.domain - provide this to prefix the paths by domain
     * @param {number} [params.splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    function Store(_a) {
        var _b = _a.domain, domain = _b === void 0 ? undefined : _b, className = _a.className, id = _a.id, credentials = _a.credentials, _c = _a.splay, splay = _c === void 0 ? 1 : _c;
        if (!id)
            throw new Error("Missing required property: 'id'");
        if (!domain)
            throw new Error("Missing required property: 'domain'");
        if (!className)
            throw new Error("Missing required property: 'className'");
        if (!credentials)
            throw new Error("Missing required property: 'credentials'");
        var requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
        requiredProperties.forEach(function (property) {
            if (!credentials[property]) {
                throw new Error("Missing required property: '".concat(property, "'"));
            }
        });
        if (!isString(id)) {
            throw new Error("The 'id' must be a string");
        }
        if (!isString(className)) {
            throw new Error("The 'className' must be a string");
        }
        if (!isString(domain)) {
            throw new Error("The 'domain' must be a string");
        }
        if (!id.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error("The identifier doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$");
        }
        if (!className.match(/^[a-z,A-Z][a-z,A-Z,0-9,_]+$/)) {
            throw new Error("The className doesn't match the allowed format: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$");
        }
        this.credentials = credentials;
        this.bucket = new s3_js_1.Bucket(credentials);
        this.id = id;
        this.className = className;
        this.domain = domain;
        this.itemPath = "".concat(domain.toLowerCase(), "/").concat(className.toLowerCase(), "/").concat(id.slice(0, splay), "/").concat(id);
        this.splay = splay;
        this.roCrateFile = nodePath.join(this.itemPath, "ro-crate-metadata.json");
        this.inventoryFile = nodePath.join(this.itemPath, "nocfl.inventory.json");
        this.identifierFile = nodePath.join(this.itemPath, "nocfl.identifier.json");
        this.roCrateSkeleton = {
            "@context": [
                "https://w3id.org/ro/crate/1.1/context",
                {
                    "@vocab": "http://schema.org/",
                },
                {
                    txc: "https://purl.archive.org/textcommons/terms#",
                },
                {
                    "@base": null,
                },
            ],
            "@graph": [
                {
                    "@id": "ro-crate-metadata.json",
                    "@type": "CreativeWork",
                    conformsTo: {
                        "@id": "https://w3id.org/ro/crate/1.1",
                    },
                    about: {
                        "@id": "./",
                    },
                    identifier: "ro-crate-metadata.json",
                },
                {
                    "@id": "./",
                    "@type": ["Dataset"],
                    name: "My Research Object Crate",
                },
            ],
        };
        this.indexer = new indexer_js_1.Indexer({ credentials: credentials });
    }
    /**
     * Check whether the item exists in the storage
     * @return {Boolean}
     */
    Store.prototype.itemExists = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.bucket.pathExists({ path: this.identifierFile })];
                    case 1:
                        if (_a.sent()) {
                            return [2 /*return*/, true];
                        }
                        return [2 /*return*/, false];
                }
            });
        });
    };
    /**
     * Get the item path
     * @return {String}
     */
    Store.prototype.getItemPath = function () {
        return this.itemPath;
    };
    /**
     * Get the item identifier
     * @return {Object}
     */
    Store.prototype.getItemIdentifier = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getJSON({ target: "nocfl.identifier.json" })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get the item inventory file
     * @return {Object}
     */
    Store.prototype.getItemInventory = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getJSON({ target: "nocfl.inventory.json" })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Check whether the path exists in the storage
     * @param {Object} params
     * @param {String} params.path - the path of the file to check - this is relative to the item root
     * @return {Boolean}
     */
    Store.prototype.pathExists = function (_a) {
        var path = _a.path;
        return __awaiter(this, void 0, void 0, function () {
            var target;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        target = nodePath.join(this.itemPath, path);
                        return [4 /*yield*/, this.bucket.pathExists({ path: target })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Return the file stat
     * @param {Object} params
     * @param {String} params.path - the path of the file to stat- this is relative to the item root
     * @return {Boolean}
     */
    Store.prototype.stat = function (_a) {
        var path = _a.path;
        return __awaiter(this, void 0, void 0, function () {
            var target;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        target = nodePath.join(this.itemPath, path);
                        return [4 /*yield*/, this.bucket.stat({ path: target })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Create the item in the storage
     * @return {Boolean}
     */
    Store.prototype.createItem = function () {
        return __awaiter(this, void 0, void 0, function () {
            var roCrateFileHash;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.itemExists()];
                    case 1:
                        if (_a.sent()) {
                            throw new Error("An item with that identifier already exists");
                        }
                        roCrateFileHash = (0, hasha_1.default)(JSON.stringify(this.roCrateSkeleton));
                        return [4 /*yield*/, this.bucket.put({
                                target: this.roCrateFile,
                                json: this.roCrateSkeleton,
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.bucket.put({
                                target: this.inventoryFile,
                                json: { content: { "ro-crate-metadata.json": roCrateFileHash } },
                            })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.bucket.put({
                                target: this.identifierFile,
                                json: {
                                    id: this.id,
                                    className: this.className,
                                    domain: this.domain,
                                    itemPath: this.itemPath,
                                    splay: this.splay,
                                },
                            })];
                    case 4:
                        _a.sent();
                        // patch the index file
                        return [4 /*yield*/, this.indexer.patchIndex({
                                action: "PUT",
                                domain: this.domain,
                                className: this.className,
                                id: this.id,
                                splay: this.splay,
                            })];
                    case 5:
                        // patch the index file
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a file from the item on the storage
     * @param {Object} params
     * @param {String} params.localPath - the local path where you want to download the file to
     * @param {String} params.target - the file on the storage, relative to the item path, that you want to download
     */
    Store.prototype.get = function (_a) {
        var localPath = _a.localPath, target = _a.target;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        target = nodePath.join(this.itemPath, target);
                        return [4 /*yield*/, this.bucket.get({ target: target, localPath: localPath })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Get file versions
     * @param {Object} params
     * @param {String} params.target - the file whose versions to retrieve
     * @return {Array} - versions of the specified file ordered newest to oldest. The file as named (ie without a version
     *   string will be the first - newest - entry)
     */
    Store.prototype.listFileVersions = function (_a) {
        var target = _a.target;
        return __awaiter(this, void 0, void 0, function () {
            var files, versions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        target = nodePath.basename(target, nodePath.extname(target));
                        return [4 /*yield*/, this.bucket.listObjects({ prefix: nodePath.join(this.itemPath, target) })];
                    case 1:
                        files = _b.sent();
                        versions = files.Contents.map(function (c) { return c.Key; }).sort();
                        return [2 /*return*/, __spreadArray(__spreadArray([], versions.slice(1), true), [versions[0]], false).reverse()];
                }
            });
        });
    };
    /**
     * Get a JSON file from the item on the storage
     * @param {Object} params
     * @param {String} params.localPath - the local path where you want to download the file to
     * @param {String} params.target - the file on the storage, relative to the item path, that you want to download
     */
    Store.prototype.getJSON = function (_a) {
        var localPath = _a.localPath, target = _a.target;
        return __awaiter(this, void 0, void 0, function () {
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _c = (_b = JSON).parse;
                        return [4 /*yield*/, this.get({ localPath: localPath, target: target })];
                    case 1: return [2 /*return*/, _c.apply(_b, [_d.sent()])];
                }
            });
        });
    };
    /**
     * Get a presigned link to the file
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path, that you want the url for
     * @param {String} params.download - get link that can be used to trigger a direct file download
     */
    Store.prototype.getPresignedUrl = function (_a) {
        var target = _a.target, download = _a.download;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        target = nodePath.join(this.itemPath, target);
                        return [4 /*yield*/, this.bucket.getPresignedUrl({ target: target, download: download })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Put a file into the item on the storage
     * @param {Object} params
     * @param {String} params.localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} params.json - a JSON object to store in the file directly
     * @param {String} params.content - some content to store in the file directly
     * @param {String} params.target - the target name for the file; this will be set relative to the item path
     * @param {Boolean} params.registerFile=true - whether the file should be registered in ro-crate-metadata.json.
     *  The file will be registered in the hasPart property of the root dataset if there isn't already an entry for the file.
     * @param {Boolean} params.version=false - whether the file should be versioned. If true, the existing file will be copied
     *  to ${file}.v${date as ISO String}.{ext} before the new version is uploaded to the target name
     * @param {Transfer[]} params.batch - an array of objects defining content to put into the store where the params
     *  are as for the single case. Uploads will be run 5 at a time.
     */
    Store.prototype.put = function (_a) {
        var _b = _a.localPath, localPath = _b === void 0 ? undefined : _b, _c = _a.json, json = _c === void 0 ? undefined : _c, _d = _a.content, content = _d === void 0 ? undefined : _d, _e = _a.target, target = _e === void 0 ? undefined : _e, _f = _a.registerFile, registerFile = _f === void 0 ? true : _f, _g = _a.version, version = _g === void 0 ? false : _g, _h = _a.batch, batch = _h === void 0 ? [] : _h;
        return __awaiter(this, void 0, void 0, function () {
            function transfer(_a) {
                var localPath = _a.localPath, json = _a.json, content = _a.content, target = _a.target, registerFile = _a.registerFile, version = _a.version;
                return __awaiter(this, void 0, void 0, function () {
                    var hash, s3Target, date, versionFile, error_1;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                if (specialFiles.includes(target)) {
                                    throw new Error("You can't upload a file called '".concat(target, " as that's a special file used by the system"));
                                }
                                if (!localPath) return [3 /*break*/, 3];
                                return [4 /*yield*/, sha512(localPath)];
                            case 1:
                                hash = _b.sent();
                                return [4 /*yield*/, this.__updateInventory({ target: target, hash: hash })];
                            case 2:
                                _b.sent();
                                return [3 /*break*/, 7];
                            case 3:
                                if (!json) return [3 /*break*/, 5];
                                return [4 /*yield*/, this.__updateInventory({ target: target, hash: (0, hasha_1.default)(JSON.stringify(json)) })];
                            case 4:
                                _b.sent();
                                return [3 /*break*/, 7];
                            case 5: return [4 /*yield*/, this.__updateInventory({ target: target, hash: (0, hasha_1.default)(content) })];
                            case 6:
                                _b.sent();
                                _b.label = 7;
                            case 7:
                                s3Target = nodePath.join(this.itemPath, target);
                                if (!version) return [3 /*break*/, 13];
                                date = new Date().toISOString();
                                versionFile = nodePath.join(this.itemPath, "".concat(nodePath.basename(target, nodePath.extname(target)), ".v").concat(date).concat(nodePath.extname(target)));
                                _b.label = 8;
                            case 8:
                                _b.trys.push([8, 10, , 11]);
                                return [4 /*yield*/, this.bucket.copy({ source: s3Target, target: versionFile })];
                            case 9:
                                _b.sent();
                                return [3 /*break*/, 11];
                            case 10:
                                error_1 = _b.sent();
                                if (error_1.message === "The specified key does not exist.") {
                                    // no source file available - that's ok - ignore it - nothing to version yet
                                }
                                else {
                                    throw new Error(error_1.message);
                                }
                                return [3 /*break*/, 11];
                            case 11: return [4 /*yield*/, this.bucket.put({ localPath: localPath, json: json, content: content, target: s3Target })];
                            case 12:
                                _b.sent();
                                return [3 /*break*/, 15];
                            case 13: return [4 /*yield*/, this.bucket.put({ localPath: localPath, json: json, content: content, target: s3Target })];
                            case 14:
                                _b.sent();
                                _b.label = 15;
                            case 15: return [2 /*return*/];
                        }
                    });
                });
            }
            function updateCrateMetadata(_a) {
                var graph = _a.graph, target = _a.target, registerFile = _a.registerFile;
                return __awaiter(this, void 0, void 0, function () {
                    var rootDescriptor, rootDataset, partReferenced, fileEntry, stat;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                // we don't register the ro crate file
                                if (registerFile && target === "ro-crate-metadata.json")
                                    return [2 /*return*/, graph];
                                rootDescriptor = graph.filter(function (e) { return e["@id"] === "ro-crate-metadata.json" && e["@type"] === "CreativeWork"; })[0];
                                rootDataset = graph.filter(function (e) { return e["@id"] === rootDescriptor.about["@id"]; })[0];
                                if (!rootDataset) {
                                    console.log("".concat(this.itemPath, "/ro-crate-metadata.json DOES NOT have a root dataset"));
                                    return [2 /*return*/];
                                }
                                // update the hasPart property if required
                                if (!rootDataset.hasPart) {
                                    rootDataset.hasPart = [{ "@id": target }];
                                }
                                else {
                                    partReferenced = rootDataset.hasPart.filter(function (p) { return p["@id"] === target; });
                                    if (!partReferenced.length) {
                                        rootDataset.hasPart.push({ "@id": target });
                                    }
                                }
                                fileEntry = graph.filter(function (e) { return e["@id"] === target; });
                                if (!!fileEntry.length) return [3 /*break*/, 2];
                                return [4 /*yield*/, this.stat({ path: target })];
                            case 1:
                                stat = _b.sent();
                                graph.push({
                                    "@id": target,
                                    "@type": "File",
                                    name: target,
                                    contentSize: stat.ContentLength,
                                    dateModified: stat.LastModified,
                                    "@reverse": {
                                        hasPart: [{ "@id": "./" }],
                                    },
                                });
                                _b.label = 2;
                            case 2:
                                graph = graph.map(function (e) {
                                    if (e["@id"] === rootDescriptor.about["@id"])
                                        return rootDataset;
                                    return e;
                                });
                                return [2 /*return*/, graph];
                        }
                    });
                });
            }
            var chunks, _i, chunks_1, chunk_1, transfers, crate, _j, _k, _l, batch_1, _m, target_1, registerFile_1, _o, _p;
            return __generator(this, function (_q) {
                switch (_q.label) {
                    case 0: return [4 /*yield*/, this.itemExists()];
                    case 1:
                        if (!(_q.sent())) {
                            throw new Error("The item doesn't exist");
                        }
                        transfer = transfer.bind(this);
                        updateCrateMetadata = updateCrateMetadata.bind(this);
                        if (!batch.length) return [3 /*break*/, 6];
                        chunks = chunk(batch, 5);
                        _i = 0, chunks_1 = chunks;
                        _q.label = 2;
                    case 2:
                        if (!(_i < chunks_1.length)) return [3 /*break*/, 5];
                        chunk_1 = chunks_1[_i];
                        transfers = chunk_1.map(function (t) { return transfer(t); });
                        return [4 /*yield*/, Promise.all(transfers)];
                    case 3:
                        _q.sent();
                        _q.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, transfer({ localPath: localPath, json: json, content: content, target: target, registerFile: registerFile, version: version })];
                    case 7:
                        _q.sent();
                        _q.label = 8;
                    case 8: return [4 /*yield*/, this.getJSON({ target: "ro-crate-metadata.json" })];
                    case 9:
                        crate = _q.sent();
                        if (!target) return [3 /*break*/, 11];
                        _j = crate;
                        _k = "@graph";
                        return [4 /*yield*/, updateCrateMetadata({
                                graph: crate["@graph"],
                                target: target,
                                registerFile: registerFile,
                            })];
                    case 10:
                        _j[_k] = _q.sent();
                        _q.label = 11;
                    case 11:
                        if (!batch.length) return [3 /*break*/, 15];
                        _l = 0, batch_1 = batch;
                        _q.label = 12;
                    case 12:
                        if (!(_l < batch_1.length)) return [3 /*break*/, 15];
                        _m = batch_1[_l], target_1 = _m.target, registerFile_1 = _m.registerFile;
                        _o = crate;
                        _p = "@graph";
                        return [4 /*yield*/, updateCrateMetadata({
                                graph: crate["@graph"],
                                target: target_1,
                                registerFile: registerFile_1,
                            })];
                    case 13:
                        _o[_p] = _q.sent();
                        _q.label = 14;
                    case 14:
                        _l++;
                        return [3 /*break*/, 12];
                    case 15: 
                    // update the ro crate file
                    return [4 /*yield*/, this.bucket.put({
                            target: this.roCrateFile,
                            json: crate,
                        })];
                    case 16:
                        // update the ro crate file
                        _q.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Remove a file from an item in the storage
     * @param {Object} params
     * @param {String|Array.<String>} [params.target] - the target name for the file or array of target files; this will be set relative to the item path
     * @param {String} [params.prefix] - file prefix; this will be set relative to the item path
     */
    Store.prototype.delete = function (_a) {
        var _b = _a.target, target = _b === void 0 ? undefined : _b, _c = _a.prefix, prefix = _c === void 0 ? undefined : _c;
        return __awaiter(this, void 0, void 0, function () {
            var keys;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (specialFiles.includes(target)) {
                            throw new Error("You can't delete a file called '".concat(target, " as that's a special file used by the system"));
                        }
                        return [4 /*yield*/, this.itemExists()];
                    case 1:
                        if (!(_d.sent())) {
                            throw new Error("The item doesn't exist");
                        }
                        if (!target) return [3 /*break*/, 3];
                        if (!isString(target) && !isArray(target)) {
                            throw new Error("target must be a string or array of strings");
                        }
                        if (isString(target))
                            target = [target];
                        keys = target.map(function (t) { return nodePath.join(_this.itemPath, t); });
                        return [4 /*yield*/, this.bucket.delete({ keys: keys })];
                    case 2: return [2 /*return*/, _d.sent()];
                    case 3:
                        if (!prefix) return [3 /*break*/, 5];
                        if (!isString(prefix)) {
                            throw new Error("prefix must be a string");
                        }
                        prefix = nodePath.join(this.itemPath, prefix);
                        return [4 /*yield*/, this.bucket.delete({ prefix: prefix })];
                    case 4: return [2 /*return*/, _d.sent()];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete the item
     */
    Store.prototype.deleteItem = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.itemExists()];
                    case 1:
                        if (!(_a.sent())) {
                            throw new Error("The item doesn't exist");
                        }
                        return [4 /*yield*/, this.bucket.delete({ prefix: "".concat(this.itemPath, "/") })];
                    case 2:
                        _a.sent();
                        // patch the index file
                        return [4 /*yield*/, this.indexer.patchIndex({
                                action: "DELETE",
                                domain: this.domain,
                                className: this.className,
                                id: this.id,
                                splay: this.splay,
                            })];
                    case 3:
                        // patch the index file
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Recursively walk and list all of the files for the item
     * @return a list of files
     */
    Store.prototype.listResources = function () {
        return __awaiter(this, void 0, void 0, function () {
            function listItemResources(_a) {
                var continuationToken = _a.continuationToken;
                return __awaiter(this, void 0, void 0, function () {
                    var resources, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0: return [4 /*yield*/, this.bucket.listObjects({
                                    prefix: "".concat(this.itemPath, "/"),
                                    continuationToken: continuationToken,
                                })];
                            case 1:
                                resources = _c.sent();
                                if (!resources.NextContinuationToken) return [3 /*break*/, 3];
                                _b = [__spreadArray([], resources.Contents, true)];
                                return [4 /*yield*/, listResources(resources.NextContinuationToken)];
                            case 2: return [2 /*return*/, __spreadArray.apply(void 0, _b.concat([(_c.sent()), true]))];
                            case 3: return [2 /*return*/, resources.Contents];
                        }
                    });
                });
            }
            var resources;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        listItemResources = listItemResources.bind(this);
                        return [4 /*yield*/, listItemResources({})];
                    case 1:
                        resources = _a.sent();
                        resources = resources.map(function (r) {
                            r.Key = r.Key.replace("".concat(_this.itemPath, "/"), "");
                            return r;
                        });
                        return [2 /*return*/, resources];
                }
            });
        });
    };
    /**
     * Update the file inventory
     * @private
     * @param {Object} params
     * @param {String} params.target - the file on the storage, relative to the item path
     * @param {String} params.hash - the hash (checksum) of the file
     * @return a list of files
     */
    Store.prototype.__updateInventory = function (_a) {
        var target = _a.target, hash = _a.hash;
        return __awaiter(this, void 0, void 0, function () {
            var inventory, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _c = (_b = JSON).parse;
                        return [4 /*yield*/, this.bucket.get({ target: this.inventoryFile })];
                    case 1:
                        inventory = _c.apply(_b, [_d.sent()]);
                        inventory.content[target] = hash;
                        return [4 /*yield*/, this.bucket.put({
                                target: this.inventoryFile,
                                json: inventory,
                            })];
                    case 2:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return Store;
}());
exports.Store = Store;
var sha512 = function (path) {
    return new Promise(function (resolve, reject) {
        var hash = crypto_1.default.createHash("sha512");
        var rs = createReadStream(path);
        rs.on("error", reject);
        rs.on("data", function (chunk) { return hash.update(chunk); });
        rs.on("end", function () { return resolve(hash.digest("hex")); });
    });
};
