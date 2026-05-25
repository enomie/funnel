// Path: /Users/johann/MyBrew/funnel-real/src/player/collada-zip.ts

import { unzipSync } from 'three/addons/libs/fflate.module.js';


export function colladaXmlFromBuffer(buffer: ArrayBuffer): { xml: string; innerPath: string | null } {
  const bytes = new Uint8Array(buffer);
  if (isZipArchive(bytes)) {
    const zip = unzipSync(bytes);
    const innerPath = findInnerDaePath(zip);
    if (innerPath === null) {
      throw new Error('ZIP Collada archive does not contain a .dae entry');
    }

    return {
      xml: normalizeColladaXml(new TextDecoder().decode(zip[innerPath])),
      innerPath
    };
  }

  return {
    xml: normalizeColladaXml(new TextDecoder().decode(bytes)),
    innerPath: null
  };
}

export async function fetchColladaXml(url: string): Promise<{ xml: string; innerPath: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Collada asset (${String(response.status)}): ${url}`);
  }

  return colladaXmlFromBuffer(await response.arrayBuffer());
}

function findInnerDaePath(zip: Record<string, Uint8Array>): string | null {
  const paths = Object.keys(zip).filter((path) => path.toLowerCase().endsWith('.dae'));
  if (paths.length === 0) {
    return null;
  }

  paths.sort((a, b) => a.length - b.length);
  return paths[0] ?? null;
}


function isZipArchive(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function normalizeColladaXml(xml: string): string {
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<')) {
    throw new Error('Collada payload is not XML (expected "<" at start — is the file zipped?)');
  }

  return trimmed;
}
