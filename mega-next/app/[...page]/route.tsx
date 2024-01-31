// https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// https://vercel.com/docs/functions/streaming/quickstart

import type { NextRequest } from 'next/server';
import type { IncomingMessage } from 'node:http';

import http from 'node:http';
import https from 'node:https';
import mime from 'mime-types';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import EventEmitter from 'node:events';

import { Folder, File } from '@/lib/node';

// Prevents this route's response from being cached
export const dynamic = 'force-dynamic';

function toReadableStream(
  f: (writable: Writable) => Promise<void>,
): ReadableStream {
  const emitter = new EventEmitter();
  return new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      f(
        new Writable({
          decodeStrings: false,
          async write(chunk, encoding, cb) {
            try {
              controller.enqueue(chunk);
              if ((controller.desiredSize || 0) <= 0)
                await new Promise((rs) => emitter.once('pull', rs));
            } catch (e) {
              console.trace(e);
            }
            cb();
          },
          final(cb) {
            try {
              controller.close();
            } catch (e) {
              console.trace(e);
            }
            cb();
          },
        }),
      );
    },
    pull() {
      emitter.emit('pull');
    },
  });
}

const EncodingFixes: Record<string, string> = {
  'text/vtt': 'text/vtt; charset=utf-8',
};

// This method must be named GET
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const [, root, ...rest] = url.pathname.split('/');
  let [id, key] = root.split(':');

  if (!key) return new Response('No key', { status: 400 });

  let file: File | undefined;

  if (rest) {
    const folder = new Folder(id, key);
    file = await folder.searchFile(rest);
  } else {
    file = File.fromIdKey(id, key);
  }

  if (!file) return new Response('No file', { status: 404 });
  const f: File = file;

  const filename = await file.getFilename();
  const contentType = mime.lookup(filename);

  const readable = toReadableStream(async (writable: Writable) => {
    pipeline(
      await f.buildDownloadStream(),
      f.buildDecryptionStream(),
      writable,
    );
  });

  return new Response(readable, {
    headers: {
      'Content-Type':
        EncodingFixes[contentType as string] ||
        contentType ||
        'application/octet-stream',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'public, immutable, max-age=31536000',
    },
  });
}
