import * as crypto from 'crypto';

import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import * as secp256k1 from '@noble/secp256k1';
import { bech32 } from 'bech32';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { aesCbcDecrypt, aesCbcEncrypt } from '../../../secret/crypto-functions';

import type { INostrEvent } from '../types';

export function validateEvent(event: INostrEvent): boolean {
  if (!(event instanceof Object)) return false;
  if (typeof event.kind !== 'number') return false;
  if (typeof event.content !== 'string') return false;
  if (typeof event.created_at !== 'number') return false;
  // ignore pubkey checks because if the pubkey is not set we add it to the event. same for the ID.

  if (!Array.isArray(event.tags)) return false;
  for (let i = 0; i < event.tags.length; i += 1) {
    const tag = event.tags[i];
    if (!Array.isArray(tag)) return false;
    for (let j = 0; j < tag.length; j += 1) {
      if (typeof tag[j] === 'object') return false;
    }
  }

  return true;
}

export function serializeEvent(event: INostrEvent): string {
  if (!validateEvent(event))
    throw new Error("can't serialize event with wrong or missing properties");

  // https://github.com/nostr-protocol/nips/blob/master/01.md
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

export function getEventHash(event: INostrEvent): string {
  return bufferUtils.bytesToHex(sha256(serializeEvent(event)));
}

export function signEvent(event: INostrEvent, key: string) {
  const signedEvent = schnorr.sign(getEventHash(event), key);
  return bufferUtils.bytesToHex(signedEvent);
}

export function getNip19EncodedPubkey(pubkey: string) {
  const words = bech32.toWords(Buffer.from(pubkey, 'hex'));
  return bech32.encode('npub', words, 1000);
}

export function getPrivateEncodedByNip19(privateKey: Buffer) {
  const words = bech32.toWords(privateKey);
  return bech32.encode('nsec', words, 1000);
}

export async function encrypt(
  privateKey: string,
  pubkey: string,
  plaintext: string,
): Promise<string> {
  const key = secp256k1.getSharedSecret(privateKey, `02${pubkey}`);
  const normalizedKey = key.slice(1, 33);
  const iv = crypto.randomBytes(16);

  const encrypted = aesCbcEncrypt({
    data: Buffer.from(plaintext),
    key: Buffer.from(normalizedKey),
    iv,
  });

  return `${Buffer.from(encrypted).toString('base64')}?iv=${Buffer.from(
    iv.buffer,
  ).toString('base64')}`;
}

export async function decrypt(
  privateKey: string,
  pubkey: string,
  ciphertext: string,
): Promise<string> {
  const key = secp256k1.getSharedSecret(privateKey, `02${pubkey}`);
  const [cip, iv] = ciphertext.split('?iv=');
  const normalizedKey = key.slice(1, 33);
  const decrypted = aesCbcDecrypt({
    data: Buffer.from(cip, 'base64'),
    key: Buffer.from(normalizedKey),
    iv: Buffer.from(iv, 'base64'),
  });
  return Buffer.from(decrypted).toString('utf-8');
}

export function signSchnorr(privateKey: string, sigHash: string): string {
  const signature = schnorr.sign(
    Buffer.from(bufferUtils.hexToBytes(sigHash)),
    privateKey,
  );
  const signedHex = bufferUtils.bytesToHex(signature);
  return signedHex;
}

export function validateNpub(npub: string) {
  // Check if the npub starts with 'npub'
  if (!npub.startsWith('npub')) {
    return false;
  }

  try {
    // Decode the bech32 encoded npub
    const { prefix, words } = bech32.decode(npub);
    if (prefix !== 'npub') {
      return false;
    }

    // Convert from words to bytes
    const data = bech32.fromWords(words);

    // A valid Nostr public key should be 32 bytes long
    if (data.length !== 32) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
