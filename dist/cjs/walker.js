"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Walker = void 0;
var s3_js_1 = require("./s3.js");
var events_1 = __importDefault(require("events"));
/** Class representing an S3 walker. */
var Walker = /** @class */ (function (_super) {
    __extends(Walker, _super);
    /**
     * Walk a repository in an S3 bucket
     * @constructor
     * @param {Object} params
     * @param {Credentials} params.credentials - the AWS credentials to use for the connection
     */
    function Walker(_a) {
        var credentials = _a.credentials;
        var _this = _super.call(this) || this;
        if (!credentials)
            throw new Error("Missing required property: 'credentials'");
        var requiredProperties = ["bucket", "accessKeyId", "secretAccessKey", "region"];
        requiredProperties.forEach(function (property) {
            if (!credentials[property]) {
                throw new Error("Missing required property: '".concat(property, "'"));
            }
        });
        _this.roCrateFile = "ro-crate-metadata.json";
        _this.inventoryFile = "nocfl.inventory.json";
        _this.identifierFile = "nocfl.identifier.json";
        _this.credentials = credentials;
        _this.bucket = new s3_js_1.Bucket(credentials);
        return _this;
    }
    /**
     * Walk the repository and emit when an object is located. The object data
     *   to set up a store connection to it is emitted.
     * @param {Object} params
     * @param {string} [params.domain] - Walk only the defined domain
     */
    Walker.prototype.walk = function (_a) {
        var _b = _a.domain, domain = _b === void 0 ? undefined : _b;
        return __awaiter(this, void 0, void 0, function () {
            function __walker(_a) {
                var continuationToken = _a.continuationToken;
                return __awaiter(this, void 0, void 0, function () {
                    var objects, _i, _b, entry, match, inventory;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0: return [4 /*yield*/, this.bucket.listObjects({ continuationToken: continuationToken })];
                            case 1:
                                objects = _c.sent();
                                _i = 0, _b = objects.Contents;
                                _c.label = 2;
                            case 2:
                                if (!(_i < _b.length)) return [3 /*break*/, 5];
                                entry = _b[_i];
                                match = false;
                                if (domain &&
                                    entry.Key.match("".concat(domain, "/")) &&
                                    entry.Key.match(this.identifierFile)) {
                                    match = true;
                                }
                                else if (!domain && entry.Key.match(this.identifierFile)) {
                                    match = true;
                                }
                                if (!match) return [3 /*break*/, 4];
                                return [4 /*yield*/, this.bucket.readJSON({
                                        target: entry.Key,
                                    })];
                            case 3:
                                inventory = _c.sent();
                                this.emit("object", inventory);
                                _c.label = 4;
                            case 4:
                                _i++;
                                return [3 /*break*/, 2];
                            case 5:
                                if (!objects.NextContinuationToken) return [3 /*break*/, 7];
                                return [4 /*yield*/, walker({ domain: domain, continuationToken: objects.NextContinuationToken })];
                            case 6:
                                _c.sent();
                                _c.label = 7;
                            case 7: return [2 /*return*/];
                        }
                    });
                });
            }
            var walker;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        walker = __walker.bind(this);
                        return [4 /*yield*/, walker({ domain: domain })];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return Walker;
}(events_1.default));
exports.Walker = Walker;
