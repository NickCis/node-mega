// https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// https://vercel.com/docs/functions/streaming/quickstart

import type { NextRequest } from 'next/server';
import type { IncomingMessage } from 'node:http';

import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import mime from 'mime-types';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

// Prevents this route's response from being cached
export const dynamic = 'force-dynamic';

const MegaAPI = 'https://g.api.mega.co.nz'; // https://eu.api.mega.co.nz

async function post(url: string, body: object) {
  const res = await new Promise<IncomingMessage>((rs, rj) => {
    const req = (url.startsWith('https') ? https : http).request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => rs(res),
    );

    req.on('error', (e) => rj(e));
    req.write(JSON.stringify(body));
    req.end();
  });

  let data = '';

  res.on('data', (d) => {
    data += d;
  });

  return await new Promise((rs, rj) => {
    res.on('end', () => {
      try {
        rs(JSON.parse(data));
      } catch (e) {
        rj(e);
      }
    });
  });
}

interface MegaFileMetadata {
  at: string; // attributes
  g: string; // download url
}

async function fetchFileMetadata(
  id: string,
  folder?: string,
): Promise<MegaFileMetadata | undefined> {
  const json = folder
    ? await post(`${MegaAPI}/cs?domain=meganz&n=${folder}`, [
        {
          a: 'g',
          g: 1,
          ssl: 0,
          n: id,
          v: 2,
        },
      ])
    : await post(`${MegaAPI}/cs?domain=meganz`, [
        {
          a: 'g',
          g: 1,
          ssl: 0,
          p: id,
        },
      ]);

  if (Array.isArray(json)) return json[0];
}

interface MegaFolderMetadataFile {
  h: string; // id
  p: string; // Parent folder
  a: string; // Attributes
  k: string; // Key
}

interface MegaFolderMetadata {
  f: MegaFolderMetadataFile[];
}

async function fetchFolderMetadata(
  id: string,
): Promise<MegaFolderMetadata | undefined> {
  const json = await post(`${MegaAPI}/cs?domain=meganz&n=${id}&v=2`, [
    { a: 'f', c: 1, r: 1, ca: 1 },
  ]);

  if (Array.isArray(json)) return json[0];
}

function dataToBuffer(data: number[]) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i++) {
    buffer.writeUint32BE(data[i], i * 4);
  }
  return buffer;
}

function getKeyIV(key: string) {
  const keyPlain = Buffer.from(key, 'base64');
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

function decryptAttributes(
  attributes: string,
  key: string,
  cipher = 'aes-128-cbc',
): Record<string, string> {
  const pair = getKeyIV(key);
  const iv = Buffer.alloc(4 * 4, 0);
  const decipher = crypto.createDecipheriv(cipher, pair.key, iv);
  decipher.setAutoPadding(false);
  let str = Buffer.concat([
    decipher.update(Buffer.from(attributes, 'base64')),
    decipher.final(),
  ])
    .toString('utf8')
    .replace(/\0/g, '')
    .trim();

  if (str.startsWith('MEGA')) str = str.substring('MEGA'.length);
  return JSON.parse(str);
}

function decryptKey(k: string, key: string, cipher = 'aes-128-ecb') {
  const pair = getKeyIV(key);
  const decipher = crypto.createDecipheriv(cipher, pair.key, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([
    decipher.update(Buffer.from(k, 'base64')),
    decipher.final(),
  ]);
}

async function createMegaFileStream(url: string): Promise<IncomingMessage> {
  return await new Promise<IncomingMessage>((rs, rj) => {
    const req = (url.startsWith('https') ? https : http).request(url, (res) =>
      rs(res),
    );

    req.on('error', (e) => rj(e));
    req.end();
  });
}

function createMegaDecriptStream(key: string, cipher = 'aes-128-ctr') {
  const pair = getKeyIV(key);
  return crypto.createDecipheriv(cipher, pair.key, pair.iv);
}

interface ExtendedMegaFolderMetadataFile extends MegaFolderMetadataFile {
  attr: Record<string, string>;
  key: Buffer;
  keyBase64: string;
}

function searchFile(
  metadata: MegaFolderMetadata,
  path: string[],
  key: string,
): ExtendedMegaFolderMetadataFile | undefined {
  const [root, ...files] = metadata.f;

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
          f.key = decryptKey(encryptedFileKey, key);
          f.keyBase64 = f.key.toString('base64');
          f.attr = decryptAttributes(f.a, f.keyBase64);
        }

        if (f.attr.n === current)
          return rest.length ? recursiveSearch(rest, f.h) : f;
      }
    }
  };

  return recursiveSearch(path, root.h);
}
 
// This method must be named GET
export async function GET(req: NextRequest) {

  const url = new URL(req.url);
  const [, root, ...rest] = url.pathname.split('/');
  let [id, key] = root.split(':');

  if (!key)
    return new Response('No key', { status: 400 });

  let folder;

  if (rest) {
    const metadata = await fetchFolderMetadata(id);
    if (!metadata) return new Response('Not found', { status: 404 });

    const file = searchFile(metadata, rest, key);
    if (!file) return new Response('Not found', { status: 404 });

    folder = id;
    id = file.h;
    key = file.keyBase64;
  }

  const metadata = await fetchFileMetadata(id, folder);
  if (!metadata) return new Response('Not found', { status: 404 });
  const attributes = decryptAttributes(metadata.at, key);
  const contentType = mime.lookup(attributes.n);

  const ref: { current?: ReadableStreamDefaultController } = {};
  const customReadable = new ReadableStream({
    start(controller) {
      ref.current = controller;
    },
  });

  pipeline(
    await createMegaFileStream(metadata.g),
    createMegaDecriptStream(key),
    new Writable({
      decodeStrings: false,
      write(chunk, encoding, cb) {
        try {
          ref.current?.enqueue(chunk);
        } catch (e) {
          console.trace(e);
        }
        cb();
      },
      final(cb) {
        try {
        ref.current?.close();
        } catch (e) {
          console.trace(e);
        }
        cb();
      },
    }),
  );

  return new Response(customReadable, {
    headers: {
      'Content-Type': contentType || 'application/octet-stream',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'public, immutable, max-age=31536000',
    },
  });
}
