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
var lodash_1 = require("lodash");
var specialFiles = ["nocfl.inventory.json", "nocfl.identifier.json"];
/** Class representing an S3 store. */
var Store = /** @class */ (function () {
    /**
     * Interact with a store in an S3 bucket
     * @constructor
     * @param {string} className - the class name of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} id - the id of the item being operated on - must match: ^[a-z,A-Z][a-z,A-Z,0-9,_]+$
     * @param {string} [domain] - provide this to prefix the paths by domain
     * @param {string} credentials.bucket - the AWS bucket to connect to
     * @param {string} credentials.accessKeyId - the AWS accessKey
     * @param {string} credentials.secretAccessKey - the AWS secretAccessKey
     * @param {string} credentials.region - the AWS region
     * @param {string} [credentials.endpoint] - the endpoint URL when using an S3 like service (e.g. Minio)
     * @param {boolean} [credentials.forcePathStyle] - whether to force path style endpoints (required for Minio and the like)
     * @param {number} [splay=1] - the number of characters (from the start of the identifer) when converting the id to a path
     */
    function Store(_a) {
        var _b = _a.domain, domain = _b === void 0 ? undefined : _b, className = _a.className, id = _a.id, credentials = _a.credentials, _c = _a.splay, splay = _c === void 0 ? 1 : _c;
        if (!id)
            throw new Error("Missing required property: 'id'");
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
        if (!(0, lodash_1.isString)(id)) {
            throw new Error("The 'id' must be a string");
        }
        if (!(0, lodash_1.isString)(className)) {
            throw new Error("The 'className' must be a string");
        }
        if (!(0, lodash_1.isString)(domain) && !(0, lodash_1.isUndefined)(domain)) {
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
        this.itemPath = domain
            ? "".concat(domain.toLowerCase(), "/").concat(className.toLowerCase(), "/").concat(id.slice(0, splay), "/").concat(id)
            : "".concat(className.toLowerCase(), "/").concat(id.slice(0, splay), "/").concat(id);
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
            ],
        };
    }
    /**
     * Check whether the item exists in the storage
     * @return {Boolean}
     */
    Store.prototype.itemExists = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.bucket.pathExists({
                            path: nodePath.join(this.itemPath, "nocfl.inventory.json"),
                        })];
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
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, this.get({ target: "nocfl.identifier.json" })];
                    case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
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
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, this.get({ target: "nocfl.inventory.json" })];
                    case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                }
            });
        });
    };
    /**
     * Check whether the path exists in the storage
     * @param {String} path - the path of the file to check - this is relative to the item root
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
     * @param {String} path - the path of the file to stat- this is relative to the item root
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
                        return [4 /*yield*/, this.bucket.upload({
                                target: this.roCrateFile,
                                json: this.roCrateSkeleton,
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.bucket.upload({
                                target: this.inventoryFile,
                                json: { content: { "ro-crate-metadata.json": roCrateFileHash } },
                            })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.bucket.upload({
                                target: this.identifierFile,
                                json: {
                                    id: this.id,
                                    className: this.className,
                                    domain: this.domain,
                                    itemPath: this.itemPath,
                                },
                            })];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a file from the item on the storage
     * @param {String} localPath - the local path where you want to download the file to
     * @param {String} target - the file on the storage, relative to the item path, that you want to download
     */
    Store.prototype.get = function (_a) {
        var localPath = _a.localPath, target = _a.target;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        target = nodePath.join(this.itemPath, target);
                        return [4 /*yield*/, this.bucket.download({ target: target, localPath: localPath })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Get a JSON file from the item on the storage
     * @param {String} localPath - the local path where you want to download the file to
     * @param {String} target - the file on the storage, relative to the item path, that you want to download
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
     * @param {String} target - the file on the storage, relative to the item path, that you want the url for
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
     * @param {String} localPath - the path to the file locally that you want to upload to the item folder
     * @param {String} json - a JSON object to store in the file directly
     * @param {String} content - some content to store in the file directly
     * @param {String} target - the target name for the file; this will be set relative to the item path
     */
    Store.prototype.put = function (_a) {
        var localPath = _a.localPath, json = _a.json, content = _a.content, target = _a.target;
        return __awaiter(this, void 0, void 0, function () {
            var s3Target, hash;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (specialFiles.includes(target)) {
                            throw new Error("You can't upload a file called '".concat(target, " as that's a special file used by the system"));
                        }
                        s3Target = nodePath.join(this.itemPath, target);
                        return [4 /*yield*/, this.itemExists()];
                    case 1:
                        if (!(_b.sent())) {
                            throw new Error("You need to 'createItem' before you can add content to it");
                        }
                        if (!localPath) return [3 /*break*/, 4];
                        return [4 /*yield*/, sha512(localPath)];
                    case 2:
                        hash = _b.sent();
                        return [4 /*yield*/, this.__updateInventory({ target: target, hash: hash })];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 8];
                    case 4:
                        if (!json) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.__updateInventory({ target: target, hash: (0, hasha_1.default)(JSON.stringify(json)) })];
                    case 5:
                        _b.sent();
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, this.__updateInventory({ target: target, hash: (0, hasha_1.default)(content) })];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8: return [4 /*yield*/, this.bucket.upload({ localPath: localPath, json: json, content: content, target: s3Target })];
                    case 9: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Remove a file from an item in the storage
     * @param {String|Array.<String>} [target] - the target name for the file or array of target files; this will be set relative to the item path
     * @param {String} [prefix] - file prefix; this will be set relative to the item path
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
                            throw new Error("You need to 'createItem' before you can remove content from it");
                        }
                        if (!target) return [3 /*break*/, 3];
                        if (!(0, lodash_1.isString)(target) && !(0, lodash_1.isArray)(target)) {
                            throw new Error("target must be a string or array of strings");
                        }
                        if ((0, lodash_1.isString)(target))
                            target = [target];
                        keys = target.map(function (t) { return nodePath.join(_this.itemPath, t); });
                        return [4 /*yield*/, this.bucket.removeObjects({ keys: keys })];
                    case 2: return [2 /*return*/, _d.sent()];
                    case 3:
                        if (!prefix) return [3 /*break*/, 5];
                        if (!(0, lodash_1.isString)(prefix)) {
                            throw new Error("prefix must be a string");
                        }
                        prefix = nodePath.join(this.itemPath, prefix);
                        return [4 /*yield*/, this.bucket.removeObjects({ prefix: prefix })];
                    case 4: return [2 /*return*/, _d.sent()];
                    case 5: return [2 /*return*/];
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
                                    prefix: this.itemPath,
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
                            r.Key = r.Key.replace("".concat(_this.getItemPath(), "/"), "");
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
     * @param {String} target - the file on the storage, relative to the item path
     * @param {String} hash - the hash (checksum) of the file
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
                        return [4 /*yield*/, this.bucket.download({ target: this.inventoryFile })];
                    case 1:
                        inventory = _c.apply(_b, [_d.sent()]);
                        inventory.content[target] = hash;
                        return [4 /*yield*/, this.bucket.upload({
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
