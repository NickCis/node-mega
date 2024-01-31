"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFileMetadataRequest = exports.buildFolderMetadataRequest = exports.MegaAPI = void 0;
exports.MegaAPI = 'https://g.api.mega.co.nz'; // https://eu.api.mega.co.nz
function buildFolderMetadataRequest(id) {
    return {
        method: 'POST',
        url: "".concat(exports.MegaAPI, "/cs?domain=meganz&n=").concat(id, "&v=2"),
        body: JSON.stringify([{ a: 'f', c: 1, r: 1, ca: 1 }]),
        headers: {
            'Content-type': 'application/json',
        },
    };
}
exports.buildFolderMetadataRequest = buildFolderMetadataRequest;
function buildFileMetadataRequest(id, folder) {
    if (folder) {
        return {
            method: 'POST',
            body: JSON.stringify([
                {
                    a: 'g',
                    g: 1,
                    ssl: 0,
                    n: id,
                    // v: 2,
                    v: 1,
                },
            ]),
            headers: {
                'Content-type': 'application/json',
            },
            url: "".concat(exports.MegaAPI, "/cs?domain=meganz&n=").concat(folder),
        };
    }
    return {
        method: 'POST',
        body: JSON.stringify([
            {
                a: 'g',
                g: 1,
                ssl: 0,
                p: id,
            },
        ]),
        headers: {
            'Content-type': 'application/json',
        },
        url: "".concat(exports.MegaAPI, "/cs?domain=meganz"),
    };
}
exports.buildFileMetadataRequest = buildFileMetadataRequest;
