import { Link, useNavigate } from 'react-router';
import { AddToCartButton } from './AddToCartButton';
import { useAside } from './Aside';

/**
 * @param {{
 *   productOptions: MappedProductOptions[];
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 *   product: ProductFragment;
 *   userEmail?: string | null;
 *   userType?: string | null;
 * }}
 */
export function ProductForm({
  productOptions,
  selectedVariant,
  product,
  userEmail,
  userType,
}) {
  const navigate = useNavigate();
  const { open } = useAside();

  const effectiveUserType =
    userType || (userEmail ? 'logged_in' : 'visitor');

  const handleAddToCartClick = () => {
    // Open the cart aside as before
    open('cart');

    // Push add_to_cart event to dataLayer for GTM / Klaviyo
    if (typeof window !== 'undefined' && window.dataLayer && selectedVariant) {
      window.dataLayer.push({
        event: 'add_to_cart',
        user_email: userEmail || null,
        user_type: effectiveUserType,
        page_type: 'product',
        product_id: product?.id ?? null,
        product_title:
          product?.title || selectedVariant?.product?.title || '',
        product_handle:
          product?.handle || selectedVariant?.product?.handle || '',
        product_vendor: product?.vendor || '',
        variant_id: selectedVariant?.id || null,
        variant_title: selectedVariant?.title || '',
        quantity: 1,
        price: selectedVariant?.price?.amount ?? null,
        currency: selectedVariant?.price?.currencyCode ?? null,
      });
    }
  };

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        // If there is only a single value in the option values, don't display the option
        if (option.optionValues.length === 1) return null;

        return (
          <div className="product-options" key={option.name}>
            <h5>{option.name}</h5>
            <div className="product-options-grid">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                if (isDifferentProduct) {
                  // When the variant is a combined listing child product
                  // that leads to a different url, render as a link
                  return (
                    <Link
                      className="product-options-item"
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  // When the variant is just an update to search params
                  return (
                    <button
                      type="button"
                      className={`product-options-item${exists && !selected ? ' link' : ''
                        }`}
                      key={option.name + name}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          void navigate(`?${variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </button>
                  );
                }
              })}
            </div>
            <br />
          </div>
        );
      })}
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        onClick={handleAddToCartClick}
        lines={
          selectedVariant
            ? [
              {
                merchandiseId: selectedVariant.id,
                quantity: 1,
                selectedVariant,
              },
            ]
            : []
        }
      >
        {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

/**
 * @param {{
 *   swatch?: Maybe<ProductOptionValueSwatch> | undefined;
 *   name: string;
 * }}
 */
function ProductOptionSwatch({ swatch, name }) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen').MappedProductOptions} MappedProductOptions */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').Maybe} Maybe */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').ProductOptionValueSwatch} ProductOptionValueSwatch */
/** @typedef {import('storefrontapi.generated').ProductFragment} ProductFragment */
