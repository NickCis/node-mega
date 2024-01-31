import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';

import type {
  MegaFolderMetadata,
  MegaFileMetadata,
  MegaFolderMetadataFile,
  MegaRequest,
} from './types';
import { buildFolderMetadataRequest, buildFileMetadataRequest } from './common';

function dataToBuffer(data: number[]): Buffer {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i++) {
    buffer.writeUint32BE(data[i], i * 4);
  }
  return buffer;
}

interface KeyIVPair {
  key: Buffer;
  iv: Buffer;
}

interface ExtendedMegaFolderMetadataFile extends MegaFolderMetadataFile {
  attr: Record<string, string>;
  pair: KeyIVPair;
}

function getKeyIV(keyPlain: Buffer): KeyIVPair {
  const data = [];
  const length = keyPlain.length / 4;

  for (let i = 0; i < length; i++) {
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

function getKeyIVBase64(key: string) {
  const keyPlain = Buffer.from(key, 'base64');
  return getKeyIV(keyPlain);
}

async function fetch(mreq: MegaRequest): Promise<string> {
  const url = mreq.url;
  const res = await new Promise<IncomingMessage>((rs, rj) => {
    const req = (url.startsWith('https') ? https : http).request(
      url,
      {
        method: mreq.method,
        headers: mreq.headers,
      },
      (res) => rs(res),
    );

    req.on('error', (e) => rj(e));
    if ('body' in mreq && mreq.body) req.write(mreq.body);
    req.end();
  });

  let data = '';

  res.on('data', (d) => {
    data += d;
  });

  return await new Promise((rs) => {
    res.on('end', () => {
      rs(data);
    });
  });
}

async function createRequestStream(url: string): Promise<IncomingMessage> {
  return await new Promise<IncomingMessage>((rs, rj) => {
    const req = (url.startsWith('https') ? https : http).request(url, (res) => {
      rs(res);
    });

    req.on('error', (e) => rj(e));
    req.end();
  });
}

function decryptNoPaddingECB(key: Buffer, plain: Buffer) {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(plain), decipher.final()]);
}

function decryptNoPaddingCBC(key: Buffer, iv: Buffer, plain: Buffer) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(plain), decipher.final()]);
}

function decryptAttributes(key: Buffer, iv: Buffer, attr: Buffer) {
  const raw = decryptNoPaddingCBC(key, iv, attr);
  const str = raw.toString('utf8').replace(/\0/g, '').trim();
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === 0) raw[i] = 32;
  }
  let text = new TextDecoder().decode(raw).trim();
  if (text.startsWith('MEGA')) text = text.substring('MEGA'.length);
  return JSON.parse(text);
}

export class Folder {
  pair?: KeyIVPair;
  metadata?: MegaFolderMetadata;
  id: string;
  key: string;

  constructor(id: string, key: string) {
    this.id = id;
    this.key = key;
  }

  async loadMetadata() {
    if (!this.metadata) {
      const req = buildFolderMetadataRequest(this.id);
      const data = await fetch(req);

      // TODO: manage errors
      const json = JSON.parse(data);
      this.metadata = (
        Array.isArray(json) ? json[0] : json
      ) as MegaFolderMetadata;
    }

    return this.metadata;
  }

  getPair() {
    if (!this.pair) this.pair = getKeyIVBase64(this.key);

    return this.pair;
  }

  async searchFile(path: string[]): Promise<File | undefined> {
    const metadata = await this.loadMetadata();
    const pair = this.getPair();
    const [root, ...files] = metadata.f;
    const iv = Buffer.alloc(4 * 4, 0);

    const recursiveSearch = (
      path: string[],
      parent: string,
    ): ExtendedMegaFolderMetadataFile | undefined => {
      const [current, ...rest] = path;
      for (const file of files) {
        if (file.p === parent) {
          const f = file as ExtendedMegaFolderMetadataFile;
          if (!f.attr) {
            const [, encryptedFileKey] = f.k.split(':');
            const key = decryptNoPaddingECB(
              pair.key,
              Buffer.from(encryptedFileKey, 'base64'),
            );
            f.pair = getKeyIV(key);
            f.attr = decryptAttributes(
              f.pair.key,
              iv,
              Buffer.from(f.a, 'base64'),
            );
          }

          if (f.attr.n === current)
            return rest.length ? recursiveSearch(rest, f.h) : f;
        }
      }
    };

    const f = recursiveSearch(path, root.h);
    if (f) return new File(f.h, f.pair, this.id);
  }
}

export class File {
  metadata?: MegaFileMetadata;
  attributes?: any;
  id: string;
  pair: KeyIVPair;
  folder?: string;

  public static fromIdKey(id: string, key: string): File {
    const pair = getKeyIVBase64(key);
    return new File(id, pair);
  }

  constructor(id: string, pair: KeyIVPair, folder?: string) {
    this.id = id;
    this.pair = pair;
    this.folder = folder;
  }

  async loadMetadata() {
    if (!this.metadata) {
      const req = buildFileMetadataRequest(this.id, this.folder);
      const data = await fetch(req);
      // TODO: manage errors
      const json = JSON.parse(data);
      this.metadata = (
        Array.isArray(json) ? json[0] : json
      ) as MegaFileMetadata;
    }

    return this.metadata;
  }

  async getAttributes() {
    if (!this.attributes) {
      const iv = Buffer.alloc(4 * 4, 0);
      const metadata = await this.loadMetadata();
      this.attributes = decryptAttributes(
        this.pair.key,
        iv,
        Buffer.from(metadata.at, 'base64'),
      );
    }

    return this.attributes;
  }

  async getFilename() {
    const attributes = await this.getAttributes();
    return attributes.n;
  }

  async getURL() {
    const metadata = await this.loadMetadata();
    return metadata.g;
  }

  async buildDownloadStream() {
    const url = await this.getURL();
    return createRequestStream(url);
  }

  buildDecryptionStream() {
    return crypto.createDecipheriv('aes-128-ctr', this.pair.key, this.pair.iv);
  }
}
