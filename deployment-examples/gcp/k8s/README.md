# Deployment

You can utilize the available bash scripts which is capable of creating a Google Kubernetes Engine cluster and deploying the app into it.

> In the deployment script, the [cron-job](https://github.com/commercetools/k8s-charts/tree/master/charts/cronjob) helm chart is used.

## Prerequisites

- [gcloud sdk](https://cloud.google.com/sdk/docs/install)
- [docker](https://docs.docker.com/get-docker/)
- [helm](https://helm.sh/docs/intro/install/)
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

## Configurations

### Environment variables

| Name                  | Description                                                                                                                    | Default                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `GCLOUD_PROJECT_ID`   | Google Cloud project ID                                                                                                        | `professionalserviceslabs`       |
| `GCLOUD_ZONE`         | Google Cloud [Zones](https://cloud.google.com/compute/docs/regions-zones#available) which cluster instances should be spawned. | `europe-west3-c`                 |
| `GCLOUD_CLUSTER_NAME` | Existing Google Kubernetes Engine cluster name                                                                                 | `commercetools-api-load-testing` |

### Helm values

Configure the credentials and other configs in [values.yaml](values.yaml).

## Creating a GKE cluster (optional)

Configure all the required environment variables in the bash script. After that, execute the [`create_gke_cluster`](create_gke_cluster.sh) script file.

```bash
./create_gke_cluster.sh
```

## Deploy to GKE cluster

Configure all the required environment variables in the bash script and in the helm [values](values.yaml) file. After that, execute the [`deploy_to_gke.sh`](deploy_to_gke.sh) script file.

```bash
./deploy_to_gke.sh
```
