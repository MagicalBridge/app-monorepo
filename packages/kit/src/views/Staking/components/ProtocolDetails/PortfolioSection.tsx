import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPopoverProps } from '@onekeyhq/components';
import {
  Alert,
  Button,
  Divider,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type {
  IEarnRewardNum,
  IEarnTokenItem,
  IEarnUnbondingDelegationList,
  IStakeProtocolDetails,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { formatStakingDistanceToNowStrict } from '../utils';

import { ProtocolRewards } from './ProtocolRewards';

type IPortfolioItemProps = {
  tokenImageUri?: string;
  tokenSymbol: string;
  amount: string;
  statusText: string;
  onPress?: () => Promise<void> | void;
  buttonText?: string;
  tooltip?: string;
  renderTooltipContent?: IPopoverProps['renderContent'];
  disabled?: boolean;
  useLoading?: boolean;
};

const PortfolioItem = ({
  tokenImageUri,
  tokenSymbol,
  amount,
  statusText,
  onPress,
  buttonText,
  tooltip,
  renderTooltipContent,
  disabled,
  useLoading,
}: IPortfolioItemProps) => {
  const [loading, setLoading] = useState(false);
  const handlePress = useCallback(async () => {
    try {
      if (useLoading) {
        setLoading(true);
      }
      await onPress?.();
    } finally {
      if (useLoading) {
        setLoading(false);
      }
    }
  }, [onPress, useLoading]);
  return (
    <XStack minHeight={30} alignItems="center" justifyContent="space-between">
      <XStack alignItems="center" gap="$1.5">
        <Token size="sm" tokenImageUri={tokenImageUri} />
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="balance"
          formatterOptions={{ tokenSymbol }}
        >
          {amount}
        </NumberSizeableText>
        <XStack gap="$1" ai="center">
          <SizableText size="$bodyLg">{statusText}</SizableText>
        </XStack>
        {tooltip || renderTooltipContent ? (
          <Popover
            placement="top"
            title={statusText}
            renderTrigger={
              <IconButton
                iconColor="$iconSubdued"
                size="small"
                icon="InfoCircleOutline"
                variant="tertiary"
              />
            }
            renderContent={
              tooltip ? (
                <Stack p="$5">
                  <SizableText>{tooltip}</SizableText>
                </Stack>
              ) : (
                renderTooltipContent || null
              )
            }
          />
        ) : null}
      </XStack>
      {buttonText && onPress ? (
        <Button
          size="small"
          disabled={disabled}
          variant="primary"
          onPress={handlePress}
          loading={loading}
        >
          {buttonText}
        </Button>
      ) : null}
    </XStack>
  );
};

interface IUnbondingDelegationListItem {
  amount: string;
  timestampLeft: number | string;
}

type IPortfolioInfoProps = {
  token: IToken;
  active?: string;
  pendingInactive?: string;
  pendingInactivePeriod?: string;
  pendingActive?: string;
  pendingActiveTooltip?: string;
  claimable?: string;
  rewards?: string;
  rewardNum?: IEarnRewardNum;
  rewardAssets?: Record<string, IEarnTokenItem>;

  tooltipForClaimable?: string;
  labelForClaimable?: string;

  minClaimableNum?: string;
  babylonOverflow?: string;

  showDetailWithdrawalRequested: boolean;
  unbondingDelegationList?: IUnbondingDelegationListItem[];

  onClaim?: (params?: {
    amount: string;
    claimTokenAddress?: string;
    isReward?: boolean;
    isMorphoClaim?: boolean;
  }) => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
};

function PendingInactiveItem({
  pendingInactive,
  pendingInactivePeriod,
  tokenSymbol,
}: {
  pendingInactive: string | number;
  tokenSymbol: string;
  pendingInactivePeriod: string | number;
}) {
  const intl = useIntl();
  return (
    <XStack jc="space-between">
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={{ tokenSymbol }}
      >
        {pendingInactive}
      </NumberSizeableText>
      <SizableText size="$bodyLgMedium">
        {intl.formatMessage(
          {
            id: ETranslations.earn_number_days_left,
          },
          { number: pendingInactivePeriod },
        )}
      </SizableText>
    </XStack>
  );
}

function PortfolioInfo({
  token,
  active,
  pendingInactive,
  pendingActive,
  pendingActiveTooltip,
  claimable,
  rewards,
  rewardNum,
  rewardAssets,

  tooltipForClaimable,
  labelForClaimable,

  minClaimableNum,

  babylonOverflow,

  onClaim,
  onWithdraw,
  onPortfolioDetails,

  showDetailWithdrawalRequested,
  unbondingDelegationList,
}: IPortfolioInfoProps) {
  const intl = useIntl();

  const showPortfolio = useMemo(() => {
    const isPositive = (value?: string | number) =>
      new BigNumber(value || 0).isGreaterThan(0);

    const hasMultipleRewards =
      rewardNum &&
      Object.keys(rewardNum).length > 1 &&
      Object.values(rewardNum).some(
        (value) =>
          new BigNumber(value.claimableNow).isGreaterThan(0) ||
          new BigNumber(value.claimableNext).isGreaterThan(0),
      );

    return (
      [pendingInactive, claimable, pendingActive, babylonOverflow, active].some(
        isPositive,
      ) || hasMultipleRewards
    );
  }, [
    pendingInactive,
    claimable,
    pendingActive,
    babylonOverflow,
    active,
    rewardNum,
  ]);

  const isLessThanMinClaimable = Boolean(
    minClaimableNum && rewards && Number(rewards) < Number(minClaimableNum),
  );

  if (!showPortfolio) {
    return null;
  }

  return (
    <>
      <YStack gap="$6">
        <XStack justifyContent="space-between">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.earn_portfolio })}
          </SizableText>
          {onPortfolioDetails !== undefined ? (
            <Button
              variant="tertiary"
              iconAfter="ChevronRightOutline"
              onPress={onPortfolioDetails}
            >
              {intl.formatMessage({ id: ETranslations.global_details })}
            </Button>
          ) : null}
        </XStack>
        <YStack gap="$3">
          {pendingActive && Number(pendingActive) ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={pendingActive}
              tooltip={pendingActiveTooltip}
              statusText={intl.formatMessage({
                id: ETranslations.earn_pending_activation,
              })}
            />
          ) : null}
          {active && Number(active) ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={active}
              statusText={intl.formatMessage({
                id: ETranslations.earn_active,
              })}
            />
          ) : null}
          {unbondingDelegationList?.length && pendingInactive ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={pendingInactive}
              statusText={intl.formatMessage({
                id: ETranslations.earn_withdrawal_requested,
              })}
              renderTooltipContent={
                <YStack p="$5" gap="$4">
                  {showDetailWithdrawalRequested ? (
                    <>
                      {unbondingDelegationList.map(
                        ({ amount, timestampLeft }, index) => (
                          <PendingInactiveItem
                            key={index}
                            tokenSymbol={token.symbol}
                            pendingInactive={amount}
                            pendingInactivePeriod={timestampLeft}
                          />
                        ),
                      )}
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.earn_staked_assets_available_after_period,
                        })}
                      </SizableText>
                    </>
                  ) : (
                    <SizableText size="$bodyLg">
                      {intl.formatMessage(
                        {
                          id: ETranslations.earn_withdrawal_up_to_number_days,
                        },
                        {
                          number:
                            unbondingDelegationList[0]?.timestampLeft || 1,
                        },
                      )}
                    </SizableText>
                  )}
                </YStack>
              }
            />
          ) : null}
          {claimable && Number(claimable) > 0 ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={claimable}
              statusText={
                labelForClaimable ??
                intl.formatMessage({
                  id: ETranslations.earn_claimable,
                })
              }
              useLoading
              onPress={() => onClaim?.({ amount: claimable })}
              buttonText={intl.formatMessage({
                id: ETranslations.earn_claim,
              })}
              tooltip={tooltipForClaimable}
            />
          ) : null}
          {rewards && Number(rewards) > 0 ? (
            <PortfolioItem
              tokenImageUri={token.logoURI}
              tokenSymbol={token.symbol}
              amount={rewards}
              statusText={intl.formatMessage({
                id: ETranslations.earn_rewards,
              })}
              onPress={() => onClaim?.({ amount: rewards, isReward: true })}
              useLoading
              buttonText={intl.formatMessage({
                id: ETranslations.earn_claim,
              })}
              tooltip={
                isLessThanMinClaimable
                  ? intl.formatMessage(
                      {
                        id: ETranslations.earn_minimum_claim_tooltip,
                      },
                      { number: minClaimableNum, symbol: token.symbol },
                    )
                  : undefined
              }
              disabled={isLessThanMinClaimable}
            />
          ) : null}
          {/* {rewardNum && Object.keys(rewardNum).length > 0
            ? Object.entries(rewardNum).map(([rewardTokenAddress, amount]) => {
                const rewardToken = rewardAssets?.[rewardTokenAddress];

                // defensive check
                // if the reward token info is missing, log a warning and return null
                if (!rewardToken?.info?.symbol || !rewardToken?.info?.logoURI) {
                  console.warn(
                    `Missing token info for reward token: ${rewardTokenAddress}`,
                  );
                  return null;
                }

                // check if the reward amount is a valid value
                const rewardAmount = new BigNumber(amount || '0');
                if (rewardAmount.isNaN() || rewardAmount.lte(0)) {
                  return null;
                }

                return (
                  <PortfolioItem
                    key={rewardTokenAddress}
                    tokenImageUri={rewardToken.info?.logoURI}
                    tokenSymbol={rewardToken.info?.symbol}
                    amount={amount}
                    statusText={intl.formatMessage({
                      id: ETranslations.earn_rewards,
                    })}
                    onPress={() =>
                      onClaim?.({
                        amount,
                        isMorphoClaim: true,
                        claimTokenAddress: rewardTokenAddress,
                      })
                    }
                    useLoading
                    buttonText={intl.formatMessage({
                      id: ETranslations.earn_claim,
                    })}
                    disabled={false}
                  />
                );
              })
            : null} */}
          {rewardNum && Object.keys(rewardNum).length > 0 ? (
            <ProtocolRewards
              rewardNum={rewardNum}
              rewardAssets={rewardAssets}
              onClaim={onClaim}
            />
          ) : null}

          {Number(babylonOverflow) > 0 ? (
            <Alert
              fullBleed
              borderRadius="$3"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderCautionSubdued"
              type="critical"
              title={intl.formatMessage(
                {
                  id: ETranslations.earn_overflow_number_alert,
                },
                { number: babylonOverflow },
              )}
              action={{
                primary: intl.formatMessage({
                  id: ETranslations.global_withdraw,
                }),
                onPrimaryPress: onWithdraw,
              }}
            />
          ) : null}
        </YStack>
      </YStack>
      <Divider />
    </>
  );
}

