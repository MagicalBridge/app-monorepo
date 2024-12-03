/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  Deserializer,
  Ed25519PublicKey,
  Ed25519Signature,
  SignedTransaction,
  SimpleTransaction,
  TransactionAuthenticatorEd25519,
  TransactionResponseType,
} from '@aptos-labs/ts-sdk';
import { get, isEmpty } from 'lodash';

import type {
  IEncodedTxAptos,
  ISignMessagePayload,
  ISignMessageRequest,
  ITxPayload,
} from '@onekeyhq/core/src/chains/aptos/types';
import {
  InvalidAccount,
  OneKeyError,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import type { AptosClient } from './sdkAptos/AptosClient';
import type { IBuildUnsignedTxParams } from '../../types';
import type {
  AccountAddressInput,
  AnyNumber,
  EntryFunctionPayloadResponse,
  MoveFunction,
  MoveResource,
  TransactionResponse,
} from '@aptos-labs/ts-sdk';

export const APTOS_SIGN_MESSAGE_PREFIX = 'APTOS';

// Move Module
export const APTOS_COINSTORE = '0x1::coin::CoinStore';
export const APTOS_COIN_INFO = '0x1::coin::CoinInfo';

// Move Action Module
export const APTOS_PUBLISH_MODULE = '0x1::code::publish_package_txn';
/** Automatic Account Activation */
export const APTOS_NATIVE_TRANSFER_FUNC = '0x1::aptos_account::transfer';
// Transfer legacy coin & native coin, not register account
export const APTOS_NATIVE_TRANSFER_FUNC_LEGACY =
  '0x1::aptos_account::transfer_coins';

export const APTOS_TRANSFER_FUNGIBLE_FUNC =
  '0x1::primary_fungible_store::transfer';
export const APTOS_TRANSFER_FUNGIBLE_FUNC_ARG_TYPE =
  '0x1::fungible_asset::Metadata';

// Transfer legacy coin
export const APTOS_TRANSFER_FUNC = '0x1::coin::transfer';

export const APTOS_TOKEN_REGISTER = '0x1::managed_coin::register';
export const APTOS_NFT_CREATE = '0x3::token::create_token_script';
export const APTOS_COLLECTION_CREATE = '0x3::token::create_collection_script';
export const APTOS_NFT_CLAIM = '0x3::token_transfers::claim_script';

export const APTOS_NATIVE_COIN = '0x1::aptos_coin::AptosCoin';
export const DEFAULT_GAS_LIMIT_NATIVE_TRANSFER = '2000';
export const DEFAULT_GAS_LIMIT_TRANSFER = '20000';

const MAX_U64_BIG_INT = BigInt(9_007_199_254_740_991);

const POLL_INTERVAL = 2000;
type IPollFn<T> = (time?: number, index?: number) => T;

export function getTransactionTypeByPayload({
  type,
  function_name,
}: {
  type: string;
  function_name?: string;
  type_arguments?: any[];
  args?: any[];
}) {
  if (type === 'entry_function_payload') {
    if (
      function_name === APTOS_NATIVE_TRANSFER_FUNC ||
      function_name === APTOS_TRANSFER_FUNC ||
      function_name === APTOS_NATIVE_TRANSFER_FUNC_LEGACY ||
      function_name === APTOS_TRANSFER_FUNGIBLE_FUNC
    ) {
      return EDecodedTxActionType.ASSET_TRANSFER;
    }
    if (function_name === APTOS_TOKEN_REGISTER) {
      return EDecodedTxActionType.TOKEN_ACTIVATE;
    }

    // TODO NFT transfer

    return EDecodedTxActionType.FUNCTION_CALL;
  }

  return EDecodedTxActionType.UNKNOWN;
}

export function getTransactionType(
  transaction: TransactionResponse,
): EDecodedTxActionType {
  // TODO other transaction type
  switch (transaction.type) {
    case TransactionResponseType.User: {
      const payload = transaction.payload;
      const {
        type,
        function: function_name,
        type_arguments,
        arguments: args,
      } = payload as EntryFunctionPayloadResponse;
      return getTransactionTypeByPayload({
        type,
        function_name,
        type_arguments,
        args,
      });
    }

    default: {
      return EDecodedTxActionType.UNKNOWN;
    }
  }
}

export async function buildSignedTx(
  rawTxn: SimpleTransaction,
  senderPublicKey: string,
  signature: string,
) {
  const txSignature = new Ed25519Signature(
    bufferUtils.hexToBytes(hexUtils.stripHexPrefix(signature)),
  );
  const authenticator = new TransactionAuthenticatorEd25519(
    new Ed25519PublicKey(
      bufferUtils.hexToBytes(hexUtils.stripHexPrefix(senderPublicKey)),
    ),
    txSignature,
  );
  const signRawTx = new SignedTransaction(
    rawTxn.rawTransaction,
    authenticator,
  ).bcsToHex();
  return Promise.resolve({
    txid: '',
    rawTx: signRawTx.toStringWithoutPrefix(),
  });
}

export async function generateUnsignedTransaction(
  client: AptosClient,
  unsignedTx: IBuildUnsignedTxParams,
): Promise<SimpleTransaction> {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxAptos;

  const { sender } = encodedTx;
  if (!sender) {
    throw new OneKeyHardwareError(Error('sender is required'));
  }

  let rawTxn: SimpleTransaction;
  if (encodedTx.bscTxn && !isEmpty(encodedTx.bscTxn)) {
    const deserializer = new Deserializer(
      bufferUtils.hexToBytes(encodedTx.bscTxn),
    );
    rawTxn = SimpleTransaction.deserialize(deserializer);
  } else {
    const {
      sequence_number,
      max_gas_amount,
      gas_unit_price,
      expiration_timestamp_secs,
      function: func,
      arguments: args,
      type_arguments,
    } = encodedTx;

    if (!func) {
      throw new OneKeyError('generate transaction error: function is empty');
    }

    rawTxn = await client.aptos.transaction.build.simple({
      sender,
      data: {
        function: func as `${string}::${string}::${string}`,
        functionArguments: args || [],
        typeArguments: type_arguments || [],
      },
      options: {
        accountSequenceNumber: sequence_number
          ? BigInt(sequence_number)
          : undefined,
        maxGasAmount: max_gas_amount ? Number(max_gas_amount) : undefined,
        gasUnitPrice: gas_unit_price ? Number(gas_unit_price) : undefined,
        expireTimestamp: expiration_timestamp_secs
          ? Number(expiration_timestamp_secs)
          : undefined,
      },
    });
  }
  return rawTxn;
}

export function convertRpcError(error: string): OneKeyError {
  // more: https://github.com/aptos-labs/aptos-core/blob/1b3348636fd24a8eb413c34f2ebb2c76c25e10d5/developer-docs-site/docs/guides/handle-aptos-errors.md
  if (error.indexOf('EACCOUNT_DOES_NOT_EXIST') !== -1) {
    return new OneKeyInternalError(error);
  }
  if (
    error.indexOf('EINSUFFICIENT_BALANCE') !== -1 ||
    error.indexOf('INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE') !== -1
  ) {
    return new OneKeyInternalError(error);
  }

  if (error.indexOf('ECOIN_STORE_NOT_PUBLISHED') !== -1) {
    return new OneKeyInternalError(error);
  }

  if (error.indexOf('ECOLLECTION_ALREADY_EXISTS') !== -1) {
    return new OneKeyInternalError(error);
  }
  if (error.indexOf('ECOLLECTION_NOT_PUBLISHED') !== -1) {
    return new OneKeyInternalError(error);
  }

  if (error.indexOf('ETOKEN_DATA_ALREADY_EXISTS') !== -1) {
    return new OneKeyInternalError(error);
  }
  return new OneKeyError(error);
}

export function waitPendingTransaction(
  client: AptosClient,
  txHash: string,
  right = true,
  retryCount = 10,
): Promise<TransactionResponse | undefined> {
  let retry = 0;

  const poll: IPollFn<Promise<TransactionResponse | undefined>> = async (
    time = POLL_INTERVAL,
  ) => {
    retry += 1;

    let transaction: TransactionResponse | undefined;
    try {
      transaction = await client.getTransactionByHash(txHash);
    } catch (error: any) {
      if (right) {
        const { errorCode } = error;
        // ignore transaction not found
        if (errorCode !== 'transaction_not_found') {
          return Promise.reject(new OneKeyError(errorCode));
        }
      }
    }

    const success = get(transaction, 'success', undefined);
    if (success === true) {
      return Promise.resolve(transaction);
    }
    if (success === false) {
      return Promise.reject(
        convertRpcError(get(transaction, 'vm_status', undefined) ?? ''),
      );
    }
    if (retry > retryCount) {
      return Promise.reject(new OneKeyError('transaction timeout'));
    }

    return new Promise(
      (resolve: (p: Promise<TransactionResponse | undefined>) => void) =>
        setTimeout(() => resolve(poll(time)), time),
    );
  };

  return poll();
}

export async function getAccountResource(
  client: AptosClient,
  address: string,
): Promise<MoveResource[] | undefined> {
  try {
    return await client.getAccountResources(hexUtils.stripHexPrefix(address));
  } catch (error: any) {
    let err;
    try {
      err = JSON.parse(error?.message);
    } catch (e) {
      throw error;
    }
    const { error_code: errorCode } = err || {};
    if (errorCode === 'account_not_found') {
      throw new InvalidAccount(errorCode);
    }
    // TODO: handle resource not found
    if (errorCode === 'resource_not_found') {
      throw new InvalidAccount(errorCode);
    }
  }
  return Promise.resolve(undefined);
}

export async function getAccountCoinResource(
  client: AptosClient,
  address: string,
  tokenAddress?: string | undefined,
): Promise<MoveResource | undefined> {
  // The coin type to use, defaults to 0x1::aptos_coin::AptosCoin
  const typeTag = `${APTOS_COINSTORE}<${tokenAddress ?? APTOS_NATIVE_COIN}>`;
  const resources = await getAccountResource(
    client,
    hexUtils.stripHexPrefix(address),
  );
  const accountResource = resources?.find((r) => r.type === typeTag);
  return Promise.resolve(accountResource);
}

export async function getModuleAbiMap(aptosClient: AptosClient, addr: string) {
  const modules = await aptosClient.getAccountModules(addr);
  const abis = modules
    .map((module) => module.abi)
    .flatMap((abi) =>
      abi?.exposed_functions
        .filter((ef) => ef.is_entry)
        .map((ef) => ({
          fullName: `${abi.address}::${abi.name}::${ef.name}`,
          ...ef,
        })),
    );

  const abiMap = new Map<string, MoveFunction & { fullName: string }>();
  abis.forEach((abi) => {
    if (abi) {
      abiMap.set(abi.fullName, abi);
    }
  });

  return abiMap;
}

export function formatFullMessage(message: ISignMessageRequest): string {
  let fullMessage = `${APTOS_SIGN_MESSAGE_PREFIX}\n`;
  if (message.address) {
    fullMessage += `address: ${message.address}\n`;
  }
  if (message.application) {
    fullMessage += `application: ${message.application}\n`;
  }
  if (message.chainId) {
    fullMessage += `chainId: ${message.chainId}\n`;
  }
  fullMessage += `message: ${message.message}\n`;
  fullMessage += `nonce: ${message.nonce}`;

  return fullMessage;
}

export function formatSignMessageRequest(
  message: ISignMessagePayload,
  address: string,
  application: string,
  chainId: number,
): ISignMessageRequest {
  const request: ISignMessageRequest = {
    message: message.message,
    nonce: message.nonce,
    fullMessage: '',
  };

  if (message.address) {
    request.address = address;
  }
  if (message.application) {
    let host: string;
    try {
      const urlObj = new URL(application);
      host = urlObj.host;
    } catch (error) {
      host = application;
    }
    request.application = host;
  }
  if (message.chainId) {
    request.chainId = chainId;
  }

  request.fullMessage = formatFullMessage(request);

  return request;
}

export function generateRegisterToken(tokenAddress: string): ITxPayload {
  return {
    type: 'entry_function_payload',
    function: APTOS_TOKEN_REGISTER,
    arguments: [],
    type_arguments: [tokenAddress],
  };
}

export function getTokenType(tokenAddress: string): 'legacy' | 'fungible' {
  if (tokenAddress.indexOf('::') !== -1) {
    return 'legacy';
  }
  return 'fungible';
}

export function generateTransferCoin(
  to: string,
  amount: string,
  tokenAddress?: string,
): ITxPayload {
  if (tokenAddress) {
    const tokenType = getTokenType(tokenAddress);
    if (tokenType === 'fungible') {
      return {
        type: 'entry_function_payload',
        function: APTOS_TRANSFER_FUNGIBLE_FUNC,
        arguments: [tokenAddress, to, amount],
        type_arguments: [APTOS_TRANSFER_FUNGIBLE_FUNC_ARG_TYPE],
      };
    }
  }

  const typeArgs = tokenAddress ? [tokenAddress] : [APTOS_NATIVE_COIN];

  return {
    type: 'entry_function_payload',
    function: APTOS_NATIVE_TRANSFER_FUNC_LEGACY,
    arguments: [to, amount],
    type_arguments: typeArgs,
  };
}

export function generateTransferCreateCollection(
  name: string,
  description: string,
  uri: string,
  maxAmount: AnyNumber = MAX_U64_BIG_INT,
): ITxPayload {
  return {
    type: 'entry_function_payload',
    function: APTOS_COLLECTION_CREATE,
    type_arguments: [],
    arguments: [name, description, uri, maxAmount, [false, false, false]],
  };
}

export function generateTransferCreateNft(
  account: string,
  collectionName: string,
  name: string,
  description: string,
  supply: number,
  uri: string,
  max: AnyNumber = MAX_U64_BIG_INT,
  royalty_payee_address: AccountAddressInput = account,
  royalty_points_denominator = 0,
  royalty_points_numerator = 0,
  property_keys: Array<string> = [],
  property_values: Array<string> = [],
  property_types: Array<string> = [],
): ITxPayload {
  return {
    type: 'entry_function_payload',
    function: APTOS_NFT_CREATE,
    type_arguments: [],
    arguments: [
      collectionName,
      name,
      description,
      supply,
      max,
      uri,
      royalty_payee_address,
      royalty_points_denominator,
      royalty_points_numerator,
      [false, false, false, false, false],
      property_keys,
      property_values,
      property_types,
    ],
  };
}

export function getExpirationTimestampSecs(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 3 * 60);
}
