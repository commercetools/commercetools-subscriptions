#! /bin/bash

set -e

## edit these environment variables
## ----------------------
export AWS_REGION_CODE="us-west-2"
export AWS_CLUSTER_NAME="commercetools-subscriptions-cluster"
## ----------------------

eksctl create cluster --name ${AWS_CLUSTER_NAME} --region ${AWS_REGION_CODE}
