import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { DEFAULT_VERIFY_STRING } from '@onekeyhq/shared/src/consts/dbConsts';
import { InvalidMnemonic } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver } from './bip32';
import {
  mnemonicToRevealableSeed,
  mnemonicToSeedSync,
  revealEntropyToMnemonic,
  validateMnemonic,
} from './bip39';
import { ed25519, nistp256, secp256k1 } from './curves';
import {
  decryptAsync,
  encryptAsync,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
} from './encryptors/aes256';
import { hash160 } from './hash';
import ecc from './nobleSecp256k1Wrapper';
import {
  tonMnemonicToRevealableSeed,
  tonRevealEntropyToMnemonic,
} from './ton-mnemonic';

import type {
  IBip32ExtendedKey,
  IBip32ExtendedKeySerialized,
  IBip32KeyDeriver,
} from './bip32';
import type {
  IBip39RevealableSeed,
  IBip39RevealableSeedEncryptHex,
} from './bip39';
import type { BaseCurve } from './curves';
import type {
  ICoreHdCredentialEncryptHex,
  ICoreImportedCredential,
  ICoreImportedCredentialEncryptHex,
  ICurveName,
} from '../types';

export * from './bip32';
export * from './bip340';
export * from './bip39';
export * from './curves';
export * from './encryptors/aes256';
export * from './encryptors/rsa';
export * from './hash';
export * from './ton-mnemonic';
export { ecc };

export enum EMnemonicType {
  BIP39 = 'bip39',
  TON = 'ton',
}

const EncryptPrefixImportedCredential = '|PK|'; // private key
const EncryptPrefixHdCredential = '|RP|'; // recovery phrase
const EncryptPrefixVerifyString = '|VS|'; // verify string

const curves: Map<ICurveName, BaseCurve> = new Map([
  ['secp256k1', secp256k1],
  ['nistp256', nistp256],
  ['ed25519', ed25519],
]);
const derivers: Map<ICurveName, IBip32KeyDeriver> = new Map([
  [
    'secp256k1',
    new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    ) as IBip32KeyDeriver,
  ],
  [
    'nistp256',
    new BaseBip32KeyDeriver(
      Buffer.from('Nist256p1 seed'),
      nistp256,
    ) as IBip32KeyDeriver,
  ],
  [
    'ed25519',
    new ED25519Bip32KeyDeriver(
      Buffer.from('ed25519 seed'),
      ed25519,
    ) as IBip32KeyDeriver,
  ],
]);

function getCurveByName(curveName: ICurveName): BaseCurve {
  const curve: BaseCurve | undefined = curves.get(curveName);
  if (curve === undefined) {
    throw Error(`Curve ${curveName} is not supported.`);
  }
  return curve;
}

function getDeriverByCurveName(curveName: ICurveName): IBip32KeyDeriver {
  const deriver: IBip32KeyDeriver | undefined = derivers.get(curveName);
  if (deriver === undefined) {
    throw Error(`Key derivation is not supported for curve ${curveName}.`);
  }
  return deriver;
}

function verify(
  curveName: ICurveName,
  publicKey: Buffer,
  digest: Buffer,
  signature: Buffer,
): boolean {
  return getCurveByName(curveName).verify(publicKey, digest, signature);
}

async function sign(
  curveName: ICurveName,
  encryptedPrivateKey: Buffer,
  digest: Buffer,
  password: string,
): Promise<Buffer> {
  const decryptedPrivateKey = await decryptAsync({
    password,
    data: encryptedPrivateKey,
  });
  return getCurveByName(curveName).sign(decryptedPrivateKey, digest);
}

async function publicFromPrivate(
  curveName: ICurveName,
  encryptedPrivateKey: Buffer,
  password: string,
): Promise<Buffer> {
  const decryptedPrivateKey = await decryptAsync({
    password,
    data: encryptedPrivateKey,
  });
  return getCurveByName(curveName).publicFromPrivate(decryptedPrivateKey);
}

function uncompressPublicKey(curveName: ICurveName, publicKey: Buffer): Buffer {
  if (publicKey.length === 65) {
    return publicKey;
  }
  return getCurveByName(curveName).transformPublicKey(publicKey);
}

function compressPublicKey(curveName: ICurveName, publicKey: Buffer): Buffer {
  if (publicKey.length === 33) {
    return publicKey;
  }
  return getCurveByName(curveName).transformPublicKey(publicKey);
}

