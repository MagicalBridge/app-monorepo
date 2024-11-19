import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Icon,
  NATIVE_HIT_SLOP,
  SizableText,
  Tooltip,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAllNetworkCopyAddressHandler } from '@onekeyhq/kit/src/views/WalletAddress/hooks/useAllNetworkCopyAddressHandler';
import { ALL_NETWORK_ACCOUNT_MOCK_ADDRESS } from '@onekeyhq/shared/src/consts/addresses';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useShortcutsOnRouteFocused } from '../../hooks/useShortcutsOnRouteFocused';
import {
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';
import { Spotlight } from '../Spotlight';

import { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

const AllNetworkAccountSelector = ({ num }: { num: number }) => {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });

  const [isFocus, setIsFocus] = useState(false);
  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({
      activeAccount,
    });
  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal);
    },
  );

  const { result, run } = usePromiseResult(async () => {
    if (!activeAccount.network?.isAllNetworks) return null;
    const [s, a] = await Promise.all([
      backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
      backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
        {
          accountId: activeAccount.account?.id,
          walletId: activeAccount.wallet?.id,
        },
      ),
    ]);

    const all = [...a.mainnetItems, ...a.testnetItems];
    const visibleNetworks: IServerNetwork[] = [];

    for (const n of all) {
      const accounts =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId: n.id,
            indexedAccountId: activeAccount.account?.indexedAccountId ?? '',
          },
        );

      const account = accounts.networkAccounts.find(
        (na) =>
          accounts.network.id === n.id &&
          (na.account?.address ||
            (na.account && networkUtils.isLightningNetworkByNetworkId(n.id))),
      );
      if (account) {
        if (
          isEnabledNetworksInAllNetworks({
            networkId: n.id,
            isTestnet: n.isTestnet,
            deriveType: account.deriveType,
            disabledNetworks: s.disabledNetworks,
            enabledNetworks: s.enabledNetworks,
          })
        ) {
          visibleNetworks.push(n);
        }
      }
    }

    return {
      visibleNetworks,
      allNetworks: all,
    };
  }, [
    activeAccount.account?.id,
    activeAccount.account?.indexedAccountId,
    activeAccount.network?.isAllNetworks,
    activeAccount.wallet?.id,
  ]);

  const { visibleNetworks, allNetworks } = result ?? {};

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, () => run());
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, () => run());
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, () => run());
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, () => run());
    };
  }, [run]);

  if (!isAllNetworkEnabled) {
    return null;
  }

  return (
    <Spotlight
      delayMs={150}
      isVisible={isFocus ? !platformEnv.isE2E : undefined}
      message={intl.formatMessage({
        id: ETranslations.spotlight_enable_network_message,
      })}
      tourName={ESpotlightTour.createAllNetworks}
    >
      <XStack
        gap="$2"
        p="$1"
        m="$-1"
        borderRadius="$2"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: 0,
        }}
        hitSlop={{
          right: 8,
          bottom: 8,
          top: 8,
        }}
        userSelect="none"
        onPress={handleAllNetworkCopyAddress}
      >
        <Icon size="$5" name="Copy3Outline" color="$iconSubdued" />
        <SizableText size="$bodyMd">
          {allNetworks && visibleNetworks
            ? `${visibleNetworks.length} / ${allNetworks.length}`
            : ''}
        </SizableText>
      </XStack>
      {/* <SizableText size="$bodyMd">{activeAccount?.account?.id}</SizableText> */}
    </Spotlight>
  );

  // const visible = isFirstVisit && isFocus;
  // console.log('AllNetworkAccountSelector____visible', visible);
  // return (
  //   <SpotlightView
  //     visible={visible}
  //     content={
  //       <SizableText size="$bodyMd">
  //         {intl.formatMessage({
  //           id: ETranslations.spotlight_enable_network_message,
  //         })}
  //       </SizableText>
  //     }
  //     onConfirm={tourVisited}
  //   >
  //     <IconButton
  //       title={intl.formatMessage({ id: ETranslations.global_copy_address })}
  //       variant="tertiary"
  //       icon="Copy3Outline"
  //       size="small"
  //       onPress={handleWalletAddress}
  //     />
  //   </SpotlightView>
  // );
};

