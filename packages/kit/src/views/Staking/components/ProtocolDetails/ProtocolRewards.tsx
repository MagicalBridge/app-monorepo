import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
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
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IEarnRewardNum,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';

function RewardItem({
  rewardTokenAddress,
  rewardData,
  rewardToken,
  symbol,
  onClaim,
  isLast,
}: {
  rewardTokenAddress: string;
  rewardData: IEarnRewardNum[string];
  rewardToken?: IEarnTokenItem;
  symbol: string;
  onClaim?: (params: any) => void;
  isLast: boolean;
}) {
  const intl = useIntl();

  // check rewardToken is valid
  if (!rewardToken?.info?.symbol || !rewardToken?.info?.logoURI) {
    console.warn(`Missing token info for reward token: ${rewardTokenAddress}`);
    return null;
  }

  const claimableNowBN = new BigNumber(rewardData.claimableNow || '0');
  const validClaimableNow =
    claimableNowBN.isNaN() || claimableNowBN.lt(0)
      ? new BigNumber(0)
      : claimableNowBN;

  const claimableNextBN = new BigNumber(rewardData.claimableNext || '0');
  const validClaimableNext =
    claimableNextBN.isNaN() || claimableNextBN.lt(0)
      ? new BigNumber(0)
      : claimableNextBN;

  const fiatClaimableNowValue = validClaimableNow.multipliedBy(
    rewardToken.price,
  );
  const fiatClaimableNextValue = validClaimableNext.multipliedBy(
    rewardToken.price,
  );

  const formattedFiatClaimableNextValue = fiatClaimableNextValue.lt(0.01)
    ? `<${symbol}0.01`
    : `${symbol}${
        formatBalance(fiatClaimableNextValue.toString()).formattedValue
      }`;

  return (
    <>
      <YStack gap="$2.5">
        <XStack alignItems="center" justifyContent="space-between">
          <XStack alignItems="center">
            <Token
              mr="$1.5"
              size="sm"
              tokenImageUri={rewardToken.info?.logoURI}
            />
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol: rewardToken.info?.symbol }}
            >
              {validClaimableNow.toString()}
            </NumberSizeableText>
            {fiatClaimableNowValue.gt(0) ? (
              <SizableText size="$bodyLgMedium">
                (
                <NumberSizeableText
                  size="$bodyLgMedium"
                  formatter="value"
                  formatterOptions={{ currency: symbol }}
                >
                  {fiatClaimableNowValue.lt(0.01)
                    ? `<${symbol}0.01`
                    : fiatClaimableNowValue.toString()}
                </NumberSizeableText>
                )
              </SizableText>
            ) : null}
          </XStack>
          <Button
            size="small"
            variant="primary"
            disabled={validClaimableNow.isZero()}
            onPress={() => {
              onClaim?.({
                amount: validClaimableNow.toString(),
                isMorphoClaim: true,
                claimTokenAddress: rewardTokenAddress,
              });
            }}
          >
            {intl.formatMessage({
              id: ETranslations.earn_claim,
            })}
          </Button>
        </XStack>
        <XStack>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.earn_claimable_in_future },
              {
                value: formatBalance(validClaimableNext.toString(), {
                  showPlusMinusSigns: true,
                }).formattedValue,
                symbol: rewardToken.info?.symbol,
                fiatValue: formattedFiatClaimableNextValue,
              },
            )}
          </SizableText>
        </XStack>
      </YStack>
      {!isLast ? <Divider my="$1.5" /> : null}
    </>
  );
}

export function ProtocolRewards({
  rewardNum,
  rewardAssets,
  onClaim,
}: {
  rewardNum?: IEarnRewardNum;
  rewardAssets?: Record<string, IEarnTokenItem>;
  onClaim?: (params?: {
    amount: string;
    claimTokenAddress?: string;
    isReward?: boolean;
    isMorphoClaim?: boolean;
  }) => void;
}) {
  const intl = useIntl();

  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();

  const displayRewards =
    rewardNum &&
    Object.keys(rewardNum).length > 0 &&
    Object.values(rewardNum).some(
      (value) =>
        new BigNumber(value.claimableNow).isGreaterThan(0) ||
        new BigNumber(value.claimableNext).isGreaterThan(0),
    );

  if (!displayRewards) {
    return null;
  }

  return (
    <YStack
      gap="$2.5"
      py="$3.5"
      px="$4"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      bg="$bgSubdued"
    >
      <XStack alignItems="center" gap="$1">
        <SizableText color="$textSubdued" size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.earn_protocol_rewards,
          })}
        </SizableText>
        <Popover
          title=""
          placement="top"
          renderTrigger={
            <IconButton
              iconColor="$iconSubdued"
              size="small"
              icon="InfoCircleOutline"
              variant="tertiary"
            />
          }
          renderContent={
            <Stack p="$5">
              <SizableText color="$text" size="$bodyLg">
                {intl.formatMessage({
                  id: ETranslations.earn_claim_rewards_morpho_desc,
                })}
              </SizableText>
            </Stack>
          }
        />
      </XStack>
      {Object.entries(rewardNum).map(
        ([rewardTokenAddress, rewardData], index) => (
          <RewardItem
            key={rewardTokenAddress}
            rewardTokenAddress={rewardTokenAddress}
            rewardData={rewardData}
            rewardToken={rewardAssets?.[rewardTokenAddress]}
            symbol={symbol}
            onClaim={onClaim}
            isLast={index === Object.keys(rewardNum).length - 1}
          />
        ),
      )}
    </YStack>
  );
}
