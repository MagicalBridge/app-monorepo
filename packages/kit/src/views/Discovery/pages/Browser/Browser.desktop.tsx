import { memo, useEffect, useMemo, useRef } from 'react';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';

import DesktopBrowserContent from './DesktopBrowserContent';
import DesktopBrowserNavigationContainer from './DesktopBrowserNavigationContainer';
import { withBrowserProvider } from './WithBrowserProvider';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();

  const navigation = useAppNavigation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (
      !firstRender.current &&
      // unpin == 0
      tabs.filter((x) => !x.isPinned).length === 0 &&
      // pin & active == 0
      tabs.filter((x) => x.isPinned && x.isActive).length === 0
    ) {
      navigation.switchTab(ETabRoutes.Discovery);
    }
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, [tabs, navigation]);

  useDAppNotifyChanges({ tabId: activeTabId });

  // Sort tabs by id to maintain stable order and prevent re-renders
  const orderTabs = useMemo(
    () => [...tabs].sort((a, b) => a.id.localeCompare(b.id)),
    [tabs],
  );

  return (
    <Page>
      <Page.Header
        // @ts-expect-error
        headerTitle={DesktopBrowserNavigationContainer}
        // @ts-expect-error
        headerRight={HeaderRightToolBar}
      />
      <Page.Body>
        {orderTabs.map((t) => (
          <DesktopBrowserContent
            key={t.id}
            id={t.id}
            activeTabId={activeTabId}
          />
        ))}
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(DesktopBrowser));