export function AccountSelectorActiveAccountHome({ num }: { num: number }) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });
  const { copyText } = useClipboard();
  const { account, wallet, network, deriveInfo } = activeAccount;

  const { selectedAccount } = useSelectedAccount({ num });
  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({
      activeAccount,
    });
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();

  const logActiveAccount = useCallback(() => {
    console.log({
      selectedAccount,
      addressDetail: activeAccount?.account?.addressDetail,
      activeAccount,
      walletAvatar: activeAccount?.wallet?.avatar,
    });
    console.log(activeAccount?.wallet?.avatar);
  }, [activeAccount, selectedAccount]);

  const handleAddressOnPress = useCallback(() => {
    if (!account?.address || !network || !deriveInfo || !wallet) {
      return;
    }
    if (
      wallet?.id &&
      (accountUtils.isHwWallet({
        walletId: wallet?.id,
      }) ||
        accountUtils.isQrWallet({
          walletId: wallet?.id,
        }))
    ) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId: network.id,
          accountId: account.id,
          walletId: wallet.id,
        },
      });
    } else {
      copyText(account.address);
    }
    logActiveAccount();
  }, [
    account,
    copyText,
    deriveInfo,
    logActiveAccount,
    navigation,
    network,
    wallet,
  ]);

  useShortcutsOnRouteFocused(
    EShortcutEvents.CopyAddressOrUrl,
    account?.address === ALL_NETWORK_ACCOUNT_MOCK_ADDRESS
      ? handleAllNetworkCopyAddress
      : handleAddressOnPress,
  );

  if (isAllNetworkEnabled) {
    return <AllNetworkAccountSelector num={num} />;
  }

  if (accountUtils.isAllNetworkMockAddress({ address: account?.address })) {
    return null;
  }

  // show address if account has an address
  if (account?.address) {
    return (
      <Tooltip
        shortcutKey={EShortcutEvents.CopyAddressOrUrl}
        renderContent={intl.formatMessage({
          id: ETranslations.global_copy_address,
        })}
        placement="top"
        renderTrigger={
          <XStack
            alignItems="center"
            onPress={handleAddressOnPress}
            py="$1"
            px="$2"
            my="$-1"
            mx="$-2"
            borderRadius="$2"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusable
            focusVisibleStyle={{
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }}
            hitSlop={NATIVE_HIT_SLOP}
            userSelect="none"
            testID="account-selector-address"
          >
            {platformEnv.isE2E ? (
              <SizableText
                testID="account-selector-address-text"
                size="$bodyMd"
                width={200}
              >
                {account?.address}
              </SizableText>
            ) : (
              <SizableText
                testID="account-selector-address-text"
                size="$bodyMd"
              >
                {accountUtils.shortenAddress({ address: account?.address })}
              </SizableText>
            )}
          </XStack>
        }
      />
    );
  }

  // show nothing if account exists, but has not an address
  if (account) {
    return null;
  }

  if (activeAccount.canCreateAddress) {
    // show create button if account not exists
    return (
      <AccountSelectorCreateAddressButton
        // autoCreateAddress // use EmptyAccount autoCreateAddress instead
        num={num}
        account={selectedAccount}
        onPressLog={logActiveAccount}
      />
    );
  }

  if (
    !account &&
    selectedAccount.othersWalletAccountId &&
    !selectedAccount.indexedAccountId
  ) {
    return (
      <XStack onPress={() => logActiveAccount()}>
        <SizableText size="$bodyMd" color="$textCaution">
          {intl.formatMessage({ id: ETranslations.global_network_not_matched })}
        </SizableText>
      </XStack>
    );
  }

  return (
    <XStack onPress={() => logActiveAccount()}>
      <SizableText size="$bodyMd" color="$textCaution">
        {intl.formatMessage({ id: ETranslations.wallet_no_address })}
      </SizableText>
    </XStack>
  );
}
