#! /bin/bash

set -e

## edit those environment variables
## ----------------------
export IMAGE_BASE_NAME=$AWS_ECR_REPOSITORY
export TAG="0.0.1"
export REGION_CODE=$AWS_REGION_CODE
## ----------------------

printf "\n- Build and push docker images to AWS ECR\n"
ECR_PATH=$AWS_ECR_PATH
IMAGE_FULL_NAME=${ECR_PATH}/${IMAGE_BASE_NAME}

aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $ECR_PATH
docker build -t $IMAGE_BASE_NAME:$TAG .
docker tag $IMAGE_BASE_NAME:$TAG $IMAGE_FULL_NAME:$TAG
docker push $IMAGE_FULL_NAME:$TAG
