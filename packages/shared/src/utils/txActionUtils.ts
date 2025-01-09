import BigNumber from 'bignumber.js';
import { findIndex, isEmpty } from 'lodash';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionAssetTransfer,
  IDecodedTxActionFunctionCall,
  IDecodedTxActionTokenActivate,
  IDecodedTxActionTokenApprove,
  IDecodedTxActionUnknown,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
} from '@onekeyhq/shared/types/tx';

import { EParseTxComponentType } from '../../types/signatureConfirm';
import { EEarnLabels, type IStakingInfo } from '../../types/staking';
import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';

import type {
  IDisplayComponent,
  IDisplayComponentAddress,
  IDisplayComponentApprove,
  IDisplayComponentAssets,
  IDisplayComponentDefault,
  IDisplayComponentNetwork,
  IDisplayComponentToken,
} from '../../types/signatureConfirm';
import type { ISwapTxInfo } from '../../types/swap/types';

export function buildTxActionDirection({
  from,
  to,
  accountAddress,
}: {
  from?: string;
  to: string;
  accountAddress: string;
}) {
  const fixedFrom = from?.toLowerCase() ?? '';
  const fixedTo = to.toLowerCase();
  const fixedAccountAddress = accountAddress.toLowerCase();

  // out first for internal send
  if (fixedFrom && fixedFrom === fixedAccountAddress) {
    return EDecodedTxDirection.OUT;
  }
  if (fixedTo && fixedTo === fixedAccountAddress) {
    return EDecodedTxDirection.IN;
  }
  return EDecodedTxDirection.OTHER;
}

export function getDisplayedActions({ decodedTx }: { decodedTx: IDecodedTx }) {
  const { outputActions, actions } = decodedTx;
  return (
    (outputActions && outputActions.length ? outputActions : actions) || []
  );
}

export function mergeAssetTransferActions(actions: IDecodedTxAction[]) {
  const otherActions: IDecodedTxAction[] = [];
  let mergedAssetTransferAction: IDecodedTxAction | null = null;
  actions.forEach((action) => {
    if (
      action.type === EDecodedTxActionType.ASSET_TRANSFER &&
      action.assetTransfer
    ) {
      if (mergedAssetTransferAction) {
        if (
          mergedAssetTransferAction.assetTransfer?.from ===
            action.assetTransfer.from &&
          mergedAssetTransferAction.assetTransfer.to === action.assetTransfer.to
        ) {
          mergedAssetTransferAction.assetTransfer.sends = [
            ...mergedAssetTransferAction.assetTransfer.sends,
            ...action.assetTransfer.sends,
          ];

          mergedAssetTransferAction.assetTransfer.receives = [
            ...mergedAssetTransferAction.assetTransfer.receives,
            ...action.assetTransfer.receives,
          ];

          mergedAssetTransferAction.assetTransfer.nativeAmount = new BigNumber(
            mergedAssetTransferAction.assetTransfer.nativeAmount ?? 0,
          )
            .plus(action.assetTransfer.nativeAmount ?? 0)
            .toFixed();

          mergedAssetTransferAction.assetTransfer.nativeAmountValue =
            new BigNumber(
              mergedAssetTransferAction.assetTransfer.nativeAmountValue ?? 0,
            )
              .plus(action.assetTransfer.nativeAmountValue ?? 0)
              .toFixed();
        } else {
          otherActions.push(action);
        }
      } else {
        mergedAssetTransferAction = action;
      }
    } else {
      otherActions.push(action);
    }
  });
  return [mergedAssetTransferAction, ...otherActions].filter(Boolean);
}

export function calculateNativeAmountInActions(actions: IDecodedTxAction[]) {
  let nativeAmount = '0';
  let nativeAmountValue = '0';

  actions.forEach((item) => {
    if (item.type === EDecodedTxActionType.ASSET_TRANSFER) {
      nativeAmount = new BigNumber(nativeAmount)
        .plus(item.assetTransfer?.nativeAmount ?? 0)
        .toFixed();
      nativeAmountValue = new BigNumber(nativeAmountValue)
        .plus(item.assetTransfer?.nativeAmountValue ?? 0)
        .toFixed();
    }
  });

  return {
    nativeAmount,
    nativeAmountValue,
  };
}

