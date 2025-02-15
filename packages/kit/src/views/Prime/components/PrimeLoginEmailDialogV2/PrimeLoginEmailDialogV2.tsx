import { useCallback } from 'react';

import pRetry from 'p-retry';
import { useIntl } from 'react-intl';

import { Dialog, Form, Input, Stack, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { usePrivyUniversalV2 } from '../../hooks/usePrivyUniversalV2';
import { PrimeLoginEmailCodeDialogV2 } from '../PrimeLoginEmailCodeDialogV2';

export function PrimeLoginEmailDialogV2() {
  const { getAccessToken, useLoginWithEmail } = usePrivyUniversalV2();
  const { sendCode, loginWithCode } = useLoginWithEmail({
    onComplete: async () => {
      const token = await getAccessToken();
      await backgroundApiProxy.servicePrime.apiLogin({
        accessToken: token || '',
      });
    },
    onError: (error) => {
      console.log(error);
    },
  });
  const intl = useIntl();

  const form = useForm<{ email: string }>({
    defaultValues: { email: '' },
  });

  const submit = useCallback(
    async (options: { preventClose?: () => void } = {}) => {
      const { preventClose } = options;
      await form.trigger();
      if (!form.formState.isValid) {
        preventClose?.();
        return;
      }
      const data = form.getValues();

      try {
        Dialog.show({
          renderContent: (
            <PrimeLoginEmailCodeDialogV2
              sendCode={sendCode}
              loginWithCode={loginWithCode}
              email={data.email}
            />
          ),
        });

        await pRetry(
          async () => {
            await sendCode({ email: data.email });
          },
          {
            retries: 2,
            maxTimeout: 10_000,
          },
        );
      } catch (error) {
        preventClose?.();
        throw error;
      }
    },
    [form, loginWithCode, sendCode],
  );

  return (
    <Stack>
      <Dialog.Icon icon="EmailOutline" />
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.prime_signup_login,
        })}
      </Dialog.Title>
      <Dialog.Description>
        {intl.formatMessage({
          id: ETranslations.prime_onekeyid_continue_description,
        })}
      </Dialog.Description>
      <Stack pt="$4">
        <Form form={form}>
          <Form.Field
            name="email"
            rules={{
              validate: (value) => {
                if (!value) {
                  return false;
                }
                if (!stringUtils.isValidEmail(value)) {
                  return intl.formatMessage({
                    id: ETranslations.prime_onekeyid_email_error,
                  });
                }
                return true;
              },
              required: {
                value: true,
                message: '',
              },
              onChange: () => {
                form.clearErrors();
              },
            }}
          >
            <Input
              keyboardType="email-address"
              autoFocus
              autoCapitalize="none"
              size="large"
              placeholder="your@email.com"
              flex={1}
              onChangeText={(text) => text?.trim() ?? text}
              onSubmitEditing={() => submit()}
            />
          </Form.Field>
        </Form>
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        confirmButtonProps={{
          disabled: !form.formState.isValid,
        }}
        onConfirm={async ({ preventClose }) => {
          await submit({ preventClose });
        }}
      />
    </Stack>
  );
}
