# Use cases

In this document, we will describe some use cases for the orders, events, and logs of the `commercetools-subscriptions` cronjob.

Here is some terminology used in this document:

- **checkout-order**: an order which customers create during the checkout. It may contain one or more subscriptions. `commercetools-subscriptions` will generate a **template-order** for every subscription.
- **template-order**: an order which manages a single subscription and is used as a template to create a subscription-order.
- **subscription-order**: a new order (actual delivery) triggered by the template order according to the defined schedule.
- **Logs**: Structured(json) logs of cronjob for unexpected cases, warnings, errors and useful information like statistics.
- **Order Messages**: These [messages](https://docs.commercetools.com/api/message-types#order-messages) represent a change or an action performed on an Order. Messages can be pulled via a REST API, or they can be pushed into a Message Queue by defining a Subscription.
- **Order API**: commercetools `/orders` endpoint, to perform some queries on subscription orders.
- **Order Import API**: commercetools `/orders/import` endpoint, to import an existing order without creating the carts.
- **Order Search API**: commercetools `/orders/search` endpoint, to perform search requests on a high number of Orders in a Project.

#### Notes

- We've created a [postman collection](./commercetools-subscription.postman_collection.json) for the queries that you might use as a playground and test with your use cases easily.This document and queries on it are documented to give some ideas, it's always good to follow the official commercetools documentation for the up to date information.
- We strongly suggest the Order search API usage for your order queries as it will have better performance on a high number of Orders in a Project.
  - Queries kept simple to have a compact documentation, so most of the queries do not include the details related to sorting, pagination etc.
  - On the Order Search API if no sorting is specified, the results are sorted by relevance in descending (desc) order.
  - The Order Search API does not return the resource data of the matching Orders. Instead, it returns a list of Order IDs, which can then be used to fetch the Orders by their ID.

## How to fetch template-orders ?

You might need to fetch template-orders, to support viewing and editing the template order.

The Order search query example:

```json
{
  "query": {
    "exists": {
      "field": "custom.schedule",
      "customType": "StringType"
    }
  }
}
```

In case you want to filter based on the customer email, then the query might be as below with adding `and` compound expression together with `customerEmail` filter.

```json
{
  "query": {
    "and": [
      {
        "exists": {
          "field": "custom.schedule",
          "customType": "StringType"
        }
      },
      {
        "exact": {
          "field": "customerEmail",
          "value": "test@test.com"
        }
      }
    ]
  }
}
```

Note that the Order Search API does not return the resource data of the matching Orders. Instead, it returns a list of Order IDs, which can then be used to fetch the [Orders by their ID](https://docs.commercetools.com/api/projects/orders#query-orders).

One example order query predicate to fetch this order might be sth like below:

- `id in ("{{orderId1}}","{{orderdId2}}", "{{orderId3}}", ...)`

Query Predicate examples for order API:

- `custom(fields(schedule is defined))`
- `custom(fields(schedule is defined)) AND customerEmail="test@test.com"`

### Logs and events related to template orders

1. For order creation, we use [Order import API](https://docs.commercetools.com/api/projects/orders-import#orderimportdraft). According to this an [OrderImportedMessage](https://docs.commercetools.com/api/message-types#orderimportedmessage) will be created by the commercetools platform when a template-order is imported.
2. In case, template-order **can not be created** from the checkout-order due to non-recoverable errors we log an error. It will contain the error details, together with the draft, and response details from the commercetools API.
   Log Message: `Failed to create template order from the checkout order with number ${checkoutOrder.orderNumber}.`
   Example log entry:

```json
{
  "name": "commercetools-subscriptions-0.0.1",
  "hostname": "ct-00891.local",
  "pid": 87606,
  "level": 50,
  "msg": "Failed to create template order from the checkout order with number 1646302276551. Skipping this checkout order Error: {\"jse_shortmsg\":\"Unexpected error on creating template order from checkout order with number: 1646302276551. Line item: [{\\\"id\\\":\\\"1bea71c8-7712-4db4-945f-095085e0e69b\\\",\\\"productId\\\":\\\"8671cacd-500e-44ac-b6ee-2beada092441\\\",\\\"productKey\\\":\\\"product-1\\\",\\\"name\\\":{\\\"en\\\":\\\"Wine subscription\\\"},\\\"productType\\\":{\\\"typeId\\\":\\\"product-type\\\",\\\"id\\\":\\\"93b85ce4-bd0a-4c42-9aa5-a45c71915c4a\\\"},\\\"productSlug\\\":{\\\"en\\\":\\\"wine-subscription\\\"},\\\"variant\\\":{\\\"id\\\":1,\\\"sku\\\":\\\"wine01\\\",\\\"prices\\\":[{\\\"id\\\":\\\"91cc2648-5b51-497d-8a24-69b77b762a23\\\",\\\"value\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"country\\\":\\\"DE\\\"}],\\\"images\\\":[],\\\"attributes\\\":[],\\\"assets\\\":[]},\\\"price\\\":{\\\"id\\\":\\\"a9c9dd05-ea46-4b34-b6a2-c31592156117\\\",\\\"value\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"country\\\":\\\"DE\\\"},\\\"quantity\\\":1,\\\"discountedPricePerQuantity\\\":[],\\\"addedAt\\\":\\\"2022-03-03T10:11:16.817Z\\\",\\\"lastModifiedAt\\\":\\\"2022-03-03T10:11:16.817Z\\\",\\\"state\\\":[{\\\"quantity\\\":1,\\\"state\\\":{\\\"typeId\\\":\\\"state\\\",\\\"id\\\":\\\"e380a2fb-77f3-482b-bf83-2060876200ba\\\"}}],\\\"priceMode\\\":\\\"Platform\\\",\\\"totalPrice\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"custom\\\":{\\\"type\\\":{\\\"typeId\\\":\\\"type\\\",\\\"id\\\":\\\"08c2d736-f2d8-4869-a2ef-fd8f56ff48a3\\\"},\\\"fields\\\":{\\\"subscriptionKey\\\":\\\"275c10d0-1f1e-4463-9c7f-66a6abc7ce7b_subscriptionKey\\\",\\\"reminderDays\\\":5,\\\"schedule\\\":\\\"0 0 1 Feb,May,Aug,Nov *\\\",\\\"cutoffDays\\\":5,\\\"isSubscription\\\":true}},\\\"lineItemMode\\\":\\\"Standard\\\"}]\",\"jse_cause\":{\"code\":400,\"statusCode\":400,\"status\":400,\"message\":\"Request body does not contain valid JSON.\",\"originalRequest\":{\"baseUri\":\"https://api.europe-west1.gcp.commercetools.com\",\"method\":\"POST\",\"uriTemplate\":\"/{projectKey}/orders/import\",\"pathVariables\":{\"projectKey\":\"project-key\"},\"headers\":{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer ********\",\"User-Agent\":\"commercetools-js-sdk Node.js/16.13.2 (darwin; x64) commercetools-subscriptions/0.0.1 (+https://github.com/commercetools/commercetools-subscriptions#readme; +ps-dev@commercetools.com)\"},\"body\":{\"orderNumber\":\"275c10d0-1f1e-4463-9c7f-66a6abc7ce7b_subscriptionKey\",\"customerEmail\":\"test@test.com\",\"totalPrice\":{\"type\":\"centPrecision\",\"currencyCode\":\"EUR\",\"centAmount\":18000,\"fractionDigits\":2},\"lineItems\":[{\"id\":\"1bea71c8-7712-4db4-945f-095085e0e69b\",\"productId\":\"8671cacd-500e-44ac-b6ee-2beada092441\",\"productKey\":\"product-1\",\"name\":{\"en\":\"Wine subscription\"},\"productType\":{\"typeId\":\"product-type\",\"id\":\"93b85ce4-bd0a-4c42-9aa5-a45c71915c4a\"},\"productSlug\":{\"en\":\"wine-subscription\"},\"variant\":{\"id\":1,\"sku\":\"wine01\",\"prices\":[{\"id\":\"91cc2648-5b51-497d-8a24-69b77b762a23\",\"value\":{\"type\":\"centPrecision\",\"currencyCode\":\"EUR\",\"centAmount\":18000,\"fractionDigits\":2},\"country\":\"DE\"}],\"images\":[],\"attributes\":[],\"assets\":[]},\"price\":{\"id\":\"a9c9dd05-ea46-4b34-b6a2-c31592156117\",\"value\":{\"type\":\"centPrecision\",\"currencyCode\":\"EUR\",\"centAmount\":18000,\"fractionDigits\":2},\"country\":\"DE\"},\"quantity\":1,\"discountedPricePerQuantity\":[],\"addedAt\":\"2022-03-03T10:11:16.817Z\",\"lastModifiedAt\":\"2022-03-03T10:11:16.817Z\",\"state\":[{\"quantity\":1,\"state\":{\"typeId\":\"state\",\"id\":\"e380a2fb-77f3-482b-bf83-2060876200ba\"}}],\"priceMode\":\"Platform\",\"totalPrice\":{\"type\":\"centPrecision\",\"currencyCode\":\"EUR\",\"centAmount\":18000,\"fractionDigits\":2},\"custom\":{\"type\":{\"typeId\":\"type\",\"id\":\"08c2d736-f2d8-4869-a2ef-fd8f56ff48a3\"},\"fields\":{\"subscriptionKey\":\"275c10d0-1f1e-4463-9c7f-66a6abc7ce7b_subscriptionKey\",\"reminderDays\":5,\"schedule\":\"0 0 1 Feb,May,Aug,Nov *\",\"cutoffDays\":5,\"isSubscription\":true}},\"lineItemMode\":\"Standard\"}],\"taxRoundingMode\":\"HalfEven\",\"taxCalculationMode\":\"LineItemLevel\",\"origin\":\"Customer\",\"itemShippingAddresses\":[],\"custom\":{\"type\":{\"typeId\":\"type\",\"key\":\"subscription-template-order\"},\"fields\":{\"isSubscriptionProcessed\":true,\"nextDeliveryDate\":\"2022-04-30T22:00:00.000Z\",\"schedule\":\"0 0 1 Feb,May,Aug,Nov *\",\"checkoutOrderRef\":{\"typeId\":\"order\",\"id\":\"12d7c490-a792-4abe-9a35-cdf9b113a11f\"},\"reminderDays\":5,\"nextReminderDate\":\"2022-04-25T22:00:00.000Z\"}},\"inventoryMode\":\"None\",\"state\":{\"typeId\":\"state\",\"key\":\"commercetools-subscriptions-active\"}},\"uri\":\"/project-key/orders/import\"},\"retryCount\":0,\"headers\":{\"content-type\":[\"application/json\"]},\"body\":{\"statusCode\":400,\"message\":\"Request body does not contain valid JSON.\",\"errors\":[{\"code\":\"InvalidJsonInput\",\"message\":\"Request body does not contain valid JSON.\",\"detailedErrorMessage\":\"actions -> state: JSON object expected.\"}]},\"name\":\"BadRequest\",\"stack\":\"BadRequest: Request body does not contain valid JSON.\\n    at createError (/Users/aoz/commercetools-subscriptions/node_modules/@commercetools/sdk-middleware-http/dist/sdk-middleware-http.cjs.js:259:29)\\n    at /Users/aoz/commercetools-subscriptions/node_modules/@commercetools/sdk-middleware-http/dist/sdk-middleware-http.cjs.js:443:25\\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\"},\"jse_info\":{},\"message\":\"Unexpected error on creating template order from checkout order with number: 1646302276551. Line item: [{\\\"id\\\":\\\"1bea71c8-7712-4db4-945f-095085e0e69b\\\",\\\"productId\\\":\\\"8671cacd-500e-44ac-b6ee-2beada092441\\\",\\\"productKey\\\":\\\"product-1\\\",\\\"name\\\":{\\\"en\\\":\\\"Wine subscription\\\"},\\\"productType\\\":{\\\"typeId\\\":\\\"product-type\\\",\\\"id\\\":\\\"93b85ce4-bd0a-4c42-9aa5-a45c71915c4a\\\"},\\\"productSlug\\\":{\\\"en\\\":\\\"wine-subscription\\\"},\\\"variant\\\":{\\\"id\\\":1,\\\"sku\\\":\\\"wine01\\\",\\\"prices\\\":[{\\\"id\\\":\\\"91cc2648-5b51-497d-8a24-69b77b762a23\\\",\\\"value\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"country\\\":\\\"DE\\\"}],\\\"images\\\":[],\\\"attributes\\\":[],\\\"assets\\\":[]},\\\"price\\\":{\\\"id\\\":\\\"a9c9dd05-ea46-4b34-b6a2-c31592156117\\\",\\\"value\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"country\\\":\\\"DE\\\"},\\\"quantity\\\":1,\\\"discountedPricePerQuantity\\\":[],\\\"addedAt\\\":\\\"2022-03-03T10:11:16.817Z\\\",\\\"lastModifiedAt\\\":\\\"2022-03-03T10:11:16.817Z\\\",\\\"state\\\":[{\\\"quantity\\\":1,\\\"state\\\":{\\\"typeId\\\":\\\"state\\\",\\\"id\\\":\\\"e380a2fb-77f3-482b-bf83-2060876200ba\\\"}}],\\\"priceMode\\\":\\\"Platform\\\",\\\"totalPrice\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"custom\\\":{\\\"type\\\":{\\\"typeId\\\":\\\"type\\\",\\\"id\\\":\\\"08c2d736-f2d8-4869-a2ef-fd8f56ff48a3\\\"},\\\"fields\\\":{\\\"subscriptionKey\\\":\\\"275c10d0-1f1e-4463-9c7f-66a6abc7ce7b_subscriptionKey\\\",\\\"reminderDays\\\":5,\\\"schedule\\\":\\\"0 0 1 Feb,May,Aug,Nov *\\\",\\\"cutoffDays\\\":5,\\\"isSubscription\\\":true}},\\\"lineItemMode\\\":\\\"Standard\\\"}]: Request body does not contain valid JSON.\",\"name\":\"VError\",\"stack\":\"VError: Unexpected error on creating template order from checkout order with number: 1646302276551. Line item: [{\\\"id\\\":\\\"1bea71c8-7712-4db4-945f-095085e0e69b\\\",\\\"productId\\\":\\\"8671cacd-500e-44ac-b6ee-2beada092441\\\",\\\"productKey\\\":\\\"product-1\\\",\\\"name\\\":{\\\"en\\\":\\\"Wine subscription\\\"},\\\"productType\\\":{\\\"typeId\\\":\\\"product-type\\\",\\\"id\\\":\\\"93b85ce4-bd0a-4c42-9aa5-a45c71915c4a\\\"},\\\"productSlug\\\":{\\\"en\\\":\\\"wine-subscription\\\"},\\\"variant\\\":{\\\"id\\\":1,\\\"sku\\\":\\\"wine01\\\",\\\"prices\\\":[{\\\"id\\\":\\\"91cc2648-5b51-497d-8a24-69b77b762a23\\\",\\\"value\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"country\\\":\\\"DE\\\"}],\\\"images\\\":[],\\\"attributes\\\":[],\\\"assets\\\":[]},\\\"price\\\":{\\\"id\\\":\\\"a9c9dd05-ea46-4b34-b6a2-c31592156117\\\",\\\"value\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"country\\\":\\\"DE\\\"},\\\"quantity\\\":1,\\\"discountedPricePerQuantity\\\":[],\\\"addedAt\\\":\\\"2022-03-03T10:11:16.817Z\\\",\\\"lastModifiedAt\\\":\\\"2022-03-03T10:11:16.817Z\\\",\\\"state\\\":[{\\\"quantity\\\":1,\\\"state\\\":{\\\"typeId\\\":\\\"state\\\",\\\"id\\\":\\\"e380a2fb-77f3-482b-bf83-2060876200ba\\\"}}],\\\"priceMode\\\":\\\"Platform\\\",\\\"totalPrice\\\":{\\\"type\\\":\\\"centPrecision\\\",\\\"currencyCode\\\":\\\"EUR\\\",\\\"centAmount\\\":18000,\\\"fractionDigits\\\":2},\\\"custom\\\":{\\\"type\\\":{\\\"typeId\\\":\\\"type\\\",\\\"id\\\":\\\"08c2d736-f2d8-4869-a2ef-fd8f56ff48a3\\\"},\\\"fields\\\":{\\\"subscriptionKey\\\":\\\"275c10d0-1f1e-4463-9c7f-66a6abc7ce7b_subscriptionKey\\\",\\\"reminderDays\\\":5,\\\"schedule\\\":\\\"0 0 1 Feb,May,Aug,Nov *\\\",\\\"cutoffDays\\\":5,\\\"isSubscription\\\":true}},\\\"lineItemMode\\\":\\\"Standard\\\"}]: Request body does not contain valid JSON.\\n    at _createTemplateOrderAndPayments (file:///Users/aoz/commercetools-subscriptions/src/create-template-orders.js:182:13)\\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\\n    at async pMap.concurrency (file:///Users/aoz/commercetools-subscriptions/src/create-template-orders.js:79:9)\\n    at async file:///Users/aoz/commercetools-subscriptions/node_modules/p-map/index.js:100:20\"}",
  "time": "2022-03-16T11:13:32.571Z",
  "v": 0
}
```

## How to fetch subscription-orders ?

You might need to fetch subscription-order history, to support viewing and editing the subscription order.

The Order search query example:

```json
{
  "query": {
    "exists": {
      "field": "custom.deliveryDate",
      "customType": "StringType"
    }
  }
}
```

> Note that it does not support filtering custom fields based on the type `ReferenceField` yet, so in this query we have used the `deliveryDate` instead.

In case you want to filter based on the customer email, then the query might be as below with adding `and` compound expression together with `customerEmail` filter.

```json
{
  "query": {
    "and": [
      {
        "exists": {
          "field": "custom.deliveryDate",
          "customType": "StringType"
        }
      },
      {
        "exact": {
          "field": "customerEmail",
          "value": "test@test.com"
        }
      }
    ]
  }
}
```

Note that the Order Search API does not return the resource data of the matching Orders. Instead, it returns a list of Order IDs, which can then be used to fetch the [Orders by their ID](https://docs.commercetools.com/api/projects/orders#query-orders).

One example order query predicate to fetch this order might be sth like below:

- `id in ("{{orderId1}}","{{orderdId2}}", "{{orderId3}}", ...)`

Query Predicate examples for order API (based on the `subscriptionTemplateOrderRef`):

- `custom(fields(subscriptionTemplateOrderRef is defined))`
- `custom(fields(subscriptionTemplateOrderRef is defined)) AND customerEmail="test@test.com"`

If you already know the id of the template-order, you might filter only that subscription with the query predicate below:

- `custom(fields(subscriptionTemplateOrderRef(id="{{templateOrderId}}")))`

## Updating orders:

Order API provides lots of update actions to edit an order, you might check [here](https://docs.commercetools.com/api/projects/orders#update-actions) all update actions from the official commercetools docs.

One example might be, one customer wants to cancel the subscription order when the template order already exists, so in this case you might use the [TransitionState](https://docs.commercetools.com/api/projects/orders#transition-state) action
to set the template-order to cancel state (key= `commercetools-subscriptions-cancelled`).

```json
{
  "version": {{templateOrderVersion}},
  "actions": [
      {
          "action" : "transitionState",
          "state" : {
            "typeId" : "state",
            "id" : "{{cancelledStateId}}"
          }
        }
  ]
}
```

> See the [update order](https://docs.commercetools.com/api/projects/orders#update-order-by-id) endpoint for more details.
