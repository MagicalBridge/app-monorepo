import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  ESwapProviderSort,
  swapProviderRecommendApprovedWeights,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ESwapDirectionType,
  ESwapRateDifferenceUnit,
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapAutoSlippageSuggestedValue,
  ISwapNetwork,
  ISwapToken,
  ISwapTokenCatch,
  ISwapTokenMetadata,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { createJotaiContext } from '../../utils/createJotaiContext';

import type { IAccountSelectorActiveAccountInfo } from '../accountSelector';

const {
  Provider: ProviderJotaiContextSwap,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextSwap, contextAtomMethod };

// swap bridge limit switch
export const { atom: swapTypeSwitchAtom, use: useSwapTypeSwitchAtom } =
  contextAtom<ESwapTabSwitchType>(ESwapTabSwitchType.SWAP);

// swap networks & tokens
export const { atom: swapNetworks, use: useSwapNetworksAtom } = contextAtom<
  ISwapNetwork[]
>([]);

export const {
  atom: swapNetworksIncludeAllNetworkAtom,
  use: useSwapNetworksIncludeAllNetworkAtom,
} = contextAtomComputed<ISwapNetwork[]>((get) => {
  let networks = get(swapNetworks());
  const swapType = get(swapTypeSwitchAtom());
  networks = networks.filter((net) =>
    swapType === ESwapTabSwitchType.BRIDGE
      ? net.supportCrossChainSwap
      : net.supportSingleSwap,
  );
  const allNetwork = {
    networkId: getNetworkIdsMap().onekeyall,
    name: dangerAllNetworkRepresent.name,
    symbol: dangerAllNetworkRepresent.symbol,
    logoURI: dangerAllNetworkRepresent.logoURI,
    shortcode: dangerAllNetworkRepresent.shortcode,
    isAllNetworks: true,
  };
  return [allNetwork, ...networks];
});

export const { atom: swapTokenMapAtom, use: useSwapTokenMapAtom } =
  contextAtom<{
    updatedAt: number;
    tokenCatch?: Record<string, ISwapTokenCatch>;
  }>({
    updatedAt: 0,
  });

export const { atom: swapTokenFetchingAtom, use: useSwapTokenFetchingAtom } =
  contextAtom<boolean>(false);

// swap account
export const {
  atom: swapToAnotherAccountAddressAtom,
  use: useSwapToAnotherAccountAddressAtom,
} = contextAtom<{
  networkId: string | undefined;
  address: string | undefined;
  accountInfo: IAccountSelectorActiveAccountInfo | undefined;
}>({ networkId: undefined, address: undefined, accountInfo: undefined });

