# Deployment

The main goal of this deploy process is to build and publish the new docker image to ECR repository and create a cronjob to run it.

## Prerequisites

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [docker](https://docs.docker.com/get-docker/)
- [helm](https://helm.sh/docs/intro/install/)
- [kubectl](https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html)
- [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

If you are doing it for the first time, Make sure you follow the below document and create Cluster and other required services in AWS before running deployment scripts.

https://docs.aws.amazon.com/eks/latest/userguide/getting-started-console.html

## Configurations

### Environment variables

Once all the prerequisites have been installed and created, update the repository secrets for the following fields in the repository.

| Name                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `AWS_ECR_REPOSITORY` | Amazon Elastic Container Registry(ECR) name(It is also used as Image name). |
| `AWS_REGION_CODE`    | Same region code where cluster is created.                                  |
| `AWS_ECR_PATH`       | AWS ECR repository url(without repository name).                            |
| `AWS_CLUSTER_NAME`   | AWS Cluster name.                                                           |
| `CTP_PROJECT_KEY`    | Commercetools project key.                                                  |
| `CTP_CLIENT_ID`      | Client Id.                                                                  |
| `CTP_CLIENT_SECRET`  | Client secret.                                                              |

### Helm values

For any changes for cronjob, configure the properties in [values.yaml](../deployment-examples/aws/k8s/values.yaml).

## Create release.

To release the library, you need to ["create a new release"](https://github.com/commercetools/commercetools-subscriptions/releases/new) with Github,
describe the new release and publish it.

Bash scripts have been created to build and deploy docker image to AWS EKS as a cronjob. CD github actions job will run these bash scripts to deploy the new version to AWS.

> In the deployment script, the [cron-job](https://github.com/commercetools/k8s-charts/tree/master/charts/cronjob) helm chart is used.

Note: The deployment will push the image to Amazon ECR and then helm will create a cronjob.
By default, cronjob runs every 5 minutes(you can change this in values.yaml), go to workflows tab on Amazon EKS service and verify it.

## Additional links to know more about AWS ECR, EKS services.

- [Amazon ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html)
- [Amazon EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)
- [Cluster creation](https://docs.aws.amazon.com/eks/latest/userguide/create-cluster.html)
