import { redirect, useLoaderData, useRouteLoaderData } from 'react-router';
import { useEffect } from 'react';
import { getPaginationVariables, Analytics } from '@shopify/hydrogen';
import { PaginatedResourceSection } from '~/components/PaginatedResourceSection';
import { redirectIfHandleIsLocalized } from '~/lib/redirect';
import { ProductItem } from '~/components/ProductItem';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({ data }) => {
  return [{ title: `Hydrogen | ${data?.collection.title ?? ''} Collection` }];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return { ...deferredData, ...criticalData };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({ context, params, request }) {
  const { handle } = params;
  const { storefront } = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    throw redirect('/collections');
  }

  const [{ collection }] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: { handle, ...paginationVariables },
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, { handle, data: collection });

  return {
    collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({ context }) {
  return {};
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const { collection } = useLoaderData();
  const rootData = useRouteLoaderData('root');

  // ✅ unified email + user type from root loader (same as product page)
  const userEmail = rootData?.customerEmail ?? null;
  const userType = userEmail ? 'logged_in' : 'visitor';

  // Flatten product details from this collection for tracking
  const products = collection?.products?.nodes ?? [];
  const productIds = products.map((p) => p.id);
  const productHandles = products.map((p) => p.handle);
  const productTitles = products.map((p) => p.title);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const waitForGTM = () => {
      return new Promise((resolve) => {
        if (window.google_tag_manager && window.dataLayer) {
          resolve(true);
          return;
        }
        let attempts = 0;
        const maxAttempts = 50;
        const interval = setInterval(() => {
          attempts++;
          if (window.google_tag_manager && window.dataLayer) {
            clearInterval(interval);
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
      });
    };

    waitForGTM().then((isReady) => {
      if (!isReady) return;

      // Optional: user info event (you already use this on product pages)
      window.dataLayer.push({
        event: 'user_data_available',
        user_type: userType,
        user_email: userEmail || null,
      });

      // ✅ collection page view details with full context
      window.dataLayer.push({
        event: 'collection_page_view',
        page_type: 'collection',

        // collection-level
        collection_id: collection.id,
        collection_handle: collection.handle,
        collection_title: collection.title,
        collection_description: collection.description ?? '',

        // user-level
        user_email: userEmail || null,
        user_type: userType,

        // products in this collection (arrays)
        collection_product_ids: productIds,
        collection_product_handles: productHandles,
        collection_product_titles: productTitles,
      });
    });
  }, [collection, userEmail, userType]);

  return (
    <div className="collection">
      <h1>{collection.title}</h1>
      <p className="collection-description">{collection.description}</p>
      <PaginatedResourceSection
        connection={collection.products}
        resourcesClassName="products-grid"
      >
        {({ node: product, index }) => (
          <ProductItem
            key={product.id}
            product={product}
            loading={index < 8 ? 'eager' : undefined}
          />
        )}
      </PaginatedResourceSection>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
`;

/** @typedef {import('./+types/collections.$handle').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
