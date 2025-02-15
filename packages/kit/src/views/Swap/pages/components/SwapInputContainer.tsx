import { memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Dialog, SizableText, XStack, YStack } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useRateDifferenceAtom,
  useSwapAlertsAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapRateDifferenceUnit,
  SwapAmountInputAccessoryViewID,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapSelectedTokenInfo } from '../../hooks/useSwapTokens';

import SwapAccountAddressContainer from './SwapAccountAddressContainer';
import SwapInputActions from './SwapInputActions';

interface ISwapInputContainerProps {
  direction: ESwapDirectionType;
  token?: ISwapToken;
  onAmountChange?: (value: string) => void;
  amountValue: string;
  onSelectToken: (type: ESwapDirectionType) => void;
  balance: string;
  address?: string;
  inputLoading?: boolean;
  selectTokenLoading?: boolean;
  onBalanceMaxPress?: () => void;
  onSelectPercentageStage?: (stage: number) => void;
}

const SwapInputContainer = ({
  onAmountChange,
  direction,
  token,
  amountValue,
  selectTokenLoading,
  inputLoading,
  onSelectToken,
  onBalanceMaxPress,
  onSelectPercentageStage,
  balance,
}: ISwapInputContainerProps) => {
  useSwapSelectedTokenInfo({
    token,
    type: direction,
  });
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [alerts] = useSwapAlertsAtom();
  const intl = useIntl();
  const { address, accountInfo } = useSwapAddressInfo(direction);
  const [rateDifference] = useRateDifferenceAtom();
  const amountPrice = useMemo(() => {
    if (!token?.price) return '0.0';
    const tokenPriceBN = new BigNumber(token.price ?? 0);
    const tokenFiatValueBN = new BigNumber(amountValue ?? 0).multipliedBy(
      tokenPriceBN,
    );
    return tokenFiatValueBN.isNaN()
      ? '0.0'
      : `${tokenFiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed()}`;
  }, [amountValue, token?.price]);

  const [fromToken] = useSwapSelectFromTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();

  const fromInputHasError = useMemo(() => {
    const accountError =
      (alerts?.states.some((item) => item.inputShowError) &&
        direction === ESwapDirectionType.FROM) ||
      (!address &&
        (accountUtils.isHdWallet({ walletId: accountInfo?.wallet?.id }) ||
          accountUtils.isHwWallet({ walletId: accountInfo?.wallet?.id }) ||
          accountUtils.isQrWallet({ walletId: accountInfo?.wallet?.id })));
    const balanceBN = new BigNumber(fromTokenBalance ?? 0);
    const amountValueBN = new BigNumber(fromTokenAmount ?? 0);
    const hasBalanceError =
      direction === ESwapDirectionType.FROM &&
      !!fromToken &&
      !!address &&
      balanceBN.lt(amountValueBN);
    return {
      accountError,
      hasBalanceError,
    };
  }, [
    alerts?.states,
    direction,
    address,
    accountInfo?.wallet?.id,
    fromTokenBalance,
    fromTokenAmount,
    fromToken,
  ]);
  const onRateDifferencePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_page_price_impact_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.swap_page_price_impact_content_1,
      }),
      renderContent: (
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.swap_page_price_impact_content_2,
          })}
        </SizableText>
      ),
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_ok,
      }),
    });
  }, [intl]);
  const valueMoreComponent = useMemo(() => {
    if (rateDifference && direction === ESwapDirectionType.TO) {
      let color = '$textSubdued';
      if (inputLoading) {
        color = '$textPlaceholder';
      }
      if (rateDifference.unit === ESwapRateDifferenceUnit.NEGATIVE) {
        color = '$textCritical';
      }
      if (rateDifference.unit === ESwapRateDifferenceUnit.POSITIVE) {
        color = '$textSuccess';
      }
      return (
        <XStack alignItems="center">
          <SizableText size="$bodyMd" color={color}>
            (
          </SizableText>
          <SizableText
            size="$bodyMd"
            color={color}
            cursor="pointer"
            onPress={onRateDifferencePress}
            {...(rateDifference.unit === ESwapRateDifferenceUnit.NEGATIVE && {
              textDecorationLine: 'underline',
            })}
          >
            {rateDifference.value}
          </SizableText>
          <SizableText size="$bodyMd" color={color}>
            )
          </SizableText>
        </XStack>
      );
    }
    return null;
  }, [direction, inputLoading, onRateDifferencePress, rateDifference]);

  const [percentageInputStageShow, setPercentageInputStageShow] =
    useState(false);

  const onFromInputFocus = () => {
    setPercentageInputStageShow(true);
  };

  const onFromInputBlur = () => {
    // delay to avoid blur when select percentage stage
    setTimeout(() => {
      setPercentageInputStageShow(false);
    }, 200);
  };

  const showPercentageInput = useMemo(
    () =>
      direction === ESwapDirectionType.FROM &&
      (percentageInputStageShow || !!amountValue),
    [direction, percentageInputStageShow, amountValue],
  );

  const showPercentageInputDebounce = useDebounce(showPercentageInput, 100, {
    leading: true,
  });

  const showActionBuy = useMemo(
    () =>
      direction === ESwapDirectionType.FROM &&
      !!accountInfo?.account?.id &&
      !!fromToken &&
      fromInputHasError.hasBalanceError,
    [direction, accountInfo?.account?.id, fromToken, fromInputHasError],
  );
  return (
    <YStack borderRadius="$3" backgroundColor="$bgSubdued" borderWidth="$0">
      <XStack justifyContent="space-between" pt="$2.5" px="$3.5">
        <SwapAccountAddressContainer
          type={direction}
          onClickNetwork={onSelectToken}
        />
        <SwapInputActions
          fromToken={fromToken}
          accountInfo={accountInfo}
          showPercentageInput={showPercentageInputDebounce}
          showActionBuy={showActionBuy}
          onSelectStage={onSelectPercentageStage}
        />
      </XStack>
      <AmountInput
        borderRadius="$0"
        borderWidth="$0"
        onChange={onAmountChange}
        value={amountValue}
        hasError={
          fromInputHasError.accountError || fromInputHasError.hasBalanceError
        }
        balanceProps={{
          value: balance,
          onPress:
            direction === ESwapDirectionType.FROM
              ? onBalanceMaxPress
              : undefined,
        }}
        valueProps={{
          value: amountPrice,
          color:
            inputLoading && direction === ESwapDirectionType.TO
              ? '$textPlaceholder'
              : undefined,
          currency: settingsPersistAtom.currencyInfo.symbol,
          moreComponent: valueMoreComponent,
        }}
        inputProps={{
          placeholder: '0.0',
          readOnly: direction === ESwapDirectionType.TO,
          color:
            direction === ESwapDirectionType.TO && inputLoading
              ? '$textPlaceholder'
              : undefined,
          style:
            !platformEnv.isNative && direction === ESwapDirectionType.TO
              ? ({
                  caretColor: 'transparent',
                } as any)
              : undefined,
          inputAccessoryViewID:
            direction === ESwapDirectionType.FROM && platformEnv.isNativeIOS
              ? SwapAmountInputAccessoryViewID
              : undefined,
          autoCorrect: false,
          spellCheck: false,
          autoComplete: 'off',
          onFocus: onFromInputFocus,
          onBlur: onFromInputBlur,
        }}
        tokenSelectorTriggerProps={{
          loading: selectTokenLoading,
          selectedNetworkImageUri: token?.networkLogoURI,
          selectedTokenImageUri: token?.logoURI,
          selectedTokenSymbol: token?.symbol,
          onPress: () => {
            onSelectToken(direction);
          },
        }}
        enableMaxAmount={!!(direction === ESwapDirectionType.FROM)}
      />
    </YStack>
  );
};

export default memo(SwapInputContainer);
