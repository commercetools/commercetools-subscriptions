# How to run

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

# Table of Contents

- [Commercetools project requirements](#commercetools-project-requirements)
  - [Types](#types)
  - [States](#states)
- [Running commercetools-subscriptions](#running-commercetools-subscriptions)
  - [Environment variables](#environment-variables)
  - [Run as node application](#run-as-node-application)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Commercetools project requirements

Resources below are required for the commercetools-subscriptions to operate correctly.

### Types

1. [Checkout order](../resources/checkout-order-type.json)
1. [Checkout order line item](../resources/checkout-order-line-item-type.json)
1. [Subscription order](../resources/subscription-order-type.json)
1. [Subscription template order](../resources/subscription-template-order-type.json)

### States

States allow to put the `subscription-template-order` into different states and since order state changes emit a [OrderStateTransitionMessage](https://docs.commercetools.com/api/message-types#orderstatetransitionmessage) one can either pull them from the message queue or query directly from the API.

The `subscription-template-order` is using its own state machine. Below is the list of all the required states:

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
| ----------------- | ---------------------------------------------------------- | -------- | ----------------------------------------------- |
| CTP_PROJECT_KEY   | commercetools project key                                  | YES      |
| CTP_CLIENT_ID     | OAuth 2.0 client_id and can be used to obtain a token.     | YES      |
| CTP_CLIENT_SECRET | OAuth 2.0 client_secret and can be used to obtain a token. | YES      |
| CTP_API_URL       | The commercetools HTTP API is hosted at that URL.          | NO       | https://api.europe-west1.gcp.commercetools.com  |
| CTP_AUTH_URL      | The commercetools OAuth 2.0 service is hosted at that URL. | NO       | https://auth.europe-west1.gcp.commercetools.com |

## Running commercetools-subscriptions

### Environment variables

| Name                            | Content                                                                                                                                  | Required | Default                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| CTP_PROJECT_KEY                 | commercetools project key                                                                                                                | YES      |
| CTP_CLIENT_ID                   | OAuth 2.0 client_id and can be used to obtain a token.                                                                                   | YES      |
| CTP_CLIENT_SECRET               | OAuth 2.0 client_secret and can be used to obtain a token.                                                                               | YES      |
| SUBSCRIPTION_ORDER_CREATION_URL | URL that will be called to created a subscription order. For more info see [IntegrationGuide](./IntegrationGuide.md)                     | YES      |
| CTP_API_URL                     | The commercetools HTTP API is hosted at that URL.                                                                                        | NO       | https://api.europe-west1.gcp.commercetools.com  |
| CTP_AUTH_URL                    | The commercetools OAuth 2.0 service is hosted at that URL.                                                                               | NO       | https://auth.europe-west1.gcp.commercetools.com |
| CUSTOM_HEADERS                  | Custom header that will be passed when calling `SUBSCRIPTION_ORDER_CREATION_URL`. Must be as stringified JSON.                           | NO       |
| BASIC_AUTH_USERNAME             | If both `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` are present, the values will be base64 encoded and passed as Basic Authorization | NO       |
| BASIC_AUTH_PASSWORD             | If both `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` are present, the values will be base64 encoded and passed as Basic Authorization | NO       |

### Run as node application

To run `commercetools-subscriptions` as node application, use the following command:

```
export CTP_PROJECT_KEY=xxx
export CTP_CLIENT_ID=xxx
export CTP_CLIENT_SECRET=xxx
export SUBSCRIPTION_ORDER_CREATION_URL=https://your-url-to-create-subscription-order.com
export CUSTOM_HEADERS={"Loyalty-Partner-Forward": 123}
export BASIC_AUTH_USERNAME=username
export BASIC_AUTH_PASSWORD=password
node ./src/index.js
```
