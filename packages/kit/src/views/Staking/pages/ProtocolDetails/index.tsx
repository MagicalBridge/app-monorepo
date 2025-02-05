import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Button } from '@onekeyhq/components';
import { Page, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { BabylonTrackingAlert } from '../../components/BabylonTrackingAlert';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { ProtocolDetails } from '../../components/ProtocolDetails';
import { NoAddressWarning } from '../../components/ProtocolDetails/NoAddressWarning';
import { PortfolioSection } from '../../components/ProtocolDetails/PortfolioSection';
import { StakedValueSection } from '../../components/ProtocolDetails/StakedValueSection';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { renderStakeText } from '../../components/utils';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

import { useHandleStake, useHandleWithdraw } from './useHandleActions';
import { useHandleClaim } from './useHandleClaim';

const ProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ProtocolDetails
  >();
  const { accountId, networkId, indexedAccountId, symbol, provider, vault } =
    route.params;
  const appNavigation = useAppNavigation();
  const [stakeLoading, setStakeLoading] = useState(false);
  const { result: earnAccount, run: refreshAccount } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId,
        networkId,
        indexedAccountId,
        btcOnlyTaproot: true,
      }),
    [accountId, indexedAccountId, networkId],
  );
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolDetails({
        accountId,
        networkId,
        indexedAccountId,
        symbol,
        provider,
        vault,
      }),
    [accountId, networkId, indexedAccountId, symbol, provider, vault],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const { result: unbondingDelegationList } = usePromiseResult(
    () =>
      earnAccount?.accountAddress
        ? backgroundApiProxy.serviceStaking.getUnbondingDelegationList({
            accountAddress: earnAccount?.accountAddress,
            symbol,
            networkId,
            provider,
          })
        : Promise.resolve([]),
    [earnAccount?.accountAddress, symbol, networkId, provider],
    { watchLoading: true, initResult: [], revalidateOnFocus: true },
  );

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    void run();
  }, [refreshAccount, run]);

  const handleWithdraw = useHandleWithdraw();
  const handleStake = useHandleStake();

  const { result: trackingResp, run: refreshTracking } = usePromiseResult(
    async () => {
      if (
        provider.toLowerCase() !== EEarnProviderEnum.Babylon.toLowerCase() ||
        !earnAccount
      ) {
        return [];
      }
      const items =
        await backgroundApiProxy.serviceStaking.getBabylonTrackingItems({
          accountId: earnAccount.accountId,
          networkId: earnAccount.networkId,
        });
      return items;
    },
    [provider, earnAccount],
    { initResult: [] },
  );

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      void refreshTracking();
    }
  }, [isFocused, refreshTracking]);

  const onRefreshTracking = useCallback(async () => {
    void run();
    void refreshTracking();
  }, [run, refreshTracking]);

  const onStake = useCallback(async () => {
    await handleStake({
      details: result,
      accountId: earnAccount?.accountId,
      networkId,
      indexedAccountId,
      symbol,
      provider,
      setStakeLoading,
      onSuccess: async () => {
        if (networkUtils.isBTCNetwork(networkId)) {
          await run();
          await refreshTracking();
        }
      },
    });
  }, [
    handleStake,
    result,
    earnAccount?.accountId,
    networkId,
    indexedAccountId,
    symbol,
    provider,
    run,
    refreshTracking,
  ]);

  const onWithdraw = useCallback(async () => {
    await handleWithdraw({
      details: result,
      accountId: earnAccount?.accountId,
      networkId,
      symbol,
      provider,
      onSuccess: async () => {
        if (networkUtils.isBTCNetwork(networkId)) {
          await run();
        }
      },
    });
  }, [handleWithdraw, result, earnAccount, networkId, symbol, provider, run]);

  const handleClaim = useHandleClaim({
    accountId: earnAccount?.accountId,
    networkId,
  });
  const onClaim = useCallback(
    async (params?: {
      amount: string;
      claimTokenAddress?: string;
      isReward?: boolean;
      isMorphoClaim?: boolean;
    }) => {
      if (!result) return;
      const { amount, claimTokenAddress, isReward, isMorphoClaim } =
        params ?? {};
      let claimTokenInfo = { token: result.token.info, amount: amount ?? '0' };
      if (claimTokenAddress) {
        const rewardToken = result.rewardAssets?.[claimTokenAddress];
        if (!rewardToken) {
          throw new Error('Reward token not found');
        }
        claimTokenInfo = { token: rewardToken.info, amount: amount ?? '0' };
      }
      await handleClaim({
        symbol,
        provider,
        claimAmount: claimTokenInfo.amount,
        claimTokenAddress,
        isReward,
        isMorphoClaim,
        details: result,
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({
            providerName: result.provider.name,
          }),
          protocolLogoURI: result.provider.logoURI,
          receive: claimTokenInfo,
          tags: [buildLocalTxStatusSyncId(result)],
        },
      });
    },
    [handleClaim, result, symbol, provider],
  );

  const onPortfolioDetails = useMemo(
    () =>
      networkUtils.isBTCNetwork(networkId) && earnAccount?.accountId
        ? () => {
            appNavigation.push(EModalStakingRoutes.PortfolioDetails, {
              accountId: earnAccount?.accountId,
              networkId,
              symbol,
              provider,
            });
          }
        : undefined,
    [appNavigation, earnAccount?.accountId, networkId, symbol, provider],
  );

  const onHistory = useMemo(() => {
    if (!result?.earnHistoryEnable || !earnAccount?.accountId) {
      return undefined;
    }
    return () => {
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: buildLocalTxStatusSyncId(result),
        morphoVault: vault,
      });
    };
  }, [
    appNavigation,
    earnAccount?.accountId,
    networkId,
    symbol,
    provider,
    vault,
    result,
  ]);

  const intl = useIntl();
  const media = useMedia();

  const disableStakeButton = useMemo(
    () => !(result?.provider.buttonStake ?? true),
    [result?.provider.buttonStake],
  );

  const disableUnstakeButton = useMemo(
    () => !(result?.provider.buttonUnstake ?? true),
    [result?.provider.buttonUnstake],
  );

  const stakeButtonProps = useMemo<ComponentProps<typeof Button>>(
    () => ({
      variant: 'primary',
      loading: stakeLoading,
      onPress: onStake,
      disabled: !earnAccount?.accountAddress || disableStakeButton,
    }),
    [stakeLoading, onStake, earnAccount?.accountAddress, disableStakeButton],
  );

  const withdrawButtonProps = useMemo<ComponentProps<typeof Button>>(
    () => ({
      onPress: onWithdraw,
      disabled:
        !earnAccount?.accountAddress ||
        !(Number(result?.active) > 0 || Number(result?.overflow) > 0) ||
        disableUnstakeButton,
    }),
    [
      onWithdraw,
      earnAccount?.accountAddress,
      result?.active,
      result?.overflow,
      disableUnstakeButton,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_symbol },
          {
            'symbol': networkUtils.isBTCNetwork(networkId)
              ? `${symbol} (Taproot)`
              : symbol,
          },
        )}
      />
      <Page.Body px="$5" pb="$5" gap="$8">
        <PageFrame
          LoadingSkeleton={OverviewSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          <ProtocolDetails details={result}>
            {earnAccount?.accountAddress ? (
              <>
                <StakedValueSection
                  details={result}
                  stakeButtonProps={stakeButtonProps}
                  withdrawButtonProps={withdrawButtonProps}
                  alerts={result?.provider.alerts}
                />
                <PortfolioSection
                  details={result}
                  onClaim={onClaim}
                  onWithdraw={onWithdraw}
                  onPortfolioDetails={onPortfolioDetails}
                  unbondingDelegationList={unbondingDelegationList}
                />
                {trackingResp.length > 0 ? (
                  <BabylonTrackingAlert
                    accountId={earnAccount.accountId}
                    networkId={networkId}
                    provider={provider}
                    symbol={symbol}
                    onRefresh={onRefreshTracking}
                  />
                ) : null}
              </>
            ) : (
              <NoAddressWarning
                accountId={accountId}
                networkId={networkId}
                indexedAccountId={indexedAccountId}
                onCreateAddress={onCreateAddress}
              />
            )}
          </ProtocolDetails>
          {!media.gtMd ? (
            <Page.Footer
              onConfirmText={intl.formatMessage({
                id: renderStakeText(provider),
              })}
              confirmButtonProps={stakeButtonProps}
              onCancelText={intl.formatMessage({
                id: ETranslations.global_withdraw,
              })}
              cancelButtonProps={withdrawButtonProps}
            />
          ) : null}
          {result ? (
            <StakingTransactionIndicator
              accountId={earnAccount?.accountId ?? ''}
              networkId={networkId}
              stakeTag={buildLocalTxStatusSyncId(result)}
              onRefresh={run}
              onPress={onHistory}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

function ProtocolDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ProtocolDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default ProtocolDetailsPageWithProvider;
