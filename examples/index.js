const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');

const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const url = 'https://mega.nz/file/A0ITTTRD#LVuyf5XhebPHkoUIjNAwE965V4NyxTDgGOnXI5gIYdc';

async function fetchMetadata(id) {
  const res = await new Promise((rs, rj) => {
    const req = https.request(
      'https://eu.api.mega.co.nz/cs?domain=meganz&lang=en',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      res => rs(res),
    );

    req.on('error', e => rj(e));
    req.write(JSON.stringify([{
      a: 'g',
      g: 1,
      ssl: 0,
      p: id,
    }]));
    req.end();
  });

  let data = '';

  res.on('data', d => {
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

async function createMegaFileStream(url) {
  return await new Promise((rs, rj) => {
    const req = (url.startsWith('https') ? https : http).request(
      url,
      res => rs(res),
    );

    req.on('error', e => rj(e));
    req.end();
  });
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

function createMegaDecriptStream(key, cipher = 'aes-128-ctr') {
  const pair = getKeyIV(key);
  return crypto.createDecipheriv(cipher, pair.key, pair.iv);
}

function getIDKeyFromURL(url) {
  const parts = url.split('/');
  const [id, key] = parts[parts.length - 1].split('#');
  return { id, key };
}

async function main() {
  const info = getIDKeyFromURL(url);
  const metadata = await fetchMetadata(info.id);
  console.log('metadata', metadata);
  await pipeline(
    await createMegaFileStream(metadata[0].g),
    createMegaDecriptStream(info.key),
    fs.createWriteStream('./output.pdf')
  );
}

main();