function fixV4VerifyStringToV5({ verifyString }: { verifyString: string }) {
  if (verifyString === DEFAULT_VERIFY_STRING) {
    return verifyString;
  }

  return (
    EncryptPrefixVerifyString +
    verifyString.replace(EncryptPrefixVerifyString, '')
  );
}

async function decryptVerifyString({
  password,
  verifyString,
}: {
  verifyString: string;
  password: string;
}) {
  const decrypted = await decryptAsync({
    password,
    data: Buffer.from(
      verifyString.replace(EncryptPrefixVerifyString, ''),
      'hex',
    ),
  });
  return decrypted.toString();
}

async function encryptVerifyString({
  password,
  addPrefixString = true,
}: {
  password: string;
  addPrefixString?: boolean;
}): Promise<string> {
  const encrypted = await encryptAsync({
    password,
    data: Buffer.from(DEFAULT_VERIFY_STRING),
  });
  return (
    (addPrefixString ? EncryptPrefixVerifyString : '') +
    encrypted.toString('hex')
  );
}

async function decryptRevealableSeed({
  rs,
  password,
}: {
  rs: IBip39RevealableSeedEncryptHex;
  password: string;
}): Promise<IBip39RevealableSeed> {
  const decrypted = await decryptAsync({
    password,
    data: rs.replace(EncryptPrefixHdCredential, ''),
  });
  const rsJsonStr = bufferUtils.bytesToUtf8(decrypted);
  return JSON.parse(rsJsonStr) as IBip39RevealableSeed;
}

async function encryptRevealableSeed({
  rs,
  password,
}: {
  rs: IBip39RevealableSeed;
  password: string;
}): Promise<IBip39RevealableSeedEncryptHex> {
  if (!rs || !rs.entropyWithLangPrefixed || !rs.seed) {
    throw new Error('Invalid seed object');
  }
  const encrypted = await encryptStringAsync({
    password,
    data: JSON.stringify(rs),
    dataEncoding: 'utf8',
  });
  return EncryptPrefixHdCredential + bufferUtils.bytesToHex(encrypted);
}

async function decryptImportedCredential({
  credential,
  password,
}: {
  credential: ICoreImportedCredentialEncryptHex;
  password: string;
}): Promise<ICoreImportedCredential> {
  const decrypted = await decryptAsync({
    password,
    data:
      typeof credential === 'string'
        ? credential.replace(EncryptPrefixImportedCredential, '')
        : credential,
  });
  const text = bufferUtils.bytesToUtf8(decrypted);
  return JSON.parse(text) as ICoreImportedCredential;
}

async function encryptImportedCredential({
  credential,
  password,
}: {
  credential: ICoreImportedCredential;
  password: string;
}): Promise<ICoreImportedCredentialEncryptHex> {
  if (!credential || !credential.privateKey) {
    throw new Error('Invalid credential object');
  }
  const encrypted = await encryptStringAsync({
    password,
    data: JSON.stringify(credential),
    dataEncoding: 'utf8',
  });
  return EncryptPrefixImportedCredential + encrypted;
}

async function batchGetKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
  type: 'public' | 'private',
): Promise<
  Array<{
    path: string;
    parentFingerPrint: Buffer;
    extendedKey: IBip32ExtendedKey;
  }>
> {
  const ret: Array<{
    path: string;
    parentFingerPrint: Buffer;
    extendedKey: IBip32ExtendedKey;
  }> = [];
  const cache: Record<
    string,
    {
      fingerPrint: Buffer | undefined;
      parentFingerPrint: Buffer;
      privkey: IBip32ExtendedKey;
    }
  > = {};

  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const { seed } = await decryptRevealableSeed({
    rs: hdCredential,
    password,
  });
  const seedBuffer: Buffer = bufferUtils.toBuffer(seed);
  let key: IBip32ExtendedKey = deriver.generateMasterKeyFromSeed(seedBuffer);

  prefix.split('/').forEach((pathComponent) => {
    if (pathComponent === 'm') {
      return;
    }
    const index = pathComponent.endsWith("'")
      ? parseInt(pathComponent.slice(0, -1), 10) + 2 ** 31
      : parseInt(pathComponent, 10);
    key = deriver.CKDPriv(key, index);
  });

  cache[prefix] = {
    fingerPrint: hash160(deriver.N(key).key).slice(0, 4),
    parentFingerPrint: Buffer.from([]),
    privkey: key,
  };

  // Process paths sequentially to maintain order and handle async operations
  for (const relPath of relPaths) {
    const pathComponents = relPath.split('/');

    let currentPath = prefix;
    let parent = cache[currentPath];

    for (const pathComponent of pathComponents) {
      currentPath = `${currentPath}/${pathComponent}`;
      if (typeof cache[currentPath] === 'undefined') {
        const index = pathComponent.endsWith("'")
          ? parseInt(pathComponent.slice(0, -1), 10) + 2 ** 31
          : parseInt(pathComponent, 10);
        const privkey = deriver.CKDPriv(parent.privkey, index);

        if (typeof parent.fingerPrint === 'undefined') {
          parent.fingerPrint = hash160(deriver.N(parent.privkey).key).slice(
            0,
            4,
          );
        }

        cache[currentPath] = {
          fingerPrint: undefined,
          parentFingerPrint: parent.fingerPrint,
          privkey,
        };
      }
      parent = cache[currentPath];
    }

    const extendedKey =
      type === 'private'
        ? {
            chainCode: cache[currentPath].privkey.chainCode,
            key: await encryptAsync({
              password,
              data: cache[currentPath].privkey.key,
            }),
          }
        : deriver.N(cache[currentPath].privkey);

    ret.push({
      path: currentPath,
      parentFingerPrint: cache[currentPath].parentFingerPrint,
      extendedKey,
    });
  }

  return ret;
}

