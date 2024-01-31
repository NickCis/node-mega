import type { VercelRequest, VercelResponse } from '@vercel/node';
import mime from 'mime-types';
import { pipeline } from 'node:stream/promises';
import { LRUCache } from 'lru-cache';
import { Folder, File } from '../lib/node.js';

// TODO: change it into streams? https://vercel.com/docs/functions/streaming/quickstart
// Prevents this route's response from being cached
export const dynamic = 'force-dynamic';

const cache = new LRUCache({
  max: 100,
});

async function mega(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;

  if (!path) {
    res.status(404);
    res.send('Not found');
    return;
  }

  const [root, ...rest] = Array.isArray(path) ? path : path.split('/');
  let [id, key] = root.split(':');
  if (!key) {
    res.status(500);
    res.send('No key');
    return;
  }

  let file: File | undefined;

  if (rest) {
    const folder = (cache.get(id) as Folder) || new Folder(id, key);
    file = await folder.searchFile(rest);
    cache.set(id, folder);
  } else {
    file = File.fromIdKey(id, key);
  }

  if (!file) {
    res.status(404);
    res.send('Not found');
    return;
  }

  const f: File = file;

  const filename = await file.getFilename();
  const contentType = mime.lookup(filename);
  res.setHeader('Content-Type', contentType || 'application/octet-stream');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'public, immutable, max-age=31536000');
  res.status(200);

  await pipeline(
    await file.buildDownloadStream(),
    file.buildDecryptionStream(),
    res,
  );
}

export default mega;
