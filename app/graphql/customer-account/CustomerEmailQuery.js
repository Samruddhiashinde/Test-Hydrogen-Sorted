// NOTE: https://shopify.dev/docs/api/customer/latest/queries/customer
export const CUSTOMER_EMAIL_QUERY = `#graphql
  query CustomerEmail($language: LanguageCode) @inContext(language: $language) {
    customer {
      emailAddress {
        emailAddress
      }
    }
  }
`;

