import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Form,
  IconButton,
  Input,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AddressInput,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';
import { ChainSelectorInput } from '@onekeyhq/kit/src/components/ChainSelectorInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { IAddressItem } from '../type';

type ICreateOrEditContentProps = {
  title?: string;
  item: IAddressItem;
  onSubmit: (item: IAddressItem) => Promise<void>;
  onRemove?: (item: IAddressItem) => void;
};

type IFormValues = Omit<IAddressItem, 'address'> & {
  address: IAddressInputValue;
};

function TimeRow({ title, time }: { title: string; time?: number }) {
  if (!time) {
    return null;
  }
  return (
    <XStack jc="space-between">
      <SizableText color="$textSubdued" size="$bodyMd">
        {title}
      </SizableText>
      <SizableText size="$bodyMd">{formatDate(new Date(time))}</SizableText>
    </XStack>
  );
}

export const CreateOrEditContent: FC<ICreateOrEditContentProps> = ({
  title,
  item,
  onSubmit,
  onRemove,
}) => {
  const intl = useIntl();
  const form = useForm<IFormValues>({
    defaultValues: {
      id: item.id,
      networkId: item.networkId,
      name: item.name,
      address: { raw: item.address, resolved: '' } as IAddressInputValue,
      isAllowListed: item.isAllowListed,
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const headerRight = useCallback(
    () =>
      onRemove ? (
        <IconButton
          icon="DeleteOutline"
          variant="tertiary"
          onPress={() => onRemove(item)}
          testID="address-form-remove"
        />
      ) : null,
    [onRemove, item],
  );

  const networkId = form.watch('networkId');
  const pending = form.watch('address.pending');

  const onSave = useCallback(
    async (values: IFormValues) => {
      await onSubmit?.({
        id: values.id,
        name: values.name,
        networkId: values.networkId,
        address: values.address.resolved ?? '',
        isAllowListed: values.isAllowListed ?? false,
      });
    },
    [onSubmit],
  );

  const { result: addressBookEnabledNetworkIds } = usePromiseResult(
    async () => {
      const resp =
        await backgroundApiProxy.serviceNetwork.getAddressBookEnabledNetworks();
      const networkIds = resp.map((o) => o.id);
      return networkIds;
    },
    [],
    { initResult: [] },
  );

  return (
    <Page scrollEnabled>
      <Page.Header title={title} headerRight={headerRight} />
      <Page.Body p="$4">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_chain,
            })}
            name="networkId"
            rules={{ required: true }}
            description={
              networkId.startsWith('evm--') ? (
                <SizableText size="$bodyMd" pt="$1.5" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.address_book_add_address_add_to_evm_chains,
                  })}
                </SizableText>
              ) : null
            }
          >
            <ChainSelectorInput networkIds={addressBookEnabledNetworkIds} />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_name,
            })}
            name="name"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_empty_error,
                }),
              },
              maxLength: {
                value: 24,
                message: intl.formatMessage(
                  {
                    id: ETranslations.address_book_add_address_name_length_erro,
                  },
                  { 'num': 24 },
                ),
              },
              validate: async (text) => {
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    name: text,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_exists,
                });
              },
            }}
            testID="address-form-name-field"
          >
            <Input
              placeholder={intl.formatMessage({
                id: ETranslations.address_book_add_address_name_required,
              })}
              testID="address-form-name"
            />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.address_book_add_address_address,
            })}
            name="address"
            rules={{
              validate: async (output: IAddressInputValue) => {
                if (output.pending) {
                  return;
                }
                if (!output.resolved) {
                  return (
                    output.validateError?.message ??
                    intl.formatMessage({
                      id: ETranslations.address_book_add_address_address_invalid_error,
                    })
                  );
                }
                const searched =
                  await backgroundApiProxy.serviceAddressBook.findItem({
                    address: output.resolved,
                  });
                if (!searched || item.id === searched.id) {
                  return undefined;
                }
                return intl.formatMessage({
                  id: ETranslations.address_book_add_address_address_exists,
                });
              },
            }}
            testID="address-form-address-field"
          >
            <AddressInput
              networkId={networkId}
              placeholder={intl.formatMessage({
                id: ETranslations.address_book_add_address_address,
              })}
              autoError={false}
              testID="address-form-address"
              enableNameResolve
              enableAddressContract
            />
          </Form.Field>
        </Form>
        <YStack gap="$2.5" pt="$5">
          <TimeRow
            title={intl.formatMessage({
              id: ETranslations.address_book_edit_added_on,
            })}
            time={item.createdAt}
          />
          <TimeRow
            title={intl.formatMessage({
              id: ETranslations.address_book_edit_last_edited,
            })}
            time={item.updatedAt}
          />
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Stack
          bg="$bgApp"
          flexDirection="column"
          $gtMd={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Form form={form}>
            <XStack px="$5">
              <Form.Field name="isAllowListed">
                <Checkbox
                  containerProps={{
                    flex: platformEnv.isNative ? undefined : 1,
                  }}
                  label={intl.formatMessage({
                    id: ETranslations.adress_book_add_address_add_to_allowlist,
                  })}
                  labelProps={
                    {
                      size: '$bodyLgMedium',
                    } as const
                  }
                />
              </Form.Field>
            </XStack>
          </Form>
          <XStack mx="$5" />
          <Page.FooterActions
            flex={platformEnv.isNative ? undefined : 1}
            onConfirmText={intl.formatMessage({
              id: ETranslations.address_book_add_address_button_save,
            })}
            confirmButtonProps={{
              variant: 'primary',
              loading: form.formState.isSubmitting,
              disabled: !form.formState.isValid || pending,
              onPress: form.handleSubmit(onSave),
              testID: 'address-form-save',
            }}
          />
        </Stack>
      </Page.Footer>
    </Page>
  );
};
