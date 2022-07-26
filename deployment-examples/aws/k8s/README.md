# Deployment

The main goal of this deploy process is to build and publish the new docker image to ECR repository and create a cronjob to run it.

## Prerequisites

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [docker](https://docs.docker.com/get-docker/)
- [helm](https://helm.sh/docs/intro/install/)
- [kubectl](https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html)
- [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [eksctl](https://docs.aws.amazon.com/eks/latest/userguide/eksctl.html)

## Configurations

### Environment variables

| Name                              | Description                                                                 |
| --------------------------------- | --------------------------------------------------------------------------- |
| `AWS_ECR_REPOSITORY`              | Amazon Elastic Container Registry(ECR) name(It is also used as Image name). |
| `AWS_REGION_CODE`                 | Same region code where cluster is created.                                  |
| `AWS_ECR_PATH`                    | AWS ECR repository url(without repository name).                            |
| `AWS_CLUSTER_NAME`                | AWS Cluster name.                                                           |
| `CTP_PROJECT_KEY`                 | Commercetools project key.                                                  |
| `CTP_CLIENT_ID`                   | Client Id.                                                                  |
| `CTP_CLIENT_SECRET`               | Client secret.                                                              |
| `SUBSCRIPTION_ORDER_CREATION_URL` | Subscription order creation url.                                            |
| `CUSTOM_HEADERS`                  | Custom headers passed for subscription order creation.                      |

### Helm values

For any changes for cronjob, configure the properties in [values.yaml](./values.yaml).

## Creating AWS cluster (only for the first time)

Configure all the required environment variables in the bash script [`create_aws_cluster`](create_aws_cluster.sh). After that, execute the script file.

```bash
./create_aws_cluster.sh
```

## Deploy to AWS cluster

Configure all the required environment variables in the bash script [`deploy_to_eks.sh`](deploy_to_eks.sh) and in the helm [values](values.yaml) file. After that, execute the script file.

```bash
./deploy_to_eks.sh
```

## Additional links to know more about AWS ECR, EKS services

- [Amazon ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html)
- [Amazon EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)
- [Cluster creation](https://docs.aws.amazon.com/eks/latest/userguide/create-cluster.html)