export type ISecretPrivateKeyInfo = {
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: IBip32ExtendedKey;
};
async function batchGetPrivateKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
): Promise<ISecretPrivateKeyInfo[]> {
  return batchGetKeys(
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    'private',
  );
}

export type ISecretPublicKeyInfoSerialized = {
  path: string;
  parentFingerPrint: string;
  extendedKey: IBip32ExtendedKeySerialized;
};
export type ISecretPublicKeyInfo = {
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: IBip32ExtendedKey;
};
async function batchGetPublicKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
): Promise<ISecretPublicKeyInfo[]> {
  return batchGetKeys(
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    'public',
  );
}
export type IBatchGetPublicKeysAsyncParams = {
  curveName: ICurveName;
  hdCredential: ICoreHdCredentialEncryptHex;
  password: string;
  prefix: string;
  relPaths: Array<string>;
};
async function batchGetPublicKeysAsync(
  params: IBatchGetPublicKeysAsyncParams,
): Promise<ISecretPublicKeyInfo[]> {
  if (platformEnv.isNative) {
    const keys = await appGlobals.$webembedApiProxy.secret.batchGetPublicKeys(
      params,
    );
    return keys.map((key) => ({
      path: key.path,
      parentFingerPrint: Buffer.from(key.parentFingerPrint, 'hex'),
      extendedKey: {
        key: Buffer.from(key.extendedKey.key, 'hex'),
        chainCode: Buffer.from(key.extendedKey.chainCode, 'hex'),
      },
    }));
  }
  const { curveName, hdCredential, password, prefix, relPaths } = params;
  return batchGetPublicKeys(
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
  );
}

async function generateMasterKeyFromSeed(
  curveName: ICurveName,
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): Promise<IBip32ExtendedKey> {
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const { seed } = await decryptRevealableSeed({
    rs: hdCredential,
    password,
  });
  const seedBuffer: Buffer = bufferUtils.toBuffer(seed);
  const masterKey: IBip32ExtendedKey =
    deriver.generateMasterKeyFromSeed(seedBuffer);
  const encryptedKey = await encryptAsync({
    password,
    data: masterKey.key,
  });
  return {
    key: encryptedKey,
    chainCode: masterKey.chainCode,
  };
}

async function N(
  curveName: ICurveName,
  encryptedExtPriv: IBip32ExtendedKey,
  password: string,
): Promise<IBip32ExtendedKey> {
  if (!platformEnv.isJest) {
    ensureSensitiveTextEncoded(password);
  }
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const extPriv: IBip32ExtendedKey = {
    key: await decryptAsync({
      password,
      data: encryptedExtPriv.key,
    }),
    chainCode: encryptedExtPriv.chainCode,
  };
  return deriver.N(extPriv);
}

async function CKDPriv(
  curveName: ICurveName,
  encryptedParent: IBip32ExtendedKey,
  index: number,
  password: string,
): Promise<IBip32ExtendedKey> {
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const parent: IBip32ExtendedKey = {
    key: await decryptAsync({
      password,
      data: encryptedParent.key,
    }),
    chainCode: encryptedParent.chainCode,
  };
  const child: IBip32ExtendedKey = deriver.CKDPriv(parent, index);
  const encryptedKey = await encryptAsync({
    password,
    data: child.key,
  });
  return {
    key: encryptedKey,
    chainCode: child.chainCode,
  };
}

