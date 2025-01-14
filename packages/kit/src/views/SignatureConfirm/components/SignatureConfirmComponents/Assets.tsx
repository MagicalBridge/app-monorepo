import { useCallback, useEffect, useMemo } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import {
  useDecodedTxsAtom,
  useSignatureConfirmActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EParseTxComponentType,
  type IDisplayComponentApprove,
  type IDisplayComponentAssets,
  type IDisplayComponentInternalAssets,
  type IDisplayComponentNFT,
  type IDisplayComponentToken,
} from '@onekeyhq/shared/types/signatureConfirm';

import { showApproveEditor } from '../ApproveEditor';
import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IAssetsCommonProps = {
  networkId: string;
  showNetwork?: boolean;
  editable?: boolean;
  hideLabel?: boolean;
} & ISignatureConfirmItemType;

type IAssetsTokenProps = IAssetsCommonProps & {
  component: IDisplayComponentToken;
};

type IAssetsApproveProps = IAssetsCommonProps & {
  accountId: string;
  component: IDisplayComponentApprove;
  approveInfo?: IApproveInfo;
};

type IAssetsNFTProps = IAssetsCommonProps & {
  component: IDisplayComponentNFT;
};

type IInternalAssetsProps = IAssetsCommonProps & {
  component: IDisplayComponentInternalAssets;
};

type IAssetsProps = IAssetsCommonProps & {
  component: IDisplayComponentAssets;
};

type ISignatureConfirmItemType = IYStackProps;

