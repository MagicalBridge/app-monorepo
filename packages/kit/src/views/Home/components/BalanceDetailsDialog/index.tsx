import { isUndefined } from 'lodash';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  ESwitchSize,
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchAccountDetailsResp } from '@onekeyhq/shared/types/address';

function BalanceDetailsContent({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const [settings, setSettings] = useSettingsPersistAtom();
  const inscriptionEnabled = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled({
        networkId,
        accountId,
      }),
    [accountId, networkId],
  );
  const {
    result: {
      overview = {} as IFetchAccountDetailsResp,
      network = {} as IServerNetwork,
    } = {},
    isLoading,
  } = usePromiseResult(
    async () => {
      if (!accountId || !networkId || isUndefined(inscriptionEnabled.result))
        return;
      const n = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      });
      const withCheckInscription =
        inscriptionEnabled.result && settings.inscriptionProtection;
      let r: IFetchAccountDetailsResp;
      try {
        r = await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId,
          accountId,
          withNonce: false,
          withFrozenBalance: true,
          withCheckInscription,
        });
      } catch {
        r = {
          balanceParsed: '-',
          totalBalanceParsed: '-',
          frozenBalanceParsed: '-',
        } as IFetchAccountDetailsResp;
      }
      return {
        overview: r,
        network: n,
      };
    },
    [
      accountId,
      networkId,
      settings.inscriptionProtection,
      inscriptionEnabled.result,
    ],
    {
      watchLoading: true,
    },
  );

  const whatIsFrozenBalanceUrl = useHelpLink({
    path: 'articles/9810415108111',
  });

  const howToTransferOrdinalsAssetsUrl = useHelpLink({
    path: 'articles/10072721909903',
  });

  return (
    <>
      <Dialog.Header>
        <Dialog.Title>
          {isLoading ? (
            <Skeleton w="$40" h="$9" />
          ) : (
            <SizableText size="$heading3xl">
              {`${overview?.balanceParsed ?? '-'} ${network.symbol}`}
            </SizableText>
          )}
        </Dialog.Title>
        <Dialog.Description>
          {appLocale.intl.formatMessage({
            id: ETranslations.balance_detail_spendable,
          })}
        </Dialog.Description>
      </Dialog.Header>
      <YStack>
        <XStack py="$2" justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {appLocale.intl.formatMessage({
              id: ETranslations.balance_detail_total,
            })}
          </SizableText>
          {isLoading ? (
            <Skeleton w="$24" h="$6" />
          ) : (
            <SizableText textAlign="right" size="$bodyLg">
              {`${overview?.totalBalanceParsed ?? '-'} ${network.symbol}`}
            </SizableText>
          )}
        </XStack>
        <XStack
          py="$2"
          justifyContent="space-between"
          alignItems="center"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderSubdued"
        >
          <XStack>
            <SizableText size="$bodyLgMedium" color="$textSubdued" pr="$2">
              {appLocale.intl.formatMessage({
                id: ETranslations.balance_detail_frozen,
              })}
            </SizableText>
            <IconButton
              variant="tertiary"
              icon="QuestionmarkOutline"
              onPress={() => {
                openUrlExternal(whatIsFrozenBalanceUrl);
              }}
              color="$iconSubdued"
            />
          </XStack>
          {isLoading ? (
            <Skeleton w="$24" h="$6" />
          ) : (
            <SizableText textAlign="right" size="$bodyLg" minWidth={125}>
              {`${overview?.frozenBalanceParsed ?? '-'} ${network.symbol}`}
            </SizableText>
          )}
        </XStack>
        {inscriptionEnabled.result ? (
          <XStack
            py="$2"
            justifyContent="space-between"
            alignItems="center"
            borderTopWidth={StyleSheet.hairlineWidth}
            borderTopColor="$borderSubdued"
          >
            <Stack>
              <SizableText size="$bodyLgMedium" color="$textSubdued">
                {appLocale.intl.formatMessage({
                  id: ETranslations.balance_detail_frozen_by_inscription,
                })}
              </SizableText>
              <XStack
                alignItems="center"
                userSelect="none"
                onPress={() => {
                  openUrlExternal(howToTransferOrdinalsAssetsUrl);
                }}
                hoverStyle={{
                  opacity: 0.75,
                }}
              >
                <SizableText size="$bodyMd" color="$textSubdued" mr="$1.5">
                  {appLocale.intl.formatMessage({
                    id: ETranslations.open_ordinals_transfer_tutorial_url_message,
                  })}
                </SizableText>
                <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
              </XStack>
            </Stack>
            <Switch
              size={ESwitchSize.small}
              value={settings.inscriptionProtection}
              onChange={(value) => {
                setSettings((v) => ({
                  ...v,
                  inscriptionProtection: value,
                }));
              }}
            />
          </XStack>
        ) : null}
      </YStack>
    </>
  );
}

export const showBalanceDetailsDialog = ({
  accountId,
  networkId,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
}) =>
  Dialog.show({
    icon: 'CryptoCoinOutline',
    renderContent: (
      <BalanceDetailsContent accountId={accountId} networkId={networkId} />
    ),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_ok,
    }),
    onConfirm: async ({ close }) => {
      await close();
    },
    ...dialogProps,
  });
