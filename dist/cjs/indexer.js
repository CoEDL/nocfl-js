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
     * @param {Credentials} credentials - the AWS credentials to use for the connection
     * @param {string} [domain] - provide this to prefix the paths by domain
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
                            var domain = object.domain, className = object.className, id = object.id, itemPath = object.itemPath, splay = object.splay;
                            var idPrefix = id.slice(0, 1).toLowerCase();
                            if (!indices[domain])
                                indices[domain] = {};
                            if (!indices[domain][className])
                                indices[domain][className] = {};
                            if (!indices[domain][className][idPrefix])
                                indices[domain][className][idPrefix] = [];
                            indices[domain][className][idPrefix].push(object);
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
    Indexer.prototype.patchIndex = function (_a) {
        var action = _a.action, domain = _a.domain, className = _a.className, id = _a.id;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                if (!["PUT, DELETE"].includes(action)) {
                    throw new Error("'action' must be one of 'PUT' or 'DELETE'");
                }
                return [2 /*return*/];
            });
        });
    };
    Indexer.prototype.listIndices = function (_a) {
        var domain = _a.domain, className = _a.className;
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_b) {
            return [2 /*return*/];
        }); });
    };
    Indexer.prototype.getIndex = function (_a) {
        var domain = _a.domain, className = _a.className, prefix = _a.prefix;
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_b) {
            return [2 /*return*/];
        }); });
    };
    return Indexer;
}());
exports.Indexer = Indexer;
