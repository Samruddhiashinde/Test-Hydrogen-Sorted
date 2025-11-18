import { HydratedRouter } from 'react-router/dom';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { NonceProvider } from '@shopify/hydrogen';

if (!window.location.origin.includes('webcache.googleusercontent.com')) {
  startTransition(() => {
    // Find an existing script with nonce so CSP + client match
    const scriptWithNonce =
      document.querySelector('script[nonce]') ||
      document.querySelector('script[data-nonce]');
    const existingNonce =
      scriptWithNonce?.nonce ||
      scriptWithNonce?.getAttribute('data-nonce') ||
      null;

    hydrateRoot(
      document,
      <StrictMode>
        <NonceProvider value={existingNonce}>
          <HydratedRouter />
        </NonceProvider>
      </StrictMode>,
    );
  });
}
