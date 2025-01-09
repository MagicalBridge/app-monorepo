import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  Input,
  NumberSizeableText,
  Skeleton,
  Switch,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSignatureConfirmActions,
  useTokenApproveInfoAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { SignatureConfirmProviderMirror } from '../SignatureConfirmProvider/SignatureConfirmProviderMirror';

export type IProps = {
  accountId: string;
  networkId: string;
  allowance: string;
  isUnlimited: boolean;
  tokenAddress: string;
  balanceParsed?: string;
  tokenDecimals: number;
  tokenSymbol: string;
  approveInfo?: IApproveInfo;
  onResetTokenApproveInfo?: () => void;
  onChangeTokenApproveInfo?: ({
    allowance,
    isUnlimited,
  }: {
    allowance: string;
    isUnlimited: boolean;
  }) => void;
};

const ALLOWANCE_MAX = 10_000_000_000_000;

function ApproveEditor(props: IProps) {
  const intl = useIntl();

  const [unsignedTxs] = useUnsignedTxsAtom();
  const [tokenApproveInfo] = useTokenApproveInfoAtom();
  const { updateUnsignedTxs } = useSignatureConfirmActions().current;

  const {
    accountId,
    networkId,
    allowance,
    isUnlimited,
    tokenDecimals,
    tokenAddress,
    balanceParsed,
    tokenSymbol,
    onResetTokenApproveInfo,
    onChangeTokenApproveInfo,
    approveInfo,
  } = props;

  const handleUpdateUnsignedTxs = useCallback(
    async ({
      allowance: newAllowance,
      isUnlimited: newIsUnlimited,
    }: {
      allowance: string;
      isUnlimited: boolean;
    }) => {
      const newUnsignedTx =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          accountId,
          networkId,
          unsignedTx: unsignedTxs[0],
          tokenApproveInfo: {
            allowance: newAllowance,
            isUnlimited: newIsUnlimited,
          },
        });
      updateUnsignedTxs([newUnsignedTx]);
    },
    [accountId, networkId, unsignedTxs, updateUnsignedTxs],
  );

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (isNil(balanceParsed)) {
        const tokenDetails =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            networkId,
            accountId,
            contractList: [tokenAddress],
          });

        return {
          tokenBalanceParsed: tokenDetails[0]?.balanceParsed,
        };
      }

      return {
        tokenBalanceParsed: balanceParsed,
      };
    },

    [balanceParsed, networkId, accountId, tokenAddress],
    {
      watchLoading: true,
    },
  );

  const tokenBalanceParsed = result?.tokenBalanceParsed;

  const unlimitedText = intl.formatMessage({
    id: ETranslations.swap_page_provider_approve_amount_un_limit,
  });

  const form = useForm({
    defaultValues: {
      allowance: '',
      isUnlimited: false,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const watchAllFields = form.watch();

  const handleValidateApproveAmount = useCallback(
    (value: string) => {
      if (value === 'RESET') {
        return 'RESET';
      }

      if (approveInfo) {
        if (form.getValues('isUnlimited')) {
          return true;
        }
        const valueBN = new BigNumber(value);
        if (valueBN.isLessThan(approveInfo.amount)) {
          return intl.formatMessage({
            id: ETranslations.approve_edit_less_than_swap,
          });
        }
      }

      return true;
    },
    [approveInfo, form, intl],
  );

  return (
    <>
      <Form form={form}>
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.approve_edit_approve_amount,
          })}
          name="allowance"
          rules={{
            validate: handleValidateApproveAmount,
            onChange: (e: { target: { name: string; value: string } }) => {
              const value = e.target?.value;
              if (value === unlimitedText) {
                return;
              }
              const valueBN = new BigNumber(value ?? 0);
              if (valueBN.isNaN()) {
                const formattedValue = parseFloat(value);
                form.setValue(
                  'allowance',
                  isNaN(formattedValue) ? '' : String(formattedValue),
                );
                return;
              }

              if (valueBN.isGreaterThanOrEqualTo(ALLOWANCE_MAX)) {
                form.setValue('allowance', unlimitedText);
                form.setValue('isUnlimited', true);
                return;
              }

              const dp = valueBN.decimalPlaces();
              if (dp && dp > tokenDecimals) {
                form.setValue(
                  'allowance',
                  valueBN.toFixed(tokenDecimals, BigNumber.ROUND_FLOOR),
                );
              }
            },
          }}
          labelAddon={
            isLoading ? (
              <Skeleton height={20} width={100} />
            ) : (
              <Button
                size="small"
                variant="tertiary"
                icon="WalletOutline"
                onPress={() => {
                  if (
                    !isNil(tokenBalanceParsed) &&
                    !watchAllFields.isUnlimited
                  ) {
                    form.setValue('allowance', tokenBalanceParsed);
                  }
                }}
              >
                <NumberSizeableText
                  size="$bodyMdMedium"
                  formatter="balance"
                  formatterOptions={{
                    tokenSymbol,
                  }}
                  color="$textSubdued"
                >
                  {tokenBalanceParsed ?? '-'}
                </NumberSizeableText>
              </Button>
            )
          }
        >
          <Input
            flex={1}
            editable={!watchAllFields.isUnlimited}
            addOns={[
              {
                label: tokenSymbol,
              },
            ]}
            placeholder={
              isUnlimited
                ? intl.formatMessage({
                    id: ETranslations.swap_page_provider_approve_amount_un_limit,
                  })
                : allowance
            }
          />
        </Form.Field>
        <Form.Field
          horizontal
          label={intl.formatMessage({
            id: ETranslations.approve_edit_unlimited_amount,
          })}
          name="isUnlimited"
          rules={{
            onChange: (e: { target: { name: string; value: boolean } }) => {
              const value = e.target?.value;
              if (value) {
                form.setValue('allowance', unlimitedText);
              } else {
                form.setValue('allowance', isUnlimited ? '' : allowance);
              }
              void form.trigger('allowance');
            },
          }}
        >
          <Switch size="small" />
        </Form.Field>
      </Form>
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !form.formState.isValid,
        }}
        onConfirm={async ({ close }) => {
          const currentAllowance = form.getValues('allowance');
          const currentIsUnlimited = form.getValues('isUnlimited');

          if (currentAllowance !== '') {
            void handleUpdateUnsignedTxs({
              allowance: currentAllowance,
              isUnlimited: currentIsUnlimited,
            });
            onChangeTokenApproveInfo?.({
              allowance: currentAllowance,
              isUnlimited: currentIsUnlimited,
            });
          }

          void close();
        }}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_reset,
        })}
        onCancel={() => {
          if (
            !(
              new BigNumber(allowance).isEqualTo(
                tokenApproveInfo.originalAllowance,
              ) && isUnlimited === tokenApproveInfo.originalIsUnlimited
            )
          ) {
            void handleUpdateUnsignedTxs({
              allowance: tokenApproveInfo.originalAllowance,
              isUnlimited: tokenApproveInfo.originalIsUnlimited,
            });
          }

          onResetTokenApproveInfo?.();
        }}
      />
    </>
  );
}

const showApproveEditor = (props: IProps) => {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.approve_edit_title,
    }),
    showExitButton: false,
    renderContent: (
      <SignatureConfirmProviderMirror>
        <ApproveEditor {...props} />
      </SignatureConfirmProviderMirror>
    ),
  });
};

export { showApproveEditor };
