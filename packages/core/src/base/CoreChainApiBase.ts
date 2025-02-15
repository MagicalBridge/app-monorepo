import { merge } from 'lodash';

import type {
  IGetDefaultPrivateKeyParams,
  IGetDefaultPrivateKeyResult,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';

import {
  batchGetPrivateKeys,
  batchGetPublicKeysAsync,
  decryptAsync,
  decryptImportedCredential,
  ed25519,
  encryptAsync,
  nistp256,
  secp256k1,
} from '../secret';
import { ECoreCredentialType } from '../types';
import { slicePathTemplate } from '../utils';

import { ChainSigner } from './ChainSigner';

import type { ISigner } from './ChainSigner';
import type { ISecretPrivateKeyInfo, ISecretPublicKeyInfo } from '../secret';
import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetExportedSecretKey,
  ICoreApiGetPrivateKeysMapHdQuery,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICoreApiValidateXprvtParams,
  ICoreApiValidateXpubParams,
  ICoreCredentialsInfo,
  ICurveName,
  ISignedTxPro,
} from '../types';

export abstract class CoreChainApiBase {
  protected baseGetCurve(curveName: ICurveName) {
    switch (curveName) {
      case 'ed25519':
        return ed25519;
      case 'secp256k1':
        return secp256k1;
      case 'nistp256':
        return nistp256;
      default:
        throw new OneKeyInternalError('Unsupported curve');
    }
  }

  protected async baseCreateSigner({
    curve,
    privateKey,
    password,
  }: {
    curve: ICurveName;
    privateKey: string; // encryptedPrivateKey by password
    password: string;
  }): Promise<ISigner> {
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const privateKeyBuffer = bufferUtils.toBuffer(privateKey);
    return Promise.resolve(new ChainSigner(privateKeyBuffer, password, curve));
  }

  protected async baseGetSingleSigner({
    payload,
    curve,
  }: {
    payload: ICoreApiSignBasePayload;
    curve: ICurveName;
  }): Promise<ISigner> {
    const privateKeys = await this.getPrivateKeys(payload);
    const accountPath = payload.account.path;
    let privateKey = privateKeys[accountPath];

    // account.path is prefixPath, but privateKeys return fullPath map
    const firstRelPath = payload?.relPaths?.[0];
    if (!privateKey && firstRelPath) {
      const fullPath = [accountPath, firstRelPath].join('/');
      privateKey = privateKeys[fullPath];
    }

    if (!privateKey) {
      throw new Error(`No private key found: ${accountPath}`);
    }

    return this.baseCreateSigner({
      curve,
      privateKey,
      password: payload.password,
    });
  }

