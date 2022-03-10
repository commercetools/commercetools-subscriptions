# How to run

## Commercetools project requirements

Resources below are required for the commercetools-subscriptions to operate correctly.

### Types

1. [Checkout order](../resources/checkout-order-type.json)
1. [Checkout order line item](../resources/checkout-order-line-item-type.json)
1. [Subscription order](../resources/subscription-order-type.json)
1. [Subscription template order](../resources/subscription-template-order-type.json)

### States

States allow to put the `subscription-template-order` into different states and since order state changes emit a [OrderStateTransitionMessage](https://docs.commercetools.com/api/message-types#orderstatetransitionmessage) one can either pull them from the message queue or query directly from the API.

The `subscription-template-order` is using its own state machine which is not shared with other states required by the shop. Below is the list of all the required states:

1. [commercetools-subscriptions-active](../resources/active-state.json)
1. [commercetools-subscriptions-sendReminder](../resources/send-reminder-state.json)
1. [commercetools-subscriptions-cancelled](../resources/cancelled-state.json)
1. [commercetools-subscriptions-error](../resources/error-state.json)
1. [commercetools-subscriptions-paused](../resources/paused-state.json)
1. [commercetools-subscriptions-reminderSent](../resources/reminder-sent-state.json)

We created a script to create required subscription-states:

```
export CTP_PROJECT_KEY=xxx
export CTP_CLIENT_ID=xxx
export CTP_CLIENT_SECRET=xxx
npm run "setup-subscription-states"
```

| Name              | Content                                                    | Required |
| ----------------- | ---------------------------------------------------------- | -------- |
| CTP_PROJECT_KEY   | commercetools project key                                  | YES      |
| CTP_CLIENT_ID     | OAuth 2.0 client_id and can be used to obtain a token.     | YES      |
| CTP_CLIENT_SECRET | OAuth 2.0 client_secret and can be used to obtain a token. | YES      |
