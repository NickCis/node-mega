function fromBase64(str) {
  const base64 = atob(str);
  const buffer = new Uint8Array(base64.length);

  for (let i=0; i < base64.length; i++) {
    buffer[i] = base64.charCodeAt(i);
  }

  return buffer;
}

// https://gist.github.com/jonleighton/958841
function base64ArrayBuffer(arrayBuffer) {
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}

function dataToBuffer(data: number[]) {
  const buffer = new ArrayBuffer(data.length * 4);
  const view = new DataView(buffer);
  for (let i = 0; i < data.length; i++) {
    view.setUint32(i * 4, data[i],  false);
  }
  return buffer;
}

function getKeyIV(key: string) {
  const keyPlain = fromBase64(key);
  const data = [];
  const view = new DataView(keyPlain.buffer);
  const length = keyPlain.length / 4;

  for (let i = 0; i < length; i++) {
    data.push(view.getUint32(i * 4, false) >>> 0);
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

async function decrypt(cypher, key, iv, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    {
      name: cypher,
    },
    true,
    ['encrypt', 'decrypt']
  );

  return await crypto.subtle.decrypt(
    { name: cypher, iv },
    cryptoKey,
    data
  );
}

async function decryptAES128ECB(key, data) {
  const args = {
    name: 'AES-CTR',
    length: 128,
    counter: data,
  };
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    args,
    true,
    ['decrypt']
  );

  return await crypto.subtle.decrypt(
    args,
    cryptoKey,
    new Uint8Array(16),
  );
}

async function test() {
  const pair = getKeyIV('1Z4aKXz8N493XH+UbycdDA');
  window.pair = pair;
  console.log('pair', pair);
  try {
    window.output = await decryptAES128ECB(
      pair.key,
      fromBase64('W5u4s2V5jeGgJ1XlpKQHZw').buffer
    );
  } catch (e) {
    console.error(e);
  }
}

async function test2() {
  const pair = getKeyIV('1Z4aKXz8N493XH+UbycdDA');
  window.pair = pair;
  console.log('pair', pair);
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      pair.key,
      {
        name: 'AES-CBC',
        length: 128,
      },
      true,
      ['encrypt', 'decrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: pair.iv, length: 128 },
      cryptoKey,
      fromBase64('i81yOuEHB0+Hpts7+PGoyQ==').buffer,
    );
    console.log('encrypted', encrypted);
    window.encrypted = encrypted;
    const base64e = base64ArrayBuffer(encrypted);
    console.log('base64e', base64e);
    window.base64e = base64e;
  } catch (e) {
    console.error(e);
  }
}