function SignatureAssetDetailItem({
  type,
  label,
  showNetwork,
  amount,
  symbol,
  editable,
  tokenProps,
  isLoading,
  handleEdit,
  hideLabel,
  ...rest
}: {
  type?: 'token' | 'nft';
  label: string;
  amount: string;
  symbol: string;
  editable?: boolean;
  showNetwork?: boolean;
  isLoading?: boolean;
  tokenProps?: Omit<ITokenProps, 'size' | 'showNetworkIcon'>;
  handleEdit?: () => void;
  hideLabel?: boolean;
} & ISignatureConfirmItemType) {
  const { network } = useAccountData({
    networkId: tokenProps?.networkId,
  });

  const renderDetails = useCallback(() => {
    if (isLoading) {
      return <Skeleton.HeadingMd />;
    }
    return (
      <>
        {amount ? <SizableText size="$headingMd">{amount}</SizableText> : null}
        {symbol ? <SizableText size="$bodyLg">{symbol}</SizableText> : null}
        {editable ? (
          <Icon name="PencilOutline" size="$4.5" color="$iconSubdued" />
        ) : null}
      </>
    );
  }, [amount, symbol, editable, isLoading]);

  return (
    <SignatureConfirmItem {...rest}>
      {!hideLabel ? (
        <SignatureConfirmItem.Label>{label}</SignatureConfirmItem.Label>
      ) : null}
      <XStack gap="$3" alignItems="center">
        <Token
          size="lg"
          showNetworkIcon={showNetwork}
          {...(type === 'nft' && {
            borderRadius: '$2',
          })}
          {...tokenProps}
        />
        <YStack>
          <XStack
            gap="$1"
            alignItems="center"
            {...(editable && {
              onPress: () => {
                handleEdit?.();
              },
              p: '$1',
              m: '$-1',
              borderRadius: '$2',
              userSelect: 'none',
              hoverStyle: {
                bg: '$bgSubdued',
              },
              pressStyle: {
                bg: '$bgActive',
              },
              focusable: true,
              focusVisibleStyle: {
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: 0,
              },
            })}
          >
            {renderDetails()}
          </XStack>
          {showNetwork ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {network?.name}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </SignatureConfirmItem>
  );
}

function AssetsToken(props: IAssetsTokenProps) {
  const { component, showNetwork, ...rest } = props;
  return (
    <SignatureAssetDetailItem
      label={component.label}
      amount={component.amountParsed}
      symbol={component.token.info.symbol}
      tokenProps={{
        tokenImageUri: component.token.info.logoURI,
        isNFT: false,
        networkId: component.networkId ?? component.token.info.networkId,
      }}
      type="token"
      showNetwork={component.showNetwork ?? showNetwork}
      {...rest}
    />
  );
}

function AssetsTokenApproval(props: IAssetsApproveProps) {
  const {
    component,
    accountId,
    networkId,
    approveInfo,
    showNetwork,
    editable,
    ...rest
  } = props;
  const { token } = component;
  const { updateTokenApproveInfo } = useSignatureConfirmActions().current;
  const [{ isBuildingDecodedTxs }] = useDecodedTxsAtom();
  const intl = useIntl();

  useEffect(() => {
    updateTokenApproveInfo({
      originalAllowance: component.amountParsed,
      originalIsUnlimited: component.isInfiniteAmount,
    });
  }, [
    updateTokenApproveInfo,
    component.amount,
    component.isInfiniteAmount,
    component.amountParsed,
  ]);

  const isEditable = useMemo(
    () => editable && component.isEditable,
    [editable, component.isEditable],
  );

  return (
    <SignatureAssetDetailItem
      isLoading={isBuildingDecodedTxs}
      label={component.label}
      amount={
        component.isInfiniteAmount
          ? intl.formatMessage({
              id: ETranslations.swap_page_provider_approve_amount_un_limit,
            })
          : component.amountParsed
      }
      symbol={component.token.info.symbol}
      tokenProps={{
        tokenImageUri: component.token.info.logoURI,
        isNFT: false,
        networkId: component.networkId ?? component.token.info.networkId,
      }}
      type="token"
      handleEdit={() => {
        if (isNil(token.info.decimals)) {
          throw new Error('token decimals is required.');
        }
        if (isBuildingDecodedTxs) return;
        showApproveEditor({
          accountId,
          networkId,
          isUnlimited: component.isInfiniteAmount,
          allowance: component.amountParsed,
          tokenDecimals: token.info.decimals,
          tokenSymbol: token.info.symbol,
          tokenAddress: token.info.address,
          balanceParsed: component.balanceParsed,
          approveInfo,
        });
      }}
      showNetwork={component.showNetwork ?? showNetwork}
      editable={isEditable}
      {...rest}
    />
  );
}

function AssetsNFT(props: IAssetsNFTProps) {
  const { component, ...rest } = props;
  return (
    <SignatureAssetDetailItem
      label={component.label}
      amount={component.amount}
      symbol={
        component.nft.metadata?.name || component.nft.collectionName || ''
      }
      type="nft"
      tokenProps={{
        isNFT: true,
        tokenImageUri: component.nft.metadata?.image ?? '',
        networkId: component.nft.networkId,
      }}
      {...rest}
    />
  );
}

function AssetsInternalAssets(props: IInternalAssetsProps) {
  const { component, ...rest } = props;
  return (
    <SignatureAssetDetailItem
      label={component.label}
      amount={component.amountParsed}
      symbol={component.symbol}
      tokenProps={{
        tokenImageUri: component.icon,
        isNFT: component.isNFT,
        networkId: component.networkId,
      }}
      type={component.isNFT ? 'nft' : 'token'}
      {...rest}
    />
  );
}

function Assets(props: IAssetsProps) {
  const { component, ...rest } = props;
  return (
    <SignatureConfirmItem {...rest}>
      <SignatureConfirmItem.Label>{component.label}</SignatureConfirmItem.Label>
      <YStack gap="$1">
        {component.assets.map((asset, index) => {
          if (asset.type === EParseTxComponentType.InternalAssets) {
            return (
              <AssetsInternalAssets
                hideLabel
                key={index}
                component={asset}
                {...rest}
              />
            );
          }
          if (asset.type === EParseTxComponentType.NFT) {
            return (
              <AssetsNFT hideLabel key={index} component={asset} {...rest} />
            );
          }
          if (asset.type === EParseTxComponentType.Token) {
            return (
              <AssetsToken hideLabel key={index} component={asset} {...rest} />
            );
          }
          return null;
        })}
      </YStack>
    </SignatureConfirmItem>
  );
}

Assets.Token = AssetsToken;
Assets.TokenApproval = AssetsTokenApproval;

Assets.NFT = AssetsNFT;
Assets.InternalAssets = AssetsInternalAssets;

export { Assets };
