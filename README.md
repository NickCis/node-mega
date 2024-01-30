# Mega

Provide a direct linking api to a mega file.

After deployment the link should be: `https://<base>/<id>:<key>/...`.

The idea is to share a folder and be able to have a direct link to the files in that folder.

For example, if the share link is the following: `https://mega.nz/folder/XXXXX#YYYYYYYYYYY`, the link to access directly to a `test.pdf` file inside that folder will be the following: `https://<base>/XXXXX:YYYYYYYYYYY/test.pdf`

## Protocol

All requests are done into the domain `https://g.api.mega.co.nz` (there is also an european one `https://eu.api.mega.co.nz`)

In case a folder is shared, the link will be something like this: `https://mega.nz/folder/xxxxxx#YYYYYY`

The `xxxxxx` is the id and the `YYYYYY` is the value to derive the key and initialization vector of the encryption algorithm.

## Getting folder metadata

In order to get the folder metadata a POST request has to be done (where `<id>` is the folder's id):

```
POST https://g.api.mega.co.nz/cs?domain=meganz&n=<id>&v=2

[{ a: 'f', c: 1, r: 1, ca: 1 }]
```

This will return an array with only one object that will have three properties (all values encripted):

 - `f`: An array with the metadata of all the files in the folder
 - `sn`
 - `st`
 - `noc`

The first element in the `f` array is the folder itself, the others are the files or folder, each element has the following properties:

 - `h`: Element id (it isn't the same as the url)
 - `p`: Parent folder id
 - `k`: Key
 - `a`: Attributes
 - `u`
 - `t`
 - `ts`

The `k` (key) property has to be decripted. This value has the format `<root id>:<key + iv>`, we are only interested in the part after the colon (`:`, it's base64 encoded), the algorithm used to decript it will be `aes-128-ecb`  without padding.

The decription key of this las `k` value will be derived from the url's key. The url's value contains the key and initialization vectors used (the iv won't be used for this particular decription, but, it will be used for other parameters). In order to define these values, will be define the `getKeyIV` function:

```typescript
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
```

For the example url key `1Z4aKXz8N493XH-UbycdDA` we'll get the following values (base64):

 - key: `1Z4aKXz8N493XH+UbycdDA==`
 - iv: `AAAAAAAAAAAAAAAAAAAAAA==`

And for an example `k=xxxx:W5u4s2V5jeGgJ1XlpKQHZw` property, it will be decripted into (base64) `i81yOuEHB0+Hpts7+PGoyQ==`. We will use this value for decripting the attributes property (`a`).


Decripting the `a` property is similar to the `k` one, we will use the value from the previous step in order to get the decrypting key (using the `getKeyIV` function). For the initialization vector we will use an empty (zero-filled) one. In this case, the encryption cipher is `aes-128-cbc` (without padding)

Following the example from the value `i81yOuEHB0+Hpts7+PGoyQ==`, we will derive the following ones (base64):

 - key: `i81yOuEHB0+Hpts7+PGoyQ==`

And the example `a=IuROkfK2qWTIZaiTXgr5yQ` will be decripted into the following `MEGA{"n":"E08"}\x00`. To get the JSON we have to remove the starting `MEGA` string and the final `\x00` (`0`) character.

## Getting file metadata

## Downloading a file

## TODO

- Implement it using webcrypto (CloudFlare and Vercel Edge don't allow using the nodejs crypto module, the Web Crypto Subtle Crypto should be used)
