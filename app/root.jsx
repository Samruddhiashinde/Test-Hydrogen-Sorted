import { Analytics, getShopAnalytics, useNonce } from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';

import favicon from '~/assets/favicon.svg';
import { FOOTER_QUERY, HEADER_QUERY } from '~/lib/fragments';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import { PageLayout } from './components/PageLayout';
import { CUSTOMER_EMAIL_QUERY } from '~/graphql/customer-account/CustomerEmailQuery';

export const shouldRevalidate = ({ formMethod, currentUrl, nextUrl }) => {
  if (formMethod && formMethod !== 'GET') return true;
  if (currentUrl.toString() === nextUrl.toString()) return true;
  return false;
};

export function links() {
  return [
    { rel: 'preconnect', href: 'https://cdn.shopify.com' },
    { rel: 'preconnect', href: 'https://shop.app' },
    { rel: 'preconnect', href: 'https://www.googletagmanager.com' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous',
    },
    { rel: 'dns-prefetch', href: 'https://www.googletagmanager.com' },
    { rel: 'icon', type: 'image/svg+xml', href: favicon },
    { rel: 'stylesheet', href: resetStyles },
    { rel: 'stylesheet', href: appStyles },
  ];
}

export async function loader(args) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);

  const { storefront, env, customerAccount } = args.context;

  let customerEmail = null;
  try {
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (isLoggedIn) {
      const { data } = await customerAccount.query(CUSTOMER_EMAIL_QUERY, {
        variables: {
          language: customerAccount.i18n.language,
        },
      });
      customerEmail = data?.customer?.emailAddress?.emailAddress ?? null;
    }
  } catch {
    customerEmail = null;
  }

  return {
    ...deferredData,
    ...criticalData,
    customerEmail,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
    gtmId: env.PUBLIC_GTM_ID,
  };
}

async function loadCriticalData({ context }) {
  const { storefront } = context;
  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: { headerMenuHandle: 'main-menu' },
    }),
  ]);
  return { header };
}

function loadDeferredData({ context }) {
  const { storefront, customerAccount, cart } = context;

  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: { footerMenuHandle: 'footer' },
    })
    .catch(() => null);

  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({ children }) {
  const nonce = useNonce();
  const data = useRouteLoaderData('root');

  // JSON-encode safely for inline scripts
  const safeEmail = JSON.stringify(data?.customerEmail ?? null);

  const dataLayerInitScript = `
    window.dataLayer = window.dataLayer || [];
  `;

  const userInfoPushScript = `
    if (${safeEmail} !== null) {
      window.dataLayer.push({
        event: 'user_info',
        user_email: ${safeEmail}
      });
    }
  `;

  const gtmLoaderScript = `
    (function(w,d,s,l,i,n){
      w[l]=w[l]||[];
      w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
      var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),
        dl=l!='dataLayer'?'&l='+l:'';
      j.async=true;
      j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
      if(n) { j.setAttribute('nonce', '${nonce}'); }
      f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${data?.gtmId}');
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Links />
        <Meta />

        {data?.gtmId && (
          <>
            <script
              nonce={nonce || undefined}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: dataLayerInitScript }}
            />
            <script
              nonce={nonce || undefined}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: userInfoPushScript }}
            />
            <script
              nonce={nonce || undefined}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: gtmLoaderScript }}
            />
          </>
        )}
      </head>
      {/* ✅ expose the email globally on body for hooks */}
      <body data-customer-email={data?.customerEmail ?? ''}>
        {data?.gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${data.gtmId}`}
              height="0"
              width="0"
              title="Google Tag Manager"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        {children}
        <ScrollRestoration nonce={nonce || undefined} />
        <Scripts nonce={nonce || undefined} />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData('root');
  if (!data) return <Outlet />;

  return (
    <Analytics.Provider cart={data.cart} shop={data.shop} consent={data.consent}>
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let message = 'Unknown error';
  let status = 500;

  if (isRouteErrorResponse(error)) {
    message = error?.data?.message ?? error.data;
    status = error.status;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="route-error">
      <h1>Oops</h1>
      <h2>{status}</h2>
      <pre>{message}</pre>
    </div>
  );
}

/** @typedef {LoaderReturnData} RootLoader */
/** @typedef {import('react-router').ShouldRevalidateFunction} ShouldRevalidateFunction */
/** @typedef {import('./+types/root').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
