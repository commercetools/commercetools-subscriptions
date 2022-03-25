#! /bin/bash

set -e

## edit those environment variables
## ----------------------
export GCLOUD_PROJECT_ID="YOUR_PROJECT_ID"
export GCLOUD_ZONE="europe-west3-c"
export GCLOUD_CLUSTER_NAME="commercetools-subscriptions"
## ----------------------

printf "\n- Login to gcloud SDK and select project \n"
gcloud config set project "$GCLOUD_PROJECT_ID"
gcloud config set compute/zone "$GCLOUD_ZONE"

gcloud container clusters create $GCLOUD_CLUSTER_NAME --labels=environment=commercetools-subscription
