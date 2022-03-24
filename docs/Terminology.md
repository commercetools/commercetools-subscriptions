Here are terminologies used in this project:

- **user**: the one who is responsible for running `commercetools-subscriptions` and `frontend`.
- **customer**: the one who buy goods from the user.
- **checkout-order**: an order which customers create during the checkout. It may contain one or more subscriptions. `commercetools-subscriptions` will generate a **template-order** for every subscription.
- **frontend**: application (usually an e-shop) of a user that is responsible for generating checkout orders.
- **template-order**: an order which manages a single subscription and is used as a template to create a
  subscription-order.
- **subscription-order**: a new order (actual delivery) triggered by the template order according to the defined schedule.
- **Order Messages**: These [messages](https://docs.commercetools.com/api/message-types#order-messages) represent a change or an action performed on an Order. Messages can be pulled via a REST API, or they can be pushed into a Message Queue by defining a Subscription.
- **[Order API](https://docs.commercetools.com/api/projects/orders)**: commercetools `/orders` endpoint, to perform some queries on subscription orders.
- **[Order Import API](https://docs.commercetools.com/api/projects/orders-import)**: commercetools `/orders/import` endpoint, to import an existing order without creating the carts.
- **[Order Search API](https://docs.commercetools.com/api/projects/order-search)**: commercetools `/orders/search` endpoint, to perform search requests on a high number of Orders in a Project.
