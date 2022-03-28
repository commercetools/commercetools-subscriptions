#! /bin/bash

set -e

## edit these environment variables
## ----------------------
export GCLOUD_PROJECT_ID="YOUR_PROJECT_ID"
export GCLOUD_ZONE="europe-west3-c"
export GCLOUD_CLUSTER_NAME="commercetools-subscriptions"
export IMAGE_BASE_NAME="commercetools-subscriptions"
export TAG="v0.0.1"
export GCR_PATH="eu.gcr.io"
## ----------------------

export HELM_HOME="$HOME/helm"
export HELM_VERSION="v3.5.2"
export HELM_VALUES_DIR="./k8s"
export HELM_CHARTS_REPO="https://github.com/commercetools/k8s-charts.git"
export HELM_CHARTS_VERSION="1.14.0"
export HELM_CHART_TEMPLATE_NAME="cronjob"
export HELM_CHARTS_LOCAL_FOLDER="charts-templates"

printf "\n- Login to gcloud SDK and select project \n"
gcloud config set project "$GCLOUD_PROJECT_ID"
gcloud config set compute/zone "$GCLOUD_ZONE"

printf "\n- Build and push docker images to Google Container Registry(eu.gcr.io) \n"
IMAGE_FULL_NAME="${GCR_PATH}/${GCLOUD_PROJECT_ID}/${IMAGE_BASE_NAME}"

docker build -t "$IMAGE_BASE_NAME" ./../../../
docker tag "$IMAGE_BASE_NAME" "$IMAGE_FULL_NAME:$TAG"
docker push -- "$IMAGE_FULL_NAME:$TAG"

printf "\n- Cloning commercetools/k8s-charts repo \n"
rm -rf ./k8s-charts
git clone --branch="$HELM_CHARTS_VERSION" --depth=1 "$HELM_CHARTS_REPO"/

printf "\n- Connecting to the gcloud cluster with name: [%s] in [%s]..\n" "$GCLOUD_CLUSTER_NAME" "$GCLOUD_ZONE"
gcloud container clusters get-credentials "$GCLOUD_CLUSTER_NAME" --zone="$GCLOUD_ZONE"

cd k8s-charts/charts/cronjob

helm upgrade --install commercetools-subscriptions -f ./../../../values.yaml .

printf "Helms:\n%s\n\n" "$(helm list)"