export const PortfolioSection = ({
  details,
  onClaim,
  onWithdraw,
  onPortfolioDetails,
  unbondingDelegationList,
}: {
  details?: IStakeProtocolDetails;
  onClaim?: (params?: {
    amount: string;
    claimTokenAddress?: string;
    isReward?: boolean;
  }) => void;
  onWithdraw?: () => void;
  onPortfolioDetails?: () => void;
  unbondingDelegationList: IEarnUnbondingDelegationList;
}) => {
  const intl = useIntl();

  if (!details) {
    return null;
  }

  let pendingActiveTooltip: string | undefined;
  let labelForClaimable: string | undefined;
  let tooltipForClaimable: string | undefined;
  if (
    details.provider.name.toLowerCase() ===
      EEarnProviderEnum.Everstake.toLowerCase() &&
    details.token.info.symbol.toLowerCase() === 'eth'
  ) {
    pendingActiveTooltip = intl.formatMessage({
      id: ETranslations.earn_pending_activation_tooltip_eth,
    });
  } else if (details.pendingActive && Number(details.pendingActive)) {
    pendingActiveTooltip = intl.formatMessage(
      {
        id: ETranslations.earn_pending_activation_tooltip,
      },
      {
        number:
          formatStakingDistanceToNowStrict(details?.provider?.stakingTime) ||
          details.pendingActivatePeriod,
      },
    );
  }
  if (
    details.provider.name.toLowerCase() ===
      EEarnProviderEnum.Everstake.toLowerCase() &&
    details.token.info.symbol.toLowerCase() === 'atom'
  ) {
    tooltipForClaimable = intl.formatMessage({
      id: ETranslations.earn_claim_together_tooltip,
    });
  }
  if (
    details.provider.name.toLowerCase() ===
      EEarnProviderEnum.Everstake.toLowerCase() &&
    details.token.info.symbol.toLowerCase() === 'matic'
  ) {
    labelForClaimable = intl.formatMessage({
      id: ETranslations.earn_withdrawn,
    });
  }

  const portfolio: IPortfolioInfoProps = {
    pendingInactive: details.pendingInactive,
    pendingInactivePeriod: details.unstakingPeriod
      ? String(details.unstakingPeriod)
      : undefined,
    pendingActive: details.pendingActive,
    pendingActiveTooltip,
    claimable: details.claimable,
    rewards: details.rewards,
    rewardNum: details.rewardNum,
    rewardAssets: details.rewardAssets,
    active: details.active,
    minClaimableNum: details.provider.minClaimableAmount,
    babylonOverflow:
      Number(details?.staked) > 0 && Number(details.overflow) > 0
        ? details.overflow
        : undefined,
    token: details.token.info,
    labelForClaimable,
    tooltipForClaimable,
    showDetailWithdrawalRequested: false,
  };

  let unbondingDelegationListResult: IUnbondingDelegationListItem[] = [];
  if (
    Array.isArray(unbondingDelegationList) &&
    unbondingDelegationList.length > 0
  ) {
    unbondingDelegationListResult = unbondingDelegationList
      .filter((i) => Number(i.timestampLeft) > 0)
      .map(({ amount, timestampLeft }) => {
        const timestampLeftNumber = Number(timestampLeft);
        return {
          amount,
          timestampLeft: Math.ceil(timestampLeftNumber / 3600 / 24),
        };
      });
    portfolio.showDetailWithdrawalRequested = true;
  } else if (
    portfolio.pendingInactive &&
    Number(portfolio.pendingInactive) &&
    portfolio.pendingInactivePeriod &&
    Number(portfolio.pendingInactivePeriod)
  ) {
    unbondingDelegationListResult.push({
      amount: portfolio.pendingInactive,
      timestampLeft: portfolio.pendingInactivePeriod,
    });
  }

  return (
    <PortfolioInfo
      {...portfolio}
      unbondingDelegationList={unbondingDelegationListResult}
      onClaim={onClaim}
      onPortfolioDetails={onPortfolioDetails}
      onWithdraw={onWithdraw}
    />
  );
};
