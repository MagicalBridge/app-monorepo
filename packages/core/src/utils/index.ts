import coinselectUtils from '@onekeyfe/coinselect/utils';

import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IEncodedTxBtc } from '../chains/btc/types';

/**
 * m/44'/60'/x'/0/0 -> m/44'/60' for prefix, {index}/0/0 for suffix
 * @param template derivation path template
 * @returns string
 */
export function slicePathTemplate(template: string) {
  return accountUtils.slicePathTemplate(template);
}

export function getUtxoAccountPrefixPath({ fullPath }: { fullPath: string }) {
  const pathComponent = fullPath.split('/');
  pathComponent.pop();
  pathComponent.pop();
  const prefixPath = pathComponent.join('/');
  return prefixPath;
}

export function getBIP44Path(account: IDBUtxoAccount, address: string) {
  let realPath = '';
  for (const [key, value] of Object.entries(account.addresses)) {
    if (value === address) {
      realPath = key;
      break;
    }
  }
  return `${account.path}/${realPath}`;
}

export function estimateTxSize(
  inputsForCoinSelect: IEncodedTxBtc['inputsForCoinSelect'],
  outputsForCoinSelect: IEncodedTxBtc['outputsForCoinSelect'],
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return coinselectUtils.transactionBytes(
    inputsForCoinSelect,
    outputsForCoinSelect,
  );
}