export function isSendNativeTokenAction(action: IDecodedTxAction) {
  return (
    action.type === EDecodedTxActionType.ASSET_TRANSFER &&
    action.assetTransfer?.sends.every((send) => send.isNative)
  );
}

export function getTxnType({
  actions,
  swapInfo,
  stakingInfo,
}: {
  actions: IDecodedTxAction[];
  swapInfo?: ISwapTxInfo;
  stakingInfo?: IStakingInfo;
}) {
  if (
    swapInfo ||
    actions.some((action) => action.type === EDecodedTxActionType.INTERNAL_SWAP)
  ) {
    return 'swap';
  }

  if (
    stakingInfo ||
    actions.some(
      (action) => action.type === EDecodedTxActionType.INTERNAL_STAKE,
    )
  ) {
    return 'stake';
  }

  if (
    actions.some((action) => action.type === EDecodedTxActionType.TOKEN_APPROVE)
  ) {
    return 'approve';
  }

  if (
    actions.some(
      (action) => action.type === EDecodedTxActionType.ASSET_TRANSFER,
    )
  ) {
    return 'send';
  }

  if (
    actions.some((action) => action.type === EDecodedTxActionType.FUNCTION_CALL)
  ) {
    return 'function call';
  }

  return 'unknown';
}

export function getStakingActionLabel({
  stakingInfo,
}: {
  stakingInfo: IStakingInfo;
}) {
  switch (stakingInfo.label) {
    case EEarnLabels.Claim:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_claim,
      });
    case EEarnLabels.Stake:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_stake,
      });
    case EEarnLabels.Redeem:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_redeem,
      });
    case EEarnLabels.Withdraw:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_withdraw,
      });
    default:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_unknown,
      });
  }
}

export function convertAddressToSignatureConfirmAddress({
  address,
  label,
}: {
  address: string;
  label?: string;
}): IDisplayComponentAddress {
  return {
    type: EParseTxComponentType.Address,
    label:
      label ??
      appLocale.intl.formatMessage({
        id: ETranslations.copy_address_modal_title,
      }),
    address,
    tags: [],
  };
}

export function convertNetworkToSignatureConfirmNetwork({
  networkId,
  label,
}: {
  networkId: string;
  label?: string;
}): IDisplayComponentNetwork {
  return {
    type: EParseTxComponentType.Network,
    label:
      label ??
      appLocale.intl.formatMessage({
        id: ETranslations.network__network,
      }),
    networkId,
  };
}

function convertAssetTransferActionToSignatureConfirmComponent({
  action,
  unsignedTx,
}: {
  action: IDecodedTxActionAssetTransfer;
  unsignedTx: IUnsignedTxPro;
}) {
  const components: IDisplayComponent[] = [];

  const isInternalSwap = !!unsignedTx.swapInfo;
  const isInternalStake = !!unsignedTx.stakingInfo;

  action.sends.forEach((send) => {
    const assetsLabel = isInternalSwap
      ? appLocale.intl.formatMessage({
          id: ETranslations.global_pay,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.global_asset,
        });

    const assetsComponent: IDisplayComponentAssets = {
      type: EParseTxComponentType.Assets,
      label: assetsLabel,
      name: send.name,
      icon: send.icon,
      symbol: send.symbol,
      amount: '',
      amountParsed: send.amount,
      networkId: send.networkId,
      isNFT: send.isNFT,
    };

    components.push(assetsComponent);
  });

  action.receives.forEach((receive) => {
    const assetsLabel = isInternalSwap
      ? appLocale.intl.formatMessage({
          id: ETranslations.global_receive,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.global_asset,
        });

    const assetsComponent: IDisplayComponentAssets = {
      type: EParseTxComponentType.Assets,
      label: assetsLabel,
      name: receive.name,
      icon: receive.icon,
      symbol: receive.symbol,
      amount: '',
      amountParsed: receive.amount,
      networkId: receive.networkId,
      isNFT: receive.isNFT,
    };

    components.push(assetsComponent);
  });

  if (isInternalSwap && unsignedTx.swapInfo) {
    const receiveAddressComponent: IDisplayComponentAddress = {
      type: EParseTxComponentType.Address,
      label: appLocale.intl.formatMessage({
        id: ETranslations.swap_history_detail_received_address,
      }),
      address: unsignedTx.swapInfo.receivingAddress,
      tags: [],
    };

    components.push(receiveAddressComponent);
  }

  if (action.to) {
    const toAddressComponent: IDisplayComponentAddress = {
      type: EParseTxComponentType.Address,
      label:
        isInternalSwap || isInternalStake
          ? appLocale.intl.formatMessage({
              id: ETranslations.interact_with_contract,
            })
          : appLocale.intl.formatMessage({
              id: ETranslations.global_to,
            }),
      address: action.to,
      tags: [],
      navigable: isInternalSwap || isInternalStake,
    };

    components.push(toAddressComponent);
  }

  return components;
}