// swap select token
export const {
  atom: swapSelectFromTokenAtom,
  use: useSwapSelectFromTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export const { atom: swapSelectToTokenAtom, use: useSwapSelectToTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

export const {
  atom: swapSwapModalSelectFromTokenAtom,
  use: useSwapModalSelectFromTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export const {
  atom: swapSwapModalSelectToTokenAtom,
  use: useSwapModalSelectToTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export const {
  atom: swapFromTokenAmountAtom,
  use: useSwapFromTokenAmountAtom,
} = contextAtom<string>('');

export const {
  atom: swapSelectedFromTokenBalanceAtom,
  use: useSwapSelectedFromTokenBalanceAtom,
} = contextAtom('');

export const {
  atom: swapSelectedToTokenBalanceAtom,
  use: useSwapSelectedToTokenBalanceAtom,
} = contextAtom('');

export const {
  atom: swapAllNetworkTokenListMapAtom,
  use: useSwapAllNetworkTokenListMapAtom,
} = contextAtom<Record<string, ISwapToken[]>>({});

export const {
  atom: swapAllNetworkActionLockAtom,
  use: useSwapAllNetworkActionLockAtom,
} = contextAtom<boolean>(false);

// swap quote
export const {
  atom: swapManualSelectQuoteProvidersAtom,
  use: useSwapManualSelectQuoteProvidersAtom,
} = contextAtom<IFetchQuoteResult | undefined>(undefined);

export const { atom: swapQuoteListAtom, use: useSwapQuoteListAtom } =
  contextAtom<IFetchQuoteResult[]>([]);

export const { atom: swapProviderSortAtom, use: useSwapProviderSortAtom } =
  contextAtom<ESwapProviderSort>(ESwapProviderSort.RECOMMENDED);

export const {
  atom: swapQuoteActionLockAtom,
  use: useSwapQuoteActionLockAtom,
} = contextAtom<{
  actionLock: boolean;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  accountId?: string;
  address?: string;
}>({ actionLock: false });

export const {
  atom: swapQuoteIntervalCountAtom,
  use: useSwapQuoteIntervalCountAtom,
} = contextAtom<number>(0);

export const {
  atom: swapQuoteEventTotalCountAtom,
  use: useSwapQuoteEventTotalCountAtom,
} = contextAtom<{ eventId?: string; count: number }>({
  count: 0,
});

export const {
  atom: swapShouldRefreshQuoteAtom,
  use: useSwapShouldRefreshQuoteAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapSortedQuoteListAtom,
  use: useSwapSortedQuoteListAtom,
} = contextAtomComputed<IFetchQuoteResult[]>((get) => {
  const list = get(swapQuoteListAtom());
  const fromTokenAmount = get(swapFromTokenAmountAtom());
  const fromTokenAmountBN = new BigNumber(fromTokenAmount);
  const sortType = get(swapProviderSortAtom());
  const resetList: IFetchQuoteResult[] = list.map(
    (item: IFetchQuoteResult) => ({
      ...item,
      receivedBest: false,
      isBest: false,
      minGasCost: false,
    }),
  );
  let sortedList = [...resetList];
  const gasFeeSorted = resetList.slice().sort((a, b) => {
    const aBig = new BigNumber(a.fee?.estimatedFeeFiatValue || Infinity);
    const bBig = new BigNumber(b.fee?.estimatedFeeFiatValue || Infinity);
    return aBig.comparedTo(bBig);
  });
  if (sortType === ESwapProviderSort.GAS_FEE) {
    sortedList = [...gasFeeSorted];
  }
  if (sortType === ESwapProviderSort.SWAP_DURATION) {
    sortedList = resetList.slice().sort((a, b) => {
      const aVal = new BigNumber(a.estimatedTime || Infinity);
      const bVal = new BigNumber(b.estimatedTime || Infinity);
      return aVal.comparedTo(bVal);
    });
  }
  const receivedSorted = resetList.slice().sort((a, b) => {
    const aVal = new BigNumber(a.toAmount || 0);
    const bVal = new BigNumber(b.toAmount || 0);
    // Check if limit exists for a and b
    const aHasLimit = !!a.limit;
    const bHasLimit = !!b.limit;

    if (aVal.isZero() && bVal.isZero() && aHasLimit && !bHasLimit) {
      return -1;
    }

    if (aVal.isZero() && bVal.isZero() && bHasLimit && !aHasLimit) {
      return 1;
    }

    if (
      aVal.isZero() ||
      aVal.isNaN() ||
      fromTokenAmountBN.lt(new BigNumber(a.limit?.min || 0)) ||
      fromTokenAmountBN.gt(new BigNumber(a.limit?.max || Infinity))
    ) {
      return 1;
    }
    if (
      bVal.isZero() ||
      bVal.isNaN() ||
      fromTokenAmountBN.lt(new BigNumber(b.limit?.min || 0)) ||
      fromTokenAmountBN.gt(new BigNumber(b.limit?.max || Infinity))
    ) {
      return -1;
    }
    return bVal.comparedTo(aVal);
  });
  let recommendedSorted = receivedSorted.slice();
  const recommendedSortedApproved = recommendedSorted.filter(
    (item) =>
      !item.allowanceResult && item.toAmount && item.approvedInfo?.isApproved,
  );
  // check allowance result
  if (
    receivedSorted.length > 0 &&
    recommendedSortedApproved.length > 0 &&
    receivedSorted[0].allowanceResult
  ) {
    const recommendedSortedApprovedSorted = recommendedSortedApproved
      .slice()
      .sort((a, b) => {
        const aVal = new BigNumber(a.toAmount || 0);
        const bVal = new BigNumber(b.toAmount || 0);
        return bVal.comparedTo(aVal);
      });
    const recommendedSortedAllowanceSortedBestAmountBN = new BigNumber(
      recommendedSortedApprovedSorted[0].toAmount || 0,
    );
    const receivedSortedBestAmountBN = new BigNumber(
      receivedSorted[0].toAmount || 0,
    );
    if (
      recommendedSortedAllowanceSortedBestAmountBN
        .multipliedBy(swapProviderRecommendApprovedWeights)
        .gt(receivedSortedBestAmountBN)
    ) {
      recommendedSorted = recommendedSorted.filter(
        (item) => item.quoteId !== recommendedSortedApprovedSorted[0].quoteId,
      );
      recommendedSorted = [
        recommendedSortedApprovedSorted[0],
        ...recommendedSorted,
      ];
    }
  }

  if (sortType === ESwapProviderSort.RECEIVED) {
    sortedList = [...receivedSorted];
  }
  if (sortType === ESwapProviderSort.RECOMMENDED) {
    sortedList = [...recommendedSorted];
  }
  sortedList = sortedList.slice().sort((a, b) => {
    if (a.limit && b.limit) {
      const aMin = new BigNumber(a.limit?.min || 0);
      const aMax = new BigNumber(a.limit?.max || 0);
      const bMin = new BigNumber(b.limit?.min || 0);
      const bMax = new BigNumber(b.limit?.max || 0);
      if (aMin.lt(bMin)) {
        return -1;
      }
      if (aMin.gt(bMin)) {
        return 1;
      }

      if (aMax.lt(bMax)) {
        return -1;
      }
      if (aMax.gt(bMax)) {
        return 1;
      }
    }
    return 0;
  });
  return sortedList.map((p) => {
    if (p.quoteId === recommendedSorted?.[0]?.quoteId && p.toAmount) {
      p.isBest = true;
    }
    if (p.quoteId === receivedSorted?.[0]?.quoteId && p.toAmount) {
      p.receivedBest = true;
    }
    if (p.quoteId === gasFeeSorted?.[0]?.quoteId && p.toAmount) {
      p.minGasCost = true;
    }
    return p;
  });
});

export const {
  atom: swapQuoteCurrentSelectAtom,
  use: useSwapQuoteCurrentSelectAtom,
} = contextAtomComputed((get) => {
  const list = get(swapSortedQuoteListAtom());
  const manualSelectQuoteProviders = get(swapManualSelectQuoteProvidersAtom());
  const manualSelectQuoteResult = list.find(
    (item) =>
      item.info.provider === manualSelectQuoteProviders?.info.provider &&
      item.info.providerName === manualSelectQuoteProviders?.info.providerName,
  );
  if (manualSelectQuoteProviders && manualSelectQuoteResult?.toAmount) {
    return manualSelectQuoteResult;
  }
  if (list?.length > 0) {
    if (
      manualSelectQuoteProviders &&
      !manualSelectQuoteProviders?.unSupportReceiveAddressDifferent
    ) {
      return list.find((item) => !item.unSupportReceiveAddressDifferent);
    }
    return list[0];
  }
  return undefined;
});

export const { atom: swapTokenMetadataAtom, use: useSwapTokenMetadataAtom } =
  contextAtomComputed<{
    swapTokenMetadata?: ISwapTokenMetadata;
  }>((get) => {
    const quoteList = get(swapQuoteListAtom());
    const swapTokenMetadata = quoteList.find(
      (item) => item.tokenMetadata,
    )?.tokenMetadata;
    return {
      swapTokenMetadata,
    };
  });

export const { atom: swapQuoteFetchingAtom, use: useSwapQuoteFetchingAtom } =
  contextAtom<boolean>(false);

export const {
  atom: swapSelectTokenDetailFetchingAtom,
  use: useSwapSelectTokenDetailFetchingAtom,
} = contextAtom<Record<ESwapDirectionType, boolean>>({
  'from': false,
  'to': false,
});

export const {
  atom: swapSilenceQuoteLoading,
  use: useSwapSilenceQuoteLoading,
} = contextAtom<boolean>(false);

export const {
  atom: swapProviderSupportReceiveAddressAtom,
  use: useSwapProviderSupportReceiveAddressAtom,
} = contextAtomComputed((get) => {
  const quoteResult = get(swapQuoteCurrentSelectAtom());
  if (!quoteResult) {
    return true;
  }
  return (
    !quoteResult.unSupportReceiveAddressDifferent && !quoteResult.isWrapped
  );
});

// swap state
export const { atom: swapAlertsAtom, use: useSwapAlertsAtom } = contextAtom<{
  states: ISwapAlertState[];
  quoteId: string;
}>({ states: [], quoteId: '' });

export const { atom: rateDifferenceAtom, use: useRateDifferenceAtom } =
  contextAtom<{ value: string; unit: ESwapRateDifferenceUnit } | undefined>(
    undefined,
  );

// swap approve
export const {
  atom: swapQuoteApproveAllowanceUnLimitAtom,
  use: useSwapQuoteApproveAllowanceUnLimitAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapApproveAllowanceSelectOpenAtom,
  use: useSwapApproveAllowanceSelectOpenAtom,
} = contextAtom<boolean>(false);

// swap slippage
export const {
  atom: swapAutoSlippageSuggestedValueAtom,
  use: useSwapAutoSlippageSuggestedValueAtom,
} = contextAtom<ISwapAutoSlippageSuggestedValue | undefined>(undefined);

export const {
  atom: swapSlippageDialogOpeningAtom,
  use: useSwapSlippageDialogOpeningAtom,
} = contextAtom<{ status: boolean; flag?: string }>({ status: false });

// swap build_tx
export const {
  atom: swapBuildTxFetchingAtom,
  use: useSwapBuildTxFetchingAtom,
} = contextAtom<boolean>(false);
