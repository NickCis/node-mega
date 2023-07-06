/*
 * https://github.com/BaseMax/MegaDownloader
 * https://github.com/tonistiigi/mega/issues/19
 *
 * Listar carpeta:
 *   https://mega.nz/folder/gpxHhawR#Vdfpuw0WGJwfhxHRgrLl9w/
 *   POST https://g.api.mega.co.nz/cs?id=-1520662384&n=gpxHhawR&ec&domain=meganz&v=2&lang=es | [{"a":"f","c":1,"r":1,"ca":1}]
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const url = 'https://mega.nz/file/A0ITTTRD#LVuyf5XhebPHkoUIjNAwE965V4NyxTDgGOnXI5gIYdc';
const id = 'A0ITTTRD';
const key = 'LVuyf5XhebPHkoUIjNAwE965V4NyxTDgGOnXI5gIYdc';

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

async function fetchFile(url) {
  const res = await new Promise((rs, rj) => {
    const req = (url.startsWith('https') ? https : http).request(
      url,
      res => rs(res),
    );

    req.on('error', e => rj(e));
    req.end();
  });

  const data = [];

  res.on('data', chunk => {
    data.push(chunk);
  });

  return await new Promise((rs, rj) => {
    res.on('end', () => {
      try {
        rs(Buffer.concat(data));
      } catch (e) {
        rj(e);
      }
    });
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

function decrypt(file, key, cipher = 'aes-128-ctr') {
  const pair = getKeyIV(key);
  const decipher = crypto.createDecipheriv(cipher, pair.key, pair.iv);
  return Buffer.concat([decipher.update(file), decipher.final()]);
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

  if (str.startsWith('MEGA'))
    str = str.substring('MEGA'.length);
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

async function main() {
  const metadata = await fetchMetadata(id);
  console.log('metadata', metadata);
  console.log('attributes', decryptAttributes(metadata[0].at, key));
  const file = await fetchFile(metadata[0].g);
  const data = decrypt(file, key);
  await new Promise((rs, rj) =>
    fs.writeFile(
      './output.pdf',
      data,
      err => err ? rj(err) : rs()
    )
  );
}


function folder() {
  const key = 'Vdfpuw0WGJwfhxHRgrLl9w';
  const f = {
    "h": "81QmWBzI",
    "p": "stZGHDJI",
    "u": "N7LPJB0trRA",
    "t": 0,
    "a": "eHgHF6leggr32VqF_koLEqUlkY5NPLvv_AkkbOPS9wgRId9XkhjXrybZGRVexwW2yJuC1V0i7peiCQVh881ZYg",
    "k": "stZGHDJI:bLMnw5qZRMPkHi99LoEiiuesywsuaPJZa5zjIiTpw9s",
    "s": 24,
    "ts": 1688532178
  };
  const fileKey = decryptKey(f.k.split(':')[1], key);
  console.log('fileKey', fileKey.length, fileKey);
  const fileKeyBase64 = fileKey.toString('base64');
  console.log('fileKeyBase64', fileKeyBase64);
  console.log('attributes', decryptAttributes(f.a, fileKeyBase64));

  // -> Para obtener archivo
  // en url va id carpeta
  // POST https://g.api.mega.co.nz/cs?n=gpxHhawR&domain=meganz&v=2
  //      https://eu.api.mega.co.nz/cs?n=gpxHhawR&domain=meganz&v=2
  //   [{"a":"g","g":1,"ssl":1,"n":"81QmWBzI","v":2}]
}

// main();
folder();