function convertTokenApproveActionToSignatureConfirmComponent({
  action,
  isMultiTxs,
}: {
  action: IDecodedTxActionTokenApprove;
  isMultiTxs?: boolean;
}) {
  const isRevoke = new BigNumber(action.amount).isZero();
  let approveLabel = '';

  if (isMultiTxs) {
    approveLabel = isRevoke
      ? appLocale.intl.formatMessage({
          id: ETranslations.global_revoke,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.global_approve,
        });
  } else {
    approveLabel = appLocale.intl.formatMessage({
      id: ETranslations.global_asset,
    });
  }

  const approveComponent: IDisplayComponentApprove = {
    type: EParseTxComponentType.Approve,
    label: approveLabel,
    // @ts-ignore
    token: {
      info: {
        symbol: action.symbol,
        name: action.name,
        address: action.tokenIdOnNetwork,
        isNative: false,
        decimals: action.decimals,
        logoURI: action.icon,
      },
    },
    amountParsed: action.amount,
    isEditable: !isRevoke && !isMultiTxs,
    isInfiniteAmount: action.isInfiniteAmount,
  };

  const spenderComponent: IDisplayComponentAddress | null = isMultiTxs
    ? null
    : {
        type: EParseTxComponentType.Address,
        label: isRevoke
          ? appLocale.intl.formatMessage({
              id: ETranslations.sig_revoke_from_label,
            })
          : appLocale.intl.formatMessage({
              id: ETranslations.sig_approve_to_label,
            }),
        address: action.spender,
        tags: [],
        navigable: true,
      };

  return [approveComponent, spenderComponent].filter(Boolean);
}

function convertTokenActiveActionToSignatureConfirmComponent({
  action,
}: {
  action: IDecodedTxActionTokenActivate;
}) {
  const component: IDisplayComponentToken = {
    type: EParseTxComponentType.Token,
    label: appLocale.intl.formatMessage({
      id: ETranslations.global_asset,
    }),
    // @ts-ignore
    token: {
      // @ts-ignore
      info: {
        symbol: action.symbol,
        name: action.name,
        address: action.tokenIdOnNetwork,
        decimals: action.decimals,
        logoURI: action.icon,
      },
    },
  };

  return [component];
}

function convertFunctionCallActionToSignatureConfirmComponent({
  action,
}: {
  action: IDecodedTxActionFunctionCall;
}) {
  const component: IDisplayComponentDefault = {
    type: EParseTxComponentType.Default,
    label: 'Operation',
    value: action.functionName,
  };

  const interactWithContractComponent: IDisplayComponentAddress = {
    type: EParseTxComponentType.Address,
    label: appLocale.intl.formatMessage({
      id: ETranslations.interact_with_contract,
    }),
    address: action.to,
    tags: [],
    navigable: true,
  };

  return [component, interactWithContractComponent];
}

function convertUnknownActionToSignatureConfirmComponent({
  action,
}: {
  action: IDecodedTxActionUnknown;
}) {
  const interactWithContractComponent: IDisplayComponentAddress = {
    type: EParseTxComponentType.Address,
    label: appLocale.intl.formatMessage({
      id: ETranslations.interact_with_contract,
    }),
    address: action.to,
    tags: [],
    navigable: true,
  };

  return [interactWithContractComponent];
}

