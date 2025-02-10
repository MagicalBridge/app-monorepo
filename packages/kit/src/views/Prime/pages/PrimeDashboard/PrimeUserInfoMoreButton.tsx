import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Badge,
  Dialog,
  Divider,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useFetchPrimeUserInfo } from '../../hooks/useFetchPrimeUserInfo';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';

function PrimeUserInfoMoreButtonDropDownMenu({
  handleActionListClose,
  doPurchase,
}: {
  handleActionListClose: () => void;
  doPurchase?: () => Promise<void>;
}) {
  const { logout, user } = usePrimeAuthV2();
  const isPrime = user?.primeSubscription?.isActive;
  const primeExpiredAt = user?.primeSubscription?.expiresAt;
  const { fetchPrimeUserInfo } = useFetchPrimeUserInfo();
  const { getCustomerInfo } = usePrimePayment();
  const intl = useIntl();

  const userInfo = (
    <Stack px="$2" py="$2.5" gap="$1">
      <XStack alignItems="center" gap="$2">
        <SizableText flex={1} size="$headingSm">
          {user?.email}
        </SizableText>
        {isPrime ? (
          <Badge bg="$brand3" badgeSize="sm">
            <Badge.Text color="$brand11">Prime</Badge.Text>
          </Badge>
        ) : (
          <Badge badgeType="default" badgeSize="sm">
            Free
          </Badge>
        )}
      </XStack>
      {primeExpiredAt && isPrime ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          Ends on {formatDateFns(new Date(primeExpiredAt))}
        </SizableText>
      ) : null}
    </Stack>
  );
  return (
    <>
      {userInfo}
      {/* <ActionList.Item
        label="Change email"
        icon="EmailOutline"
        onClose={handleActionListClose}
        onPress={() => {
          Toast.success({
            title: 'Change email not implemented',
          });
          updateEmail();
        }}
      /> */}
      {isPrime ? (
        <>
          <ActionList.Item
            label="Manage subscription"
            icon="CreditCardOutline"
            onClose={handleActionListClose}
            onPress={async () => {
              if (user.subscriptionManageUrl) {
                openUrlUtils.openUrlExternal(user.subscriptionManageUrl);
              } else {
                Toast.message({
                  title: 'Please try again later',
                });
                await Promise.all([fetchPrimeUserInfo(), getCustomerInfo()]);
              }
            }}
          />
          <ActionList.Item
            label="Change Subscription"
            icon="CreditCardOutline"
            onClose={handleActionListClose}
            onPress={async () => {
              void doPurchase?.();
            }}
          />
        </>
      ) : null}
      <Divider mx="$2" my="$1" />
      <ActionList.Item
        label={intl.formatMessage({
          id: ETranslations.prime_log_out,
        })}
        icon="LogoutOutline"
        onClose={handleActionListClose}
        onPress={() => {
          Dialog.show({
            icon: 'InfoCircleOutline',
            title: intl.formatMessage({
              id: ETranslations.prime_onekeyid_log_out,
            }),
            description: 'Are you sure you want to log out?',
            onConfirmText: intl.formatMessage({
              id: ETranslations.prime_log_out,
            }),
            onConfirm: () => logout(),
          });
        }}
      />
    </>
  );
}

export function PrimeUserInfoMoreButton({
  doPurchase,
}: {
  doPurchase?: () => Promise<void>;
}) {
  const renderItems = useCallback(
    ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
      handleActionListOpen: () => void;
    }) => (
      <PrimeUserInfoMoreButtonDropDownMenu
        handleActionListClose={handleActionListClose}
        doPurchase={doPurchase}
      />
    ),
    [doPurchase],
  );
  return (
    <ActionList
      title="Account"
      floatingPanelProps={{
        w: '$80',
      }}
      renderItems={renderItems}
      renderTrigger={
        <IconButton
          icon="DotHorOutline"
          variant="tertiary"
          size="small"
          onPress={() => {
            console.log('1');
          }}
        />
      }
    />
  );
}
