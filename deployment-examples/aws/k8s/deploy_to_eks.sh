#! /bin/bash

set -e

## edit those environment variables
## ----------------------
export IMAGE_BASE_NAME=$AWS_ECR_REPOSITORY
export TAG="0.0.1"
export REGION_CODE=$AWS_REGION_CODE
export CLUSTER_NAME="ct-subs2-cluster"
## ----------------------

export HELM_HOME="$HOME/helm"
export HELM_VERSION="v3.5.2"
export HELM_VALUES_DIR="./k8s"
export HELM_CHARTS_REPO="https://github.com/commercetools/k8s-charts.git"
export HELM_CHARTS_VERSION="1.14.0"
export HELM_CHART_TEMPLATE_NAME="cronjob"
export HELM_CHARTS_LOCAL_FOLDER="charts-templates"

printf "\n- Build and push docker images to AWS ECR\n"
ECR_PATH=$AWS_ECR_PATH
IMAGE_FULL_NAME=${ECR_PATH}/${IMAGE_BASE_NAME}

aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $ECR_PATH
docker build -t $IMAGE_BASE_NAME:$TAG .
docker tag $IMAGE_BASE_NAME:$TAG $IMAGE_FULL_NAME:$TAG
docker push $IMAGE_FULL_NAME:$TAG

printf "\n- Cloning commercetools/k8s-charts repo \n"
rm -rf ./k8s-charts
git clone --branch="$HELM_CHARTS_VERSION" --depth=1 "$HELM_CHARTS_REPO"/

printf "\n- Connecting to the AWS cluster with name: [%s] in [%s]..\n" "$CLUSTER_NAME" "$REGION_CODE"
aws eks update-kubeconfig --region "$REGION_CODE" --name "$CLUSTER_NAME"

cd k8s-charts/charts/cronjob

helm upgrade --install commercetools-subscriptions -f ./../../../deployment-examples/aws/k8s/values.yaml \ .

printf "Helms:\n%s\n\n" "$(helm list)"