  protected async baseGetPrivateKeys({
    payload,
    curve,
  }: {
    payload: ICoreApiSignBasePayload;
    curve: ICurveName;
  }): Promise<ICoreApiPrivateKeysMap> {
    const { credentials, account, password, relPaths } = payload;
    let privateKeys: ICoreApiPrivateKeysMap = {};
    if (credentials.hd && credentials.imported) {
      throw new OneKeyInternalError(
        'getPrivateKeys ERROR: hd and imported credentials can NOT both set.',
      );
    }
    if (credentials.hd) {
      privateKeys = await this.baseGetPrivateKeysHd({
        curve,
        account,
        hdCredential: credentials.hd,
        password,
        // build account.relPaths by _getRelPathsToAddressByApi()
        relPaths,
      });
    }
    if (credentials.imported) {
      // TODO handle relPaths privateKey here
      // const { relPaths } = account;
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

  protected async baseGetPrivateKeysHd({
    curve,
    password,
    account,
    relPaths,
    hdCredential,
  }: ICoreApiGetPrivateKeysMapHdQuery & {
    curve: ICurveName;
  }): Promise<ICoreApiPrivateKeysMap> {
    const { path } = account;
    const pathComponents = path.split('/');
    const usedRelativePaths = relPaths || [pathComponents.pop() as string];
    const basePath = pathComponents.join('/');

    if (usedRelativePaths.length === 0) {
      throw new OneKeyInternalError(
        'getPrivateKeysHd ERROR: relPaths is empty.',
      );
    }

    const keys = await batchGetPrivateKeys(
      curve,
      hdCredential,
      password,
      basePath,
      usedRelativePaths,
    );
    const map: ICoreApiPrivateKeysMap = keys.reduce((ret, key) => {
      const result: ICoreApiPrivateKeysMap = {
        ...ret,
        [key.path]: bufferUtils.bytesToHex(key.extendedKey.key),
      };
      return result;
    }, {} as ICoreApiPrivateKeysMap);
    return map;
  }

  protected async baseGetAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
    options: {
      curve: ICurveName;
      generateFrom?: 'publicKey' | 'privateKey';
    },
  ): Promise<ICoreApiGetAddressesResult> {
    const { curve, generateFrom } = options;
    const { template, hdCredential, password, indexes } = query;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const indexFormatted = indexes.map((index) =>
      pathSuffix.replace('{index}', index.toString()),
    );
    const isPrivateKeyMode = generateFrom === 'privateKey';
    let pubkeyInfos: ISecretPublicKeyInfo[] = [];
    let pvtkeyInfos: ISecretPrivateKeyInfo[] = [];

    if (isPrivateKeyMode) {
      pvtkeyInfos = await batchGetPrivateKeys(
        curve,
        hdCredential,
        password,
        pathPrefix,
        indexFormatted,
      );
    } else {
      pubkeyInfos = await batchGetPublicKeysAsync({
        curveName: curve,
        hdCredential,
        password,
        prefix: pathPrefix,
        relPaths: indexFormatted,
      });
    }
    const infos = isPrivateKeyMode ? pvtkeyInfos : pubkeyInfos;
    if (infos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    const addresses = await Promise.all(
      infos.map(async (info: ISecretPublicKeyInfo | ISecretPrivateKeyInfo) => {
        const {
          path,
          extendedKey: { key },
        } = info;
        let publicKey: string | undefined;
        let result: ICoreApiGetAddressItem | undefined;

        if (isPrivateKeyMode) {
          const privateKeyRaw = bufferUtils.bytesToHex(
            await decryptAsync({ password, data: key }),
          );
          result = await this.getAddressFromPrivate({
            networkInfo: query.networkInfo,
            privateKeyRaw,
            privateKeyInfo: info,
          });
        } else {
          publicKey = key.toString('hex');
          result = await this.getAddressFromPublic({
            networkInfo: query.networkInfo,
            publicKey,
            publicKeyInfo: info,
          });
        }

        return merge({ publicKey, path }, result);
      }),
    );
    return { addresses };
  }

  baseGetCredentialsType({
    credentials,
  }: {
    credentials: ICoreCredentialsInfo;
  }) {
    if (credentials.hd && credentials.imported) {
      throw new OneKeyInternalError(
        'getCredentialsType ERROR: hd and imported credentials can NOT both set.',
      );
    }
    if (credentials.hd) {
      return ECoreCredentialType.hd;
    }
    if (credentials.imported) {
      return ECoreCredentialType.imported;
    }
    throw new OneKeyInternalError(
      'getCredentialsType ERROR: no credentials found',
    );
  }

  async baseGetDefaultPrivateKey(
    params: IGetDefaultPrivateKeyParams,
  ): Promise<IGetDefaultPrivateKeyResult> {
    const privateKeysMap = await this.getPrivateKeys(params);
    const [encryptedPrivateKey] = Object.values(privateKeysMap);
    return {
      privateKeyRaw: encryptedPrivateKey,
    };
  }

  async validateXpub(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: ICoreApiValidateXpubParams,
  ): Promise<IXpubValidation> {
    throw new NotImplemented();
  }

  async validateXprvt(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: ICoreApiValidateXprvtParams,
  ): Promise<IXprvtValidation> {
    throw new NotImplemented();
  }

  // ----------------------------------------------

  // TODO getPrivateKeyByCredential

  abstract getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap>;

  abstract signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro>;

  abstract signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;

  abstract getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem>;

  abstract getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult>;

  abstract getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem>;

  abstract getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string>;
}
