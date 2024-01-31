export interface MegaRequestGET {
  method: 'GET';
  url: string;
  headers?: Record<string, string>;
}

export interface MegaRequestPOST {
  method: 'POST';
  url: string;
  headers?: Record<string, string>;
  body: string;
}

export type MegaRequest = MegaRequestGET | MegaRequestPOST;

export interface MegaFolderMetadataFile {
  h: string; // id
  p: string; // Parent folder
  a: string; // Attributes
  k: string; // Key
}

export interface MegaFolderMetadata {
  f: MegaFolderMetadataFile[];
}

export interface MegaFileMetadata {
  at: string; // attributes
  g: string; // download url
  s: number; // size
}
