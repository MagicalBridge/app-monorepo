import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/shared/src/routes/addressBook';

import { CreateOrEditContent } from '../../components/CreateOrEditContent';

import type { IAddressItem } from '../../type';
import type { RouteProp } from '@react-navigation/core';

const defaultValues: IAddressItem = {
  name: '',
  address: '',
  networkId: getNetworkIdsMap().btc,
  isAllowListed: false,
};

function EditItemPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { params: addressBookParams } =
    useRoute<
      RouteProp<
        IModalAddressBookParamList,
        EModalAddressBookRoutes.EditItemModal
      >
    >();

  const isCreateMode = !addressBookParams?.id;

  const onSubmit = useCallback(
    async (item: IAddressItem) => {
      const { serviceAddressBook } = backgroundApiProxy;
      try {
        if (item.id) {
          await serviceAddressBook.updateItem(item);
        } else {
          await serviceAddressBook.addItem(item);
        }
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.address_book_add_address_toast_save_success,
          }),
        });
        navigation.pop();
      } catch (e) {
        Toast.error({ title: (e as Error).message });
      }
    },
    [intl, navigation],
  );

  const onRemove = useCallback(
    async (item: IAddressItem) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.address_book_edit_address_delete_contact_title,
        }),
        icon: 'DeleteOutline',
        description: intl.formatMessage({
          id: ETranslations.address_book_edit_address_delete_contact_message,
        }),
        tone: 'destructive',
        showConfirmButton: true,
        showCancelButton: true,
        onConfirm: async () => {
          if (item.id) {
            try {
              await backgroundApiProxy.serviceAddressBook.removeItem(item.id);
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.address_book_add_address_toast_delete_success,
                }),
              });
              navigation.pop();
            } catch (e) {
              Toast.error({ title: (e as Error).message });
            }
          }
        },
        confirmButtonProps: {
          testID: 'address-remove-confirm',
        },
        cancelButtonProps: {
          testID: 'address-remove-cancel',
        },
      });
    },
    [navigation, intl],
  );

  const { result: item, isLoading } = usePromiseResult(
    async () => {
      if (isCreateMode) {
        return { ...defaultValues, ...addressBookParams };
      }
      const addressBookItem =
        await backgroundApiProxy.serviceAddressBook.findItemById(
          addressBookParams.id,
        );
      return {
        ...addressBookItem,
        ...addressBookParams,
      };
    },
    [addressBookParams, isCreateMode],
    {
      initResult: {
        address: '',
        name: '',
        networkId: '',
      },
      watchLoading: true,
    },
  );

  // isLoading is undefined initially, so we need to explicitly check if it's false
  return isLoading === false ? (
    <CreateOrEditContent
      title={intl.formatMessage({
        id: isCreateMode
          ? ETranslations.address_book_add_address_title
          : ETranslations.address_book_edit_address_title,
      })}
      item={item}
      onSubmit={onSubmit}
      onRemove={isCreateMode ? undefined : onRemove}
    />
  ) : null;
}

export default EditItemPage;
