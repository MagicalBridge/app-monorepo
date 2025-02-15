import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';

import { contextAtomMethod, marketWatchListAtom } from './atoms';

export const homeResettingFlags: Record<string, number> = {};

class ContextJotaiActionsMarket extends ContextJotaiActionsBase {
  syncToDb = contextAtomMethod((_, set, payload: IMarketWatchListItem[]) => {
    const result = { data: payload };
    set(marketWatchListAtom(), result);
    void backgroundApiProxy.simpleDb.marketWatchList.setRawData(result);
  });

  isInWatchList = contextAtomMethod((get, set, coingeckoId: string) => {
    const prev = get(marketWatchListAtom());
    return !!prev.data?.find((i) => i.coingeckoId === coingeckoId);
  });

  addIntoWatchList = contextAtomMethod(
    (get, set, payload: IMarketWatchListItem | IMarketWatchListItem[]) => {
      const params = !Array.isArray(payload) ? [payload] : payload;
      const prev = get(marketWatchListAtom());
      if (!prev.isMounted) {
        return;
      }
      const watchList = [...prev.data, ...params];
      this.syncToDb.call(set, watchList);
    },
  );

  removeFormWatchList = contextAtomMethod(
    (get, set, payload: IMarketWatchListItem) => {
      const prev = get(marketWatchListAtom());
      if (!prev.isMounted) {
        return;
      }
      const watchList = prev.data.filter(
        (i) => i.coingeckoId !== payload.coingeckoId,
      );
      this.syncToDb.call(set, watchList);
    },
  );

  moveToTop = contextAtomMethod((get, set, payload: IMarketWatchListItem) => {
    const prev = get(marketWatchListAtom());
    if (!prev.isMounted) {
      return;
    }
    const newItems = prev.data.filter(
      (i) => i.coingeckoId !== payload.coingeckoId,
    );
    const watchList = [payload, ...newItems];
    this.syncToDb.call(set, watchList);
  });

  saveWatchList = contextAtomMethod(
    (get, set, payload: IMarketWatchListItem[]) => {
      const prev = get(marketWatchListAtom());
      if (!prev.isMounted) {
        return;
      }
      this.syncToDb.call(set, payload);
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsMarket());

export function useWatchListActions() {
  const actions = createActions();
  const addIntoWatchList = actions.addIntoWatchList.use();
  const removeFormWatchList = actions.removeFormWatchList.use();
  const moveToTop = actions.moveToTop.use();
  const isInWatchList = actions.isInWatchList.use();
  const saveWatchList = actions.saveWatchList.use();
  return useRef({
    isInWatchList,
    addIntoWatchList,
    removeFormWatchList,
    moveToTop,
    saveWatchList,
  });
}
