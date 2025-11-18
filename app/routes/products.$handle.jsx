import { useLoaderData, useRouteLoaderData } from 'react-router';
import { useEffect } from 'react';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import { ProductPrice } from '~/components/ProductPrice';
import { ProductImage } from '~/components/ProductImage';
import { ProductForm } from '~/components/ProductForm';
import { redirectIfHandleIsLocalized } from '~/lib/redirect';
import { useScrollTracking } from '~/hooks/useScrollTracking';
import { CUSTOMER_EMAIL_QUERY } from '~/graphql/customer-account/CustomerEmailQuery';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({ data }) => [
  { title: `Hydrogen | ${data?.product.title ?? ''}` },
  { rel: 'canonical', href: `/products/${data?.product.handle}` },
];

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return { ...deferredData, ...criticalData };
}

async function loadCriticalData({ context, params, request }) {
  const { handle } = params;
  const { storefront } = context;
  if (!handle) throw new Error('Expected product handle to be defined');

  const [{ product }] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: { handle, selectedOptions: getSelectedProductOptions(request) },
    }),
  ]);

  if (!product?.id) throw new Response(null, { status: 404 });

  redirectIfHandleIsLocalized(request, { handle, data: product });

  return { product };
}

async function loadDeferredData({ context }) {
  const { customerAccount } = context;

  const customer = await customerAccount
    .isLoggedIn()
    .then(async (isLoggedIn) => {
      if (!isLoggedIn) return null;

      try {
        const { data } = await customerAccount.query(CUSTOMER_EMAIL_QUERY, {
          variables: { language: customerAccount.i18n.language },
        });
        return {
          isLoggedIn: true,
          email: data?.customer?.emailAddress?.emailAddress ?? null,
        };
      } catch {
        return null;
      }
    })
    .catch(() => null);

  return { customer };
}

export default function Product() {
  const { product, customer } = useLoaderData();
  const rootData = useRouteLoaderData('root');

  // ✅ unified email for the page
  const userEmail = customer?.email || rootData?.customerEmail || null;
  const userType = userEmail ? 'logged_in' : 'visitor';

  // ✅ scroll tracking always knows email + page type
  useScrollTracking([25, 50, 75, 100], {
    pageType: 'product',
    userEmail,
  });

  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

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

      // user info event for GTM/Klaviyo identify
      window.dataLayer.push({
        event: 'user_data_available',
        user_type: userType,
        user_email: userEmail || null,
      });

      // product page view details (now with variant + price)
      window.dataLayer.push({
        event: 'product_page_view',
        page_type: 'product',

        // product-level
        product_id: product.id,
        product_title: product.title,
        product_handle: product.handle,
        product_vendor: product.vendor,

        // user-level
        user_email: userEmail || null,
        user_type: userType,

        // variant + pricing
        variant_id: selectedVariant?.id ?? null,
        variant_title: selectedVariant?.title ?? '',
        price: selectedVariant?.price?.amount ?? null,
        currency: selectedVariant?.price?.currencyCode ?? null,
      });
    });
  }, [product, userEmail, userType, selectedVariant]);

  return (
    <div className="product">
      <ProductImage image={selectedVariant?.image} />
      <div className="product-main">
        <h1>{product.title}</h1>
        <ProductPrice
          price={selectedVariant?.price}
          compareAtPrice={selectedVariant?.compareAtPrice}
        />
        <br />
        {/* ✅ pass product + user info into ProductForm so we can track Add To Cart */}
        <ProductForm
          productOptions={productOptions}
          selectedVariant={selectedVariant}
          product={product}
          userEmail={userEmail}
          userType={userType}
        />
        <br />
        <br />
        <p>
          <strong>Description</strong>
        </p>
        <br />
        <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
        <br />
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
fragment ProductVariant on ProductVariant {
  availableForSale
  compareAtPrice {
    amount
    currencyCode
  }
  id
  image {
    __typename
    id
    url
    altText
    width
    height
  }
  price {
    amount
    currencyCode
  }
  product {
    title
    handle
  }
  selectedOptions {
    name
    value
  }
  sku
  title
  unitPrice {
    amount
    currencyCode
  }
}`;

const PRODUCT_FRAGMENT = `#graphql
fragment Product on Product {
  id
  title
  vendor
  handle
  descriptionHtml
  description
  encodedVariantExistence
  encodedVariantAvailability
  options {
    name
    optionValues {
      name
      firstSelectableVariant {
        ...ProductVariant
      }
      swatch {
        color
        image {
          previewImage {
            url
          }
        }
      }
    }
  }
  selectedOrFirstAvailableVariant(
    selectedOptions: $selectedOptions,
    ignoreUnknownOptions: true,
    caseInsensitiveMatch: true
  ) {
    ...ProductVariant
  }
  adjacentVariants(selectedOptions: $selectedOptions) {
    ...ProductVariant
  }
  seo {
    description
    title
  }
}
${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
query Product(
  $country: CountryCode
  $handle: String!
  $language: LanguageCode
  $selectedOptions: [SelectedOptionInput!]!
) @inContext(country: $country, language: $language) {
  product(handle: $handle) {
    ...Product
  }
}
${PRODUCT_FRAGMENT}
`;

/** @typedef {import('./+types/products.$handle').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
