import type { IBadgeType } from '@onekeyhq/components';
import type { IEncodedTx, IUnsignedMessage } from '@onekeyhq/core/src/types';

import type { IAccountNFT } from './nft';
import type { IToken, ITokenFiat } from './token';

export enum EParseTxComponentType {
  Default = 'default',
  Network = 'network',
  Address = 'address',
  NFT = 'nft',
  Amount = 'amount',
  Token = 'token',
  Assets = 'assets',
  Approve = 'tokenApproval',
  Divider = 'divider',
  InternalAssets = 'internalAssets',
  DateTime = 'datetime',
}

export enum EParseTxType {
  Unknown = 'unknown',
}

export enum EParseMessageType {
  Permit = 'permit',
}

export enum EParseTxDateTimeFormat {
  Duration = 'duration',
}

export interface IDisplayComponentDateTime {
  type: EParseTxComponentType.DateTime;
  label: string;
  value: number;
  format: string;
}

export interface IDisplayComponentDivider {
  type: EParseTxComponentType.Divider;
}

export interface IDisplayComponentNetwork {
  type: EParseTxComponentType.Network;
  label: string;
  networkId: string;
}

export interface IDisplayComponentAddress {
  type: EParseTxComponentType.Address;
  label: string;
  address: string;
  tags: {
    value: string;
    displayType: IBadgeType;
  }[];
  isNavigable?: boolean;
}

export interface IDisplayComponentAmount {
  type: EParseTxComponentType.Amount;
  label: string;
  amount: string;
}

export interface IDisplayComponentNFT {
  type: EParseTxComponentType.NFT;
  label: string;
  nft: IAccountNFT;
  amount: string;
}

export interface IDisplayComponentToken {
  type: EParseTxComponentType.Token;
  label: string;
  token: {
    info: IToken;
  } & ITokenFiat;
  amount: string;
  amountParsed: string;
  networkId: string;
  showNetwork: boolean;
}

export interface IDisplayComponentAssets {
  type: EParseTxComponentType.Assets;
  label: string;
  assets: (
    | IDisplayComponentInternalAssets
    | IDisplayComponentNFT
    | IDisplayComponentToken
  )[];
}

export interface IDisplayComponentInternalAssets {
  type: EParseTxComponentType.InternalAssets;
  label: string;
  name: string;
  icon: string;
  symbol: string;
  amount: string;
  amountParsed: string;
  networkId?: string;
  isNFT?: boolean;
}

export interface IDisplayComponentApprove {
  type: EParseTxComponentType.Approve;
  label: string;
  token: {
    info: IToken;
  } & ITokenFiat;
  amount?: string;
  amountParsed: string;
  balance?: string;
  balanceParsed?: string;
  isEditable: boolean;
  isInfiniteAmount: boolean;
  networkId: string;
  showNetwork: boolean;
}

export interface IDisplayComponentDefault {
  type: EParseTxComponentType.Default;
  label: string;
  value: string;
}

export type IDisplayComponent =
  | IDisplayComponentDivider
  | IDisplayComponentAssets
  | IDisplayComponentInternalAssets
  | IDisplayComponentToken
  | IDisplayComponentApprove
  | IDisplayComponentNFT
  | IDisplayComponentNetwork
  | IDisplayComponentAddress
  | IDisplayComponentDateTime
  | IDisplayComponentDefault;

export interface ITransactionData {
  name: string;
  args: string[];
  textSignature: string;
  hexSignature: string;
}

export interface ISignatureConfirmDisplay {
  title: string;
  components: IDisplayComponent[];
  alerts: string[];
}

export interface IParseTransactionParams {
  networkId: string;
  accountId: string;
  encodedTx: IEncodedTx;
  accountAddress?: string;
}

export interface IParseTransactionResp {
  accountAddress: string;
  parsedTx: {
    to: {
      address: string;
      name: null | string;
      labels: null | string[];
      isContract: boolean;
      riskLevel: number;
    };
    data: ITransactionData;
  };
  display: ISignatureConfirmDisplay;
  type: EParseTxType;
}

export interface IParseMessageParams {
  accountId: string;
  networkId: string;
  accountAddress?: string;
  message: string;
}

export interface IParseMessageResp {
  accountAddress: string;
  display: ISignatureConfirmDisplay;
  type: EParseTxType;
}
