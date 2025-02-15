import { bufferToU8a, u8aConcat } from '@polkadot/util';
import { encodeAddress, hdLedger } from '@polkadot/util-crypto';
import { merge } from 'lodash';

import {
  Expect24WordsMnemonicError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import {
  decryptAsync,
  decryptImportedCredential,
  encryptAsync,
  mnemonicFromEntropy,
} from '../../secret';
import {
  ECoreApiExportedSecretKeyType,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImported,
  type ICoreApiGetAddressQueryPublicKey,
  type ICoreApiGetAddressesQueryHd,
  type ICoreApiGetAddressesResult,
  type ICoreApiGetExportedSecretKey,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';
import { slicePathTemplate } from '../../utils';

import { serializeMessage, serializeSignedTransaction } from './sdkDot';
import { DOT_TYPE_PREFIX } from './types';

import type { IEncodedTxDot } from './types';

const curve: ICurveName = 'ed25519';

const derivationHdLedger = (mnemonic: string, path: string) => {
  try {
    return hdLedger(mnemonic, path);
  } catch (e: any) {
    const { message }: { message: string } = e;
    if (
      message ===
      'Expected a mnemonic with 24 words (or 25 including a password)'
    ) {
      throw new Expect24WordsMnemonicError();
    }
    throw e;
  }
};

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      // networkInfo,

      password,
      keyType,
      credentials,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> dot',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      return `0x${(
        await decryptAsync({ password, data: privateKeyRaw })
      ).toString('hex')}`;
    }
    throw new Error(`SecretKey type not support: ${keyType}`);
  }

  override async baseGetPrivateKeys({
    payload,
  }: {
    payload: ICoreApiSignBasePayload;
  }): Promise<ICoreApiPrivateKeysMap> {
    const { credentials, account, password, relPaths } = payload;
    let privateKeys: ICoreApiPrivateKeysMap = {};
    if (credentials.hd) {
      const pathComponents = account.path.split('/');
      const usedRelativePaths = relPaths || [pathComponents.pop() as string];
      const basePath = pathComponents.join('/');
      const mnemonic = await mnemonicFromEntropy(credentials.hd, password);
      const keysPromised = usedRelativePaths.map(async (relPath) => {
        const path = `${basePath}/${relPath}`;

        const keyPair = derivationHdLedger(mnemonic, path);
        return {
          path,
          key: await encryptAsync({
            password,
            data: Buffer.from(keyPair.secretKey.slice(0, 32)),
          }),
        };
      });

      const keys = await Promise.all(keysPromised);

      privateKeys = keys.reduce(
        (ret, key) => ({ ...ret, [key.path]: bufferUtils.bytesToHex(key.key) }),
        {},
      );
    }
    if (credentials.imported) {
      const { privateKey: p } = await decryptImportedCredential({
        password,
        credential: credentials.imported,
      });
      const encryptPrivateKey = bufferUtils.bytesToHex(
        await encryptAsync({ password, data: p }),
      );
      privateKeys[account.path] = encryptPrivateKey;
      privateKeys[''] = encryptPrivateKey;
    }
    if (!Object.keys(privateKeys).length) {
      throw new Error('No private keys found');
    }
    return privateKeys;
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    if (!unsignedTx.rawTxUnsigned) {
      throw new Error('rawTxUnsigned is undefined');
    }
    const [signature] = await signer.sign(
      bufferUtils.toBuffer(bufferUtils.hexToBytes(unsignedTx.rawTxUnsigned)),
    );
    const txSignature = u8aConcat(
      DOT_TYPE_PREFIX.ed25519,
      bufferToU8a(signature),
    );
    const txSignatureHex = bufferUtils.bytesToHex(txSignature);
    const txid = '';
    const rawTx = await serializeSignedTransaction(
      unsignedTx.encodedTx as IEncodedTxDot,
      txSignatureHex,
    );
    return {
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx,
      signature: hexUtils.addHexPrefix(txSignatureHex),
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const { message } = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const wrapMessage = await serializeMessage(message);
    const [signature] = await signer.sign(wrapMessage);
    const txSignature = u8aConcat(
      DOT_TYPE_PREFIX.ed25519,
      bufferToU8a(signature),
    );
    return hexUtils.addHexPrefix(bufferUtils.bytesToHex(txSignature));
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = this.baseGetCurve(curve).publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey, networkInfo } = query;
    const pubKeyBytes = bufferUtils.hexToBytes(
      hexUtils.stripHexPrefix(publicKey),
    );
    return Promise.resolve({
      address: '',
      addresses: {
        [networkInfo.networkId]: encodeAddress(
          pubKeyBytes,
          +(networkInfo.addressPrefix ?? 0),
        ),
      },
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    const { template, hdCredential, password, indexes } = query;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const indexFormatted = indexes.map((index) =>
      pathSuffix.replace('{index}', index.toString()),
    );
    const mnemonic = await mnemonicFromEntropy(hdCredential, password);

    const publicKeys = indexFormatted.map((index) => {
      const path = `${pathPrefix}/${index}`;
      const keyPair = derivationHdLedger(mnemonic, path);
      return {
        path,
        pubkey: keyPair.publicKey,
      };
    });

    if (publicKeys.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get public key.');
    }

    const addresses = await Promise.all(
      publicKeys.map(async (info) => {
        const { path, pubkey } = info;
        const publicKey = bufferUtils.bytesToHex(pubkey);

        const result = await this.getAddressFromPublic({
          publicKey,
          networkInfo: query.networkInfo,
        });

        return merge({ publicKey, path }, result);
      }),
    );
    return { addresses };
  }
}
