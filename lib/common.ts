import type { MegaRequest } from './types';

export const MegaAPI = 'https://g.api.mega.co.nz'; // https://eu.api.mega.co.nz

export function buildFolderMetadataRequest(id: string): MegaRequest {
  return {
    method: 'POST',
    url: `${MegaAPI}/cs?domain=meganz&n=${id}&v=2`,
    body: JSON.stringify([{ a: 'f', c: 1, r: 1, ca: 1 }]),
    headers: {
      'Content-type': 'application/json',
    },
  };
}

export function buildFileMetadataRequest(
  id: string,
  folder?: string,
): MegaRequest {
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
      url: `${MegaAPI}/cs?domain=meganz&n=${folder}`,
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
    url: `${MegaAPI}/cs?domain=meganz`,
  };
}
