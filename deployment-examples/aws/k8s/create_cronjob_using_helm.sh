export HELM_HOME="$HOME/helm"
export HELM_VERSION="v3.5.2"
export HELM_VALUES_DIR="./k8s"
export HELM_CHARTS_REPO="https://github.com/commercetools/k8s-charts.git"
export HELM_CHARTS_VERSION="1.14.0"
export HELM_CHART_TEMPLATE_NAME="cronjob"
export HELM_CHARTS_LOCAL_FOLDER="charts-templates"

export CLUSTER_NAME="ct-subs2-cluster"

printf "\n- Cloning commercetools/k8s-charts repo \n"
rm -rf ./k8s-charts
git clone --branch=$HELM_CHARTS_VERSION --depth=1 $HELM_CHARTS_REPO/

printf "\n- Connecting to the AWS cluster with name: [%s] in [%s]..\n" $CLUSTER_NAME $AWS_REGION_CODE
aws eks update-kubeconfig --region $AWS_REGION_CODE --name $CLUSTER_NAME

cd k8s-charts/charts/cronjob

helm upgrade --install commercetools-subscriptions -f ./values.yaml \ .

printf "Helms:\n%s\n\n" "$(helm list)"
