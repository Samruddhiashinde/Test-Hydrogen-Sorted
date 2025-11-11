import { ServerRouter } from 'react-router';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { createContentSecurityPolicy } from '@shopify/hydrogen';

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
  context,
) {
  const { nonce, header, NonceProvider } = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'strict-dynamic'",
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://www.googletagmanager.com',
      'https://*.googletagmanager.com',
      'https://tagmanager.google.com',
      'https://cdn.shopify.com',
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.shopify.com',
      'https://tagmanager.google.com',
      'https://fonts.googleapis.com',
    ],
    connectSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://monorail-edge.shopifysvc.com',
      'https://www.googletagmanager.com',
      'https://*.googletagmanager.com',
      'https://tagmanager.google.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'http://localhost:*',
      'ws://localhost:*',
      'ws://127.0.0.1:*',
      'ws://*.tryhydrogen.dev:*',
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https://cdn.shopify.com',
      'https://*.cdn.shopify.com',
      'https://www.googletagmanager.com',
      'https://ssl.gstatic.com',
      'https://www.gstatic.com',
      'https://fonts.gstatic.com',
    ],
    fontSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://fonts.gstatic.com',
    ],
    frameSrc: ['https://checkout.shopify.com'],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter context={reactRouterContext} url={request.url} nonce={nonce} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}


/** @typedef {import('@shopify/hydrogen').HydrogenRouterContextProvider} HydrogenRouterContextProvider */
/** @typedef {import('react-router').EntryContext} EntryContext */