export function convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
  decodedTx,
  isMultiTxs,
  unsignedTx,
}: {
  decodedTx: IDecodedTx;
  unsignedTx: IUnsignedTxPro;
  isMultiTxs?: boolean;
}): IDisplayComponent[] {
  const { actions } = decodedTx;
  const components: IDisplayComponent[] = [];

  for (const action of actions) {
    if (
      action.type === EDecodedTxActionType.ASSET_TRANSFER &&
      action.assetTransfer
    ) {
      components.push(
        ...convertAssetTransferActionToSignatureConfirmComponent({
          action: action.assetTransfer,
          unsignedTx,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.TOKEN_APPROVE &&
      action.tokenApprove
    ) {
      components.push(
        ...convertTokenApproveActionToSignatureConfirmComponent({
          action: action.tokenApprove,
          isMultiTxs,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.TOKEN_ACTIVATE &&
      action.tokenActivate
    ) {
      components.push(
        ...convertTokenActiveActionToSignatureConfirmComponent({
          action: action.tokenActivate,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.FUNCTION_CALL &&
      action.functionCall
    ) {
      components.push(
        ...convertFunctionCallActionToSignatureConfirmComponent({
          action: action.functionCall,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.UNKNOWN &&
      action.unknownAction
    ) {
      components.push(
        ...convertUnknownActionToSignatureConfirmComponent({
          action: action.unknownAction,
        }),
      );
    }
  }

  return components;
}

export function convertDecodedTxActionsToSignatureConfirmTxDisplayTitle({
  decodedTxs,
  unsignedTxs,
}: {
  decodedTxs: IDecodedTx[];
  unsignedTxs: IUnsignedTxPro[];
}) {
  const swapTxIndex = findIndex(unsignedTxs, (tx) => !!tx.swapInfo);
  const stakingTxIndex = findIndex(unsignedTxs, (tx) => !!tx.stakingInfo);

  const swapUnsignedTx = unsignedTxs[swapTxIndex];
  const stakingUnsignedTx = unsignedTxs[stakingTxIndex];

  if (swapUnsignedTx && swapUnsignedTx.swapInfo) {
    const isBridge =
      swapUnsignedTx.swapInfo.sender.accountInfo.networkId !==
      swapUnsignedTx.swapInfo.receiver.accountInfo.networkId;
    return isBridge
      ? appLocale.intl.formatMessage({
          id: ETranslations.swap_page_bridge,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.swap_page_swap,
        });
  }

  if (stakingUnsignedTx && stakingUnsignedTx.stakingInfo) {
    return getStakingActionLabel({
      stakingInfo: stakingUnsignedTx.stakingInfo,
    });
  }

  // only swap tx may have multiple txs
  const actions = decodedTxs[0].actions;

  for (const action of actions) {
    if (
      action.type === EDecodedTxActionType.ASSET_TRANSFER &&
      action.assetTransfer
    ) {
      const sends = action.assetTransfer.sends;
      const receives = action.assetTransfer.receives;

      if (!isEmpty(sends) && isEmpty(receives)) {
        return appLocale.intl.formatMessage({
          id: ETranslations.global_send,
        });
      }

      if (isEmpty(sends) && !isEmpty(receives)) {
        return appLocale.intl.formatMessage({
          id: ETranslations.global_receive,
        });
      }
    }

    if (
      action.type === EDecodedTxActionType.TOKEN_APPROVE &&
      action.tokenApprove
    ) {
      const isRevoke = new BigNumber(action.tokenApprove.amount).isZero();

      return isRevoke
        ? appLocale.intl.formatMessage({
            id: ETranslations.sig_revoke_approval_label,
          })
        : appLocale.intl.formatMessage({
            id: ETranslations.sig_approval_label,
          });
    }

    if (
      action.type === EDecodedTxActionType.FUNCTION_CALL &&
      action.functionCall
    ) {
      return appLocale.intl.formatMessage({
        id: ETranslations.transaction__contract_interaction,
      });
    }
  }

  return appLocale.intl.formatMessage({
    id: ETranslations.transaction__contract_interaction,
  });
}
