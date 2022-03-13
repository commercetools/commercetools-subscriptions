# Integration guide

## Terminology

- **checkout-order**: an order which customers create during the checkout. It may contain one or more subscriptions.
- **template-order**: an order which manages a single subscription and is used as a template to create a
  subscription-order.

## Before you begin

Create all the required custom types and states located in [resources folder](./resources).  Check [project requirements](./docs/HowToRun.md#commercetools-project-requirements) for more details.

## Step 1: Create a checkout order with subscriptions

`commercetools-subscriptions` processes only orders with subscription line items.

<details>
<summary> Click to expand an example order draft. In
the example, there is 1 subscription line item for wine and 1 line item for pants</summary>

```
{
  "orderNumber": "10000",
  "customerEmail": "test@test.com",
  "totalPrice": {
    "currencyCode": "EUR",
    "centAmount": 18000
  },
  "lineItems": [
    {
      "name": {
        "en": "Wine subscription"
      },
      "variant": {
        "sku": "wine01"
      },
      "price": {
        "value": {
          "type": "centPrecision",
          "currencyCode": "EUR",
          "centAmount": 18000,
          "fractionDigits": 2
        },
        "country": "DE"
      },
      "quantity": 1,
      "custom": {
        "type": {
          "typeId": "type",
          "key": "checkout-order-line-item"
        },
        "fields": {
          "cutoffDays": 5,
          "reminderDays": 5,
          "subscriptionKey": "UNIQUE_SUBSCRIPTION_KEY",
          "isSubscription": true,
          "schedule": "0 0 1 Feb,May,Aug,Nov *"
        }
      }
    },
    {
      "name": {
        "en": "Pants"
      },
      "variant": {
        "sku": "pants"
      },
      "price": {
        "value": {
          "type": "centPrecision",
          "currencyCode": "EUR",
          "centAmount": 8000,
          "fractionDigits": 2
        },
        "country": "DE"
      },
      "quantity": 1
    }
  ],
  "custom": {
    "type": {
      "typeId": "type",
      "key": "checkout-order"
    },
    "fields": {
      "hasSubscription": true
    }
  }
}
```

</details>

Checkout order with subscriptions contains following custom fields:

### Checkout order custom fields:

| Name                    | Type    | Description                                                                                                                           | Required |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| hasSubscription         | boolean | True if the order contains line items that should be processed as subscriptions                                                       | YES      |
| isSubscriptionProcessed | boolean | True if the order has already been processed by `commercetools-subscriptions.` This attribute is set by `commercetools-subscriptions` | NO       |

### Checkout line item custom fields

| Name            | Type    | Description                                                                                                                                                                                             | Required |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| isSubscription  | boolean | True if the line item represents a subscription                                                                                                                                                         | YES      |
| schedule        | String  | Cron syntax which defines the trigger cycle of the subscription-order                                                                                                                                   | YES      |
| subscriptionKey | String  | It will be used to generate unique orderNumber(s) for the template orders. It has to be unique across all commercetools order API lineItems.                                                            | YES      |
| reminderDays    | Number  | Defines the amount of days the reminder should be triggered before the next delivery                                                                                                                    | NO       |
| cutoffDays      | Number  | If the amount of days since placing of the checkout-order until the next scheduled subscription order is equal or smaller than cutoffDays then the next closest subscription-order creation is skipped. | NO       |

cutoffDays: This setting allows omitting scenarios where a customer gets 2 subscription deliveries within a very short period if the checkout-order has been placed shortly before the next scheduled period begins.
Example: Let's assume we trigger a subscription-order every 1st of February and 1st of May, cutoffDays is set to 15:

- If the checkout-order was placed until 15 of January then the next subscription-order creation is planned for the 1st of February.
- If the checkout-order was placed between 16 - 31 of January then the next subscription-order creation is planned for the 1st of May.
