# How to run

## Commercetools project requirements

Resources below are required for the commercetools-subscriptions to operate correctly.

### Types

1. [Checkout order type](../resources/checkout-order-type.json)
1. [Checkout order line item type](../resources/checkout-order-line-item-type.json)
1. [Subscription order type](../resources/subscription-order-type.json)
1. [Subscription template order type](../resources/subscription-template-order-type.json)

### States

1. [Active state](../resources/active-state.json)
1. [Cancelled state](../resources/cancelled-state.json)
1. [Error state](../resources/error-state.json)
1. [Paused state](../resources/paused-state.json)
1. [Reminder sent state](../resources/reminder-sent-state.json)
1. [Send reminder state](../resources/send-reminder-state.json)

You can create these resources by running the command npm run setup-resources as below.

```
export CTP_PROJECT_KEY=xxx
export CTP_CLIENT_ID=xxx
export CTP_CLIENT_SECRET=xxx
export EXISTING_ORDER_TYPE_KEY=xxx
export EXISTING_ORDER_LINE_ITEM_TYPE_KEY=xxx
npm run setup-resources
```

| Name                              | Content                                                                                                                                                                                                                                                                                                    | Required |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| CTP_PROJECT_KEY                   | commercetools project key                                                                                                                                                                                                                                                                                  | YES      |
| CTP_CLIENT_ID                     | OAuth 2.0 client_id and can be used to obtain a token.                                                                                                                                                                                                                                                     | YES      |
| CTP_CLIENT_SECRET                 | OAuth 2.0 client_secret and can be used to obtain a token.                                                                                                                                                                                                                                                 | YES      |
| EXISTING_ORDER_TYPE_KEY           | Key of the existing order custom type. If provided, the script will merge `fieldDefinitions` from this type to the checkout order type. Use this option if you already have an order custom type and you want to use the attributes from this type with the checkout order type                            | NO       |
| EXISTING_ORDER_LINE_ITEM_TYPE_KEY | Key of the existing line item custom type. If provided, the script will merge `fieldDefinitions` from this type to the checkout order line item type. Use this option if you already have a line item custom type and you want to use the attributes from this type with the checkout order line item type | NO       |
