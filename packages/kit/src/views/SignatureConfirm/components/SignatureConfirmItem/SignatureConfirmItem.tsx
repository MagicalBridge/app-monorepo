import type { ISizableTextProps, IYStackProps } from '@onekeyhq/components';
import { SizableText, YStack } from '@onekeyhq/components';

function SignatureConfirmItemLabel(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" color="$textSubdued" {...props} />;
}

function SignatureConfirmItemValue(props: ISizableTextProps) {
  return <SizableText size="$bodyMd" {...props} />;
}

type ISignatureConfirmItemType = IYStackProps & {
  compact?: boolean;
  compactAll?: boolean;
};

function SignatureConfirmItem(props: ISignatureConfirmItemType) {
  const { compact, compactAll, ...rest } = props;
  return (
    <YStack
      gap="$1"
      {...(compact && {
        $gtMd: {
          flexBasis: '50%',
        },
      })}
      {...(compactAll && {
        flexBasis: '50%',
      })}
      {...rest}
    />
  );
}

SignatureConfirmItem.Label = SignatureConfirmItemLabel;
SignatureConfirmItem.Value = SignatureConfirmItemValue;

export { SignatureConfirmItem };
