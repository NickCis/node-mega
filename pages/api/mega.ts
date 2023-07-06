import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import mime from 'mime-types';
import { pipeline } from 'node:stream/promises';

const MegaAPI = 'https://g.api.mega.co.nz'; // https://eu.api.mega.co.nz

async function post(url, body) {
  const res = await new Promise((rs, rj) => {
    const req = https.request(
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

async function fetchFileMetadata(id: string, folder: string) {
  if (folder) {
    return await post(`${MegaAPI}/cs?domain=meganz&n=${folder}`, [
      {
        a: 'g',
        g: 1,
        ssl: 0,
        n: id,
        v: 2,
      },
    ]);
  }

  return await post(`${MegaAPI}/cs?domain=meganz`, [
    {
      a: 'g',
      g: 1,
      ssl: 0,
      p: id,
    },
  ]);
}

async function fetchFolderMetadata(id: string) {
  return await post(`${MegaAPI}/cs?domain=meganz&n=${id}`, [
    { a: 'f', c: 1, r: 1, ca: 1 },
  ]);
}

function dataToBuffer(data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i++) {
    buffer.writeUint32BE(data[i], i * 4);
  }
  return buffer;
}

function getKeyIV(key) {
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

function decryptAttributes(attributes, key, cipher = 'aes-128-cbc') {
  const pair = getKeyIV(key);
  const iv = Buffer.alloc(4 * 4, 0);
  const decipher = crypto.createDecipheriv(cipher, pair.key, iv);
  decipher.setAutoPadding(false);
  let str = Buffer.concat([
    decipher.update(Buffer.from(attributes, 'base64')),
    decipher.final(),
  ])
    .toString('utf8')
    .replaceAll('\0', '')
    .trim();

  if (str.startsWith('MEGA')) str = str.substring('MEGA'.length);
  return JSON.parse(str);
}

function decryptKey(k, key, cipher = 'aes-128-ecb') {
  const pair = getKeyIV(key);
  const decipher = crypto.createDecipheriv(cipher, pair.key, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([
    decipher.update(Buffer.from(k, 'base64')),
    decipher.final(),
  ]);
}

async function createMegaFileStream(url) {
  return await new Promise((rs, rj) => {
    const req = (url.startsWith('https') ? https : http).request(url, (res) =>
      rs(res),
    );

    req.on('error', (e) => rj(e));
    req.end();
  });
}

function createMegaDecriptStream(key, cipher = 'aes-128-ctr') {
  const pair = getKeyIV(key);
  return crypto.createDecipheriv(cipher, pair.key, pair.iv);
}

function searchFile(metadata, path: string[], key) {
  const [root, ...files] = metadata[0].f;

  const recursiveSearch = (path, parent) => {
    const [current, ...rest] = path;
    for (const file of files) {
      if (file.p === parent) {
        if (!file.attr) {
          const [, encryptedFileKey] = file.k.split(':');
          file.key = decryptKey(encryptedFileKey, key);
          file.keyBase64 = file.key.toString('base64');
          file.attr = decryptAttributes(file.a, file.keyBase64);
        }

        if (file.attr.n === current)
          return rest.length ? recursiveSearch(rest, file.h) : file;
      }
    }
  };

  return recursiveSearch(path, root.h);

}

async function mega(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;

  if (!path) {
    res.status(404);
    res.send('Not found');
    return;
  }

  const [root, ...rest] = path;
  let [id, key] = root.split(':');
  let folder;

  if (rest) {
    const metadata = await fetchFolderMetadata(id);
    const file = searchFile(metadata, rest, key);

    if (!file) {
      res.status(404);
      res.send('Not found');
      return;
    }

    folder = id;
    id = file.h;
    key = file.key;
  }

  const metadata = await fetchFileMetadata(id, folder);
  const attributes = decryptAttributes(metadata[0].at, key);
  const contentType = mime.lookup(attributes.n);

  res.status(200);
  res.setHeader('Content-Type', contentType);

  await pipeline(
    await createMegaFileStream(metadata[0].g),
    createMegaDecriptStream(key),
    res,
  );
}

export default mega;