function CKDPub(
  curveName: ICurveName,
  parent: IBip32ExtendedKey,
  index: number,
): IBip32ExtendedKey {
  return getDeriverByCurveName(curveName).CKDPub(parent, index);
}

async function revealableSeedFromMnemonic(
  mnemonic: string,
  password: string,
  passphrase?: string,
): Promise<IBip39RevealableSeedEncryptHex> {
  const rs: IBip39RevealableSeed = mnemonicToRevealableSeed(
    mnemonic,
    passphrase,
  );
  return encryptRevealableSeed({
    rs,
    password,
  });
}

async function mnemonicFromEntropy(
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): Promise<string> {
  defaultLogger.account.secretPerf.decryptHdCredential();
  const rs: IBip39RevealableSeed = await decryptRevealableSeed({
    password,
    rs: hdCredential,
  });
  defaultLogger.account.secretPerf.decryptHdCredentialDone();

  defaultLogger.account.secretPerf.revealEntropyToMnemonic();
  const r = revealEntropyToMnemonic(
    bufferUtils.toBuffer(rs.entropyWithLangPrefixed),
  );
  defaultLogger.account.secretPerf.revealEntropyToMnemonicDone();

  return r;
}

export type IMnemonicFromEntropyAsyncParams = {
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
};
async function mnemonicFromEntropyAsync(
  params: IMnemonicFromEntropyAsyncParams,
): Promise<string> {
  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.secret.mnemonicFromEntropyAsync(params);
  }
  return Promise.resolve(
    mnemonicFromEntropy(params.hdCredential, params.password),
  );
}

export type IMnemonicToSeedAsyncParams = {
  mnemonic: string;
  passphrase?: string;
};
async function mnemonicToSeedAsync(
  params: IMnemonicToSeedAsyncParams,
): Promise<Buffer> {
  if (platformEnv.isNative) {
    const hex = await appGlobals.$webembedApiProxy.secret.mnemonicToSeedAsync(
      params,
    );
    return Buffer.from(hex, 'hex');
  }
  const isValid = validateMnemonic(params.mnemonic);
  if (!isValid) {
    throw new InvalidMnemonic();
  }
  return Promise.resolve(
    mnemonicToSeedSync(params.mnemonic, params.passphrase),
  );
}

export type IGenerateRootFingerprintHexAsyncParams = {
  curveName: ICurveName;
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
};
async function generateRootFingerprintHexAsync(
  params: IGenerateRootFingerprintHexAsyncParams,
): Promise<string> {
  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.secret.generateRootFingerprintHexAsync(
      params,
    );
  }
  const { curveName, hdCredential, password } = params;
  const masterKey = await generateMasterKeyFromSeed(
    curveName,
    hdCredential,
    password,
  );
  const publicKey = await publicFromPrivate(curveName, masterKey.key, password);
  return hash160(publicKey).slice(0, 4).toString('hex');
}

async function revealableSeedFromTonMnemonic(
  mnemonic: string,
  password: string,
): Promise<IBip39RevealableSeedEncryptHex> {
  const rs: IBip39RevealableSeed = tonMnemonicToRevealableSeed(mnemonic);
  return encryptRevealableSeed({
    rs,
    password,
  });
}

async function tonMnemonicFromEntropy(
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): Promise<string> {
  defaultLogger.account.secretPerf.decryptHdCredential();
  const rs: IBip39RevealableSeed = await decryptRevealableSeed({
    password,
    rs: hdCredential,
  });
  defaultLogger.account.secretPerf.decryptHdCredentialDone();

  defaultLogger.account.secretPerf.revealEntropyToMnemonic();
  const r = tonRevealEntropyToMnemonic(
    bufferUtils.toBuffer(rs.entropyWithLangPrefixed),
  );
  defaultLogger.account.secretPerf.revealEntropyToMnemonicDone();

  return r;
}

export {
  batchGetPrivateKeys,
  batchGetPublicKeys,
  batchGetPublicKeysAsync,
  CKDPriv,
  CKDPub,
  compressPublicKey,
  decryptImportedCredential,
  decryptRevealableSeed,
  decryptVerifyString,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
  fixV4VerifyStringToV5,
  generateMasterKeyFromSeed,
  generateRootFingerprintHexAsync,
  mnemonicFromEntropy,
  mnemonicFromEntropyAsync,
  mnemonicToSeedAsync,
  N,
  publicFromPrivate,
  revealableSeedFromMnemonic,
  revealableSeedFromTonMnemonic,
  sign,
  tonMnemonicFromEntropy,
  uncompressPublicKey,
  verify,
};
