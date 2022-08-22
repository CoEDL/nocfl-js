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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Indexer = void 0;
var s3_js_1 = require("./s3.js");
var walker_1 = require("./walker");
var lodash_1 = require("lodash");
/** Class representing an S3 Indexer. */
var Indexer = /** @class */ (function () {
    /**
     * Handle content indices in an S3 bucket
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     */
    function Indexer(_a) {
        var credentials = _a.credentials;
        if (!credentials)
            throw new Error("Missing required property: 'credentials'");
        var requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
        requiredProperties.forEach(function (property) {
            if (!credentials[property]) {
                throw new Error("Missing required property: '".concat(property, "'"));
            }
        });
        this.roCrateFile = "ro-crate-metadata.json";
        this.inventoryFile = "nocfl.inventory.json";
        this.identifierFile = "nocfl.identifier.json";
        this.credentials = credentials;
        this.bucket = new s3_js_1.Bucket(credentials);
    }
    /**
     * Create index files
     * @param {Object} params
     * @param {string} [params.domain] - Create indices for this domain only
     */
    Indexer.prototype.createIndices = function (_a) {
        var _b = _a.domain, domain = _b === void 0 ? undefined : _b;
        return __awaiter(this, void 0, void 0, function () {
            var walker, indices, indexFiles, _i, _c, domain_1, _d, _e, className, _f, _g, idPrefix, indexFile;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        walker = new walker_1.Walker({ credentials: this.credentials, domain: domain });
                        indices = {};
                        walker.on("object", function (object) {
                            var domain = object.domain, className = object.className, id = object.id, splay = object.splay;
                            var idPrefix = id.slice(0, 1).toLowerCase();
                            if (!indices[domain])
                                indices[domain] = {};
                            if (!indices[domain][className])
                                indices[domain][className] = {};
                            if (!indices[domain][className][idPrefix])
                                indices[domain][className][idPrefix] = [];
                            indices[domain][className][idPrefix].push({ domain: domain, className: className, id: id, splay: splay });
                        });
                        return [4 /*yield*/, walker.walk({ domain: domain })];
                    case 1:
                        _h.sent();
                        indexFiles = [];
                        _i = 0, _c = Object.keys(indices);
                        _h.label = 2;
                    case 2:
                        if (!(_i < _c.length)) return [3 /*break*/, 9];
                        domain_1 = _c[_i];
                        _d = 0, _e = Object.keys(indices[domain_1]);
                        _h.label = 3;
                    case 3:
                        if (!(_d < _e.length)) return [3 /*break*/, 8];
                        className = _e[_d];
                        _f = 0, _g = Object.keys(indices[domain_1][className]);
                        _h.label = 4;
                    case 4:
                        if (!(_f < _g.length)) return [3 /*break*/, 7];
                        idPrefix = _g[_f];
                        indexFile = "".concat(domain_1, "/indices/").concat(className, "/").concat(idPrefix, ".json");
                        indexFiles.push(indexFile);
                        return [4 /*yield*/, this.bucket.upload({
                                target: indexFile,
                                json: (0, lodash_1.orderBy)(indices[domain_1][className][idPrefix], "id"),
                            })];
                    case 5:
                        _h.sent();
                        _h.label = 6;
                    case 6:
                        _f++;
                        return [3 /*break*/, 4];
                    case 7:
                        _d++;
                        return [3 /*break*/, 3];
                    case 8:
                        _i++;
                        return [3 /*break*/, 2];
                    case 9: return [2 /*return*/, indexFiles];
                }
            });
        });
    };
    /**
     * Patch an index file - add new item to it or remove an existing item
     * @param {Object} params
     * @param {'PUT'|'DELETE'} params.action - the action to perform
     * @param {string} params.className - the class name of the item being operated on
     * @param {string} params.id - the id of the item being operated on
     * @param {string} params.domain - provide this to prefix the paths by domain
     * @param {number} params.splay=1 - the number of characters (from the start of the identifer) when converting the id to a path
     */
    Indexer.prototype.patchIndex = function (_a) {
        var action = _a.action, domain = _a.domain, className = _a.className, id = _a.id, _b = _a.splay, splay = _b === void 0 ? 1 : _b;
        return __awaiter(this, void 0, void 0, function () {
            var indexFileName, indexFile, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!["PUT", "DELETE"].includes(action)) {
                            throw new Error("'action' must be one of 'PUT' or 'DELETE'");
                        }
                        indexFileName = "".concat(domain, "/indices/").concat(className, "/").concat(id.slice(0, 1).toLowerCase(), ".json");
                        indexFile = [];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.bucket.readJSON({ target: indexFileName })];
                    case 2:
                        indexFile = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _c.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        if (action === "PUT") {
                            indexFile.push({ domain: domain, className: className, id: id, splay: splay });
                        }
                        else if (action === "DELETE") {
                            indexFile = indexFile.filter(function (i) { return i.id !== id; });
                        }
                        indexFile = (0, lodash_1.uniqBy)(indexFile, "id");
                        return [4 /*yield*/, this.bucket.upload({ target: indexFileName, json: indexFile })];
                    case 5:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * List indices in a given domain
     * @param {Object} params
     * @param {string} params.domain - provide the domain of the index file
     * @param {string} params.className - the class name of the item being operated on
     */
    Indexer.prototype.listIndices = function (_a) {
        var domain = _a.domain, className = _a.className;
        return __awaiter(this, void 0, void 0, function () {
            var prefix, files;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!domain)
                            throw new Error("You must provide 'domain'");
                        prefix = "".concat(domain, "/indices");
                        if (className)
                            prefix = "".concat(prefix, "/").concat(className);
                        return [4 /*yield*/, this.bucket.listObjects({ prefix: prefix })];
                    case 1:
                        files = (_b.sent()).Contents;
                        files = files.map(function (f) { return f.Key; });
                        return [2 /*return*/, files];
                }
            });
        });
    };
    /**
     * Get an index file
     * @param {Object} params
     * @param {string} params.domain - provide the domain of the index file
     * @param {string} params.className - the class name of the item being operated on
     * @param {string} [params.prefix] - the prefix of the index: i.e. the first letter
     * @param {string} [params.file] - the index file name
     */
    Indexer.prototype.getIndex = function (_a) {
        var domain = _a.domain, className = _a.className, prefix = _a.prefix, file = _a.file;
        return __awaiter(this, void 0, void 0, function () {
            var indexFile;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!domain)
                            throw new Error("You must provide 'domain'");
                        if (!className)
                            throw new Error("You must provide 'className'");
                        if (!prefix && !file)
                            throw new Error("You must provide one of 'prefix' or 'file'");
                        if (file) {
                            indexFile = "".concat(domain, "/indices/").concat(className, "/").concat(file);
                        }
                        else if (prefix) {
                            indexFile = "".concat(domain, "/indices/").concat(className, "/").concat(prefix, ".json");
                        }
                        return [4 /*yield*/, this.bucket.readJSON({ target: indexFile })];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    return Indexer;
}());
exports.Indexer = Indexer;
