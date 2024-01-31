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
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
exports.File = exports.Folder = void 0;
var node_http_1 = require("node:http");
var node_https_1 = require("node:https");
var node_crypto_1 = require("node:crypto");
var common_1 = require("./common");
function dataToBuffer(data) {
    var buffer = Buffer.alloc(data.length * 4);
    for (var i = 0; i < data.length; i++) {
        buffer.writeUint32BE(data[i], i * 4);
    }
    return buffer;
}
function getKeyIV(keyPlain) {
    var data = [];
    var length = keyPlain.length / 4;
    for (var i = 0; i < length; i++) {
        data.push(keyPlain.readUInt32BE(i * 4) >>> 0);
    }
    return {
        key: dataToBuffer([
            (data[0] ^ data[4]) >>> 0,
            (data[1] ^ data[5]) >>> 0,
            (data[2] ^ data[6]) >>> 0,
            (data[3] ^ data[7]) >>> 0,
        ]),
        iv: dataToBuffer([data[4], data[5], 0, 0]),
    };
}
function getKeyIVBase64(key) {
    var keyPlain = Buffer.from(key, 'base64');
    return getKeyIV(keyPlain);
}
function fetch(mreq) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = mreq.url;
                    return [4 /*yield*/, new Promise(function (rs, rj) {
                            var req = (url.startsWith('https') ? node_https_1.default : node_http_1.default).request(url, {
                                method: mreq.method,
                                headers: mreq.headers,
                            }, function (res) { return rs(res); });
                            req.on('error', function (e) { return rj(e); });
                            if ('body' in mreq && mreq.body)
                                req.write(mreq.body);
                            req.end();
                        })];
                case 1:
                    res = _a.sent();
                    data = '';
                    res.on('data', function (d) {
                        data += d;
                    });
                    return [4 /*yield*/, new Promise(function (rs) {
                            res.on('end', function () {
                                rs(data);
                            });
                        })];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function createRequestStream(url) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (rs, rj) {
                        var req = (url.startsWith('https') ? node_https_1.default : node_http_1.default).request(url, function (res) {
                            rs(res);
                        });
                        req.on('error', function (e) { return rj(e); });
                        req.end();
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function decryptNoPaddingECB(key, plain) {
    var decipher = node_crypto_1.default.createDecipheriv('aes-128-ecb', key, null);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(plain), decipher.final()]);
}
function decryptNoPaddingCBC(key, iv, plain) {
    var decipher = node_crypto_1.default.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(plain), decipher.final()]);
}
function decryptAttributes(key, iv, attr) {
    var raw = decryptNoPaddingCBC(key, iv, attr);
    var str = raw.toString('utf8').replace(/\0/g, '').trim();
    for (var i = 0; i < raw.length; i++) {
        if (raw[i] === 0)
            raw[i] = 32;
    }
    var text = new TextDecoder().decode(raw).trim();
    if (text.startsWith('MEGA'))
        text = text.substring('MEGA'.length);
    return JSON.parse(text);
}
var Folder = /** @class */ (function () {
    function Folder(id, key) {
        this.id = id;
        this.key = key;
    }
    Folder.prototype.loadMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var req, data, json;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.metadata) return [3 /*break*/, 2];
                        req = (0, common_1.buildFolderMetadataRequest)(this.id);
                        return [4 /*yield*/, fetch(req)];
                    case 1:
                        data = _a.sent();
                        json = JSON.parse(data);
                        this.metadata = (Array.isArray(json) ? json[0] : json);
                        _a.label = 2;
                    case 2: return [2 /*return*/, this.metadata];
                }
            });
        });
    };
    Folder.prototype.getPair = function () {
        if (!this.pair)
            this.pair = getKeyIVBase64(this.key);
        return this.pair;
    };
    Folder.prototype.searchFile = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var metadata, pair, _a, root, files, iv, recursiveSearch, f;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.loadMetadata()];
                    case 1:
                        metadata = _b.sent();
                        pair = this.getPair();
                        _a = metadata.f, root = _a[0], files = _a.slice(1);
                        iv = Buffer.alloc(4 * 4, 0);
                        recursiveSearch = function (path, parent) {
                            var current = path[0], rest = path.slice(1);
                            for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
                                var file = files_1[_i];
                                if (file.p === parent) {
                                    var f_1 = file;
                                    if (!f_1.attr) {
                                        var _a = f_1.k.split(':'), encryptedFileKey = _a[1];
                                        var key = decryptNoPaddingECB(pair.key, Buffer.from(encryptedFileKey, 'base64'));
                                        f_1.pair = getKeyIV(key);
                                        f_1.attr = decryptAttributes(f_1.pair.key, iv, Buffer.from(f_1.a, 'base64'));
                                    }
                                    if (f_1.attr.n === current)
                                        return rest.length ? recursiveSearch(rest, f_1.h) : f_1;
                                }
                            }
                        };
                        f = recursiveSearch(path, root.h);
                        if (f)
                            return [2 /*return*/, new File(f.h, f.pair, this.id)];
                        return [2 /*return*/];
                }
            });
        });
    };
    return Folder;
}());
exports.Folder = Folder;
var File = /** @class */ (function () {
    function File(id, pair, folder) {
        this.id = id;
        this.pair = pair;
        this.folder = folder;
    }
    File.fromIdKey = function (id, key) {
        var pair = getKeyIVBase64(key);
        return new File(id, pair);
    };
    File.prototype.loadMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var req, data, json;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.metadata) return [3 /*break*/, 2];
                        req = (0, common_1.buildFileMetadataRequest)(this.id, this.folder);
                        return [4 /*yield*/, fetch(req)];
                    case 1:
                        data = _a.sent();
                        json = JSON.parse(data);
                        this.metadata = (Array.isArray(json) ? json[0] : json);
                        _a.label = 2;
                    case 2: return [2 /*return*/, this.metadata];
                }
            });
        });
    };
    File.prototype.getAttributes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var iv, metadata;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.attributes) return [3 /*break*/, 2];
                        iv = Buffer.alloc(4 * 4, 0);
                        return [4 /*yield*/, this.loadMetadata()];
                    case 1:
                        metadata = _a.sent();
                        this.attributes = decryptAttributes(this.pair.key, iv, Buffer.from(metadata.at, 'base64'));
                        _a.label = 2;
                    case 2: return [2 /*return*/, this.attributes];
                }
            });
        });
    };
    File.prototype.getFilename = function () {
        return __awaiter(this, void 0, void 0, function () {
            var attributes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAttributes()];
                    case 1:
                        attributes = _a.sent();
                        return [2 /*return*/, attributes.n];
                }
            });
        });
    };
    File.prototype.getURL = function () {
        return __awaiter(this, void 0, void 0, function () {
            var metadata;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loadMetadata()];
                    case 1:
                        metadata = _a.sent();
                        return [2 /*return*/, metadata.g];
                }
            });
        });
    };
    File.prototype.buildDownloadStream = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getURL()];
                    case 1:
                        url = _a.sent();
                        return [2 /*return*/, createRequestStream(url)];
                }
            });
        });
    };
    File.prototype.buildDecryptionStream = function () {
        return node_crypto_1.default.createDecipheriv('aes-128-ctr', this.pair.key, this.pair.iv);
    };
    return File;
}());
exports.File = File;
