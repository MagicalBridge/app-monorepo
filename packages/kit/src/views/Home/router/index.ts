import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { urlAccountLandingRewrite } from '../pages/urlAccount/urlAccountUtils';

const HomePageContainer = LazyLoadPage(
  () => import('../pages/HomePageContainer'),
);

const UrlAccountPageContainer = LazyLoadPage(async () => {
  const { UrlAccountPageContainer: UrlAccountPageContainerModule } =
    await import('../pages/urlAccount/UrlAccountPage');
  return { default: UrlAccountPageContainerModule };
});

const UrlAccountLanding = LazyLoadPage(async () => {
  const { UrlAccountLanding: UrlAccountLandingModule } = await import(
    '../pages/urlAccount/UrlAccountPage'
  );
  return { default: UrlAccountLandingModule };
});

export const urlAccountRoutes = [
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
  },
];

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    // translationId: 'wallet__wallet',
    rewrite: '/',
    headerShown: !platformEnv.isNative,
  },
  {
    // web refresh will match this route first, make sure it's different url from the home route
    name: ETabHomeRoutes.TabHomeUrlAccountLanding,
    component: UrlAccountLanding,
    rewrite: urlAccountLandingRewrite,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
    exact: true,
  },
];
