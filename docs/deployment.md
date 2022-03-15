# Deployment

Bash scripts have been created to build and deploy docker image to AWS EKS as a cronjob.

> In the deployment script, the [cron-job](https://github.com/commercetools/k8s-charts/tree/master/charts/cronjob) helm chart is used.

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

Once all the prerequisites have been installed and created, update the Repository Secrets and bash scripts, if required.
Example: ClusterName, ECR repository and its url etc.

also, the below project details,

| Name                | Description               |
| ------------------- | ------------------------- |
| `CTP_PROJECT_KEY`   | Commercetools project key |
| `CTP_CLIENT_ID`     | Client Id                 |
| `CTP_CLIENT_SECRET` | Client secret             |

### Helm values

Configure the credentials and other configs in [values.yaml](./../aws/k8s/values.yaml).

Note: The deployment will push the image to Amazon ECR and then helm will create a cronjob.
By default, cronjob runs every 5 minutes(you can change this in values.yaml), go to workflows tab on Amazon EKS service and verify it.
