# OpenShift AI / KServe / YOLOv8

This repo deploys an object detection YOLO model using KServe and TorchServe.

## Setup

01. Provision an `AWS Blank Open Environment` in `ap-southeast-1`, create an OpenShift cluster with 2 `p3.2xlarge` worker nodes

	*   Create a new directory for the install files

			mkdir demo

			cd demo

	*   Generate `install-config.yaml`

			openshift-install create install-config

	*   Set the compute pool to 2 replicas with `p3.2xlarge` instances, and set the control plane to a single master (you will need to have `yq` installed)

			mv install-config.yaml install-config-old.yaml

			yq '.compute[0].replicas=2' < install-config-old.yaml \
			| \
			yq '.compute[0].platform = {"aws":{"zones":["ap-southeast-1b"], "type":"p3.2xlarge"}}' \
			| \
			yq '.controlPlane.replicas=1' \
			> install-config.yaml

	*   Create the cluster

			openshift-install create cluster
			
		You may get a `context deadline exceeded` error - this is expected because there is only a single control-plane node

01. Set the `KUBECONFIG` environment variable to point to the new cluster

01. Setup the ingress with certificates from Let's Encrypt

		./scripts/setup-letsencrypt
	
	Note: After the certificates have been installed, you will need to edit `kubeconfig` and comment out `.clusters[*].cluster.certificate-authority-data`

01. Deploy OpenShift AI and its dependencies to OpenShift

		make deploy
	
	This will:

	*   Configure OpenShift for User Workload Monitoring
	*   Deploy the NFD and Nvidia GPU operators
	*   Deploy the OpenShift Serverless and Service Mesh operators
	*   Deploy OpenShift AI and KServe
	*   Deploy minio
	*   Converts the yolo `.pt` model to an `.mar` and uploads the `.mar` and the `config.properties` file to a bucket in minio
	*   Deploy the `InferenceService`

01. Deploy the frontend

		make deploy-frontend


## Preparing the model archive (`.mar`)

TorchServe expects the model to be in a model archive file.

The `s3-job` creates the model archive and uploads it to an S3 bucket in minio.

Another way of generating the model archive is with the `torch-model-archiver`

	torch-model-archiver \
	  --model-name yolov8x \
	  --version 1.0 \
	  --serialized-file yolov8x.pt \
	  --handler custom_handler.py \
	  -r requirements.txt

You can also refer to `convert-pt-to-mar/convert_pt_to_mar.ipynb` for more info.


### Preparing the model archive for offline usage

Start with a Python environment that is the same version as the torchserve image (Python 3.9.18 for `torchserve-kfs:0.10.0-gpu`)

01. Create a new directory to download all wheels to - name it `wheelhouse`

01. Create `requirements.txt` in the `wheelhouse` directory - for example:

		ultralytics
		clip
		pillow

01. Download wheels to `wheelhouse`

		pip download \
		  -r wheelhouse/requirements.txt \
		  -d wheelhouse

01. Delete `wheelhouse/requirements.txt`

01. Generate new `requirements.txt` populated with wheels

		ls wheelhouse > requirements.txt

01. Generate comma-separated list of files

		extra=""
		for f in `ls wheelhouse`; do \
		  extra="$extra,wheelhouse/$f"
		done

		# get rid of comma in front
		extra=${extra:1}

01. Generate the model archive passing it the wheels in the `--extra-files` parameter

		torch-model-archiver \
		  --model-name yolov8x \
		  --version 1.0 \
		  --serialized-file yolov8x.pt \
		  --handler custom_handler.py \
		  --extra-files $extra \
		  -r requirements.txt


## TorchServe

If you wish to modify `custom_handler.py`, the easiest way to test the handler would be to run TorchServe locally. You can start TorchServe with

	torchserve \
	  --start \
	  --model-store model-store \
	  --models yolo=yolov8x.mar \
	  --ts-config config/config.properties

Ensure that `./model-store/yolov8x.mar` and `./config/config.properties` exists beforehand.

To send a test request

	curl -s localhost:8085/predictions/yolo -T bus.jpg


## Testing the model in KServe

*   Prepare the payload by passing in an image - assuming the image is named `bus.jpg`

		python3 ./scripts/tobytes.py bus.jpg

*   This will create a file named `bus.json`

*   Send a curl request

		model_url="$(oc get -n demo inferenceservice/yolo -o jsonpath='{.status.url}')"

		# retrieve models
		curl -sk ${model_url}/v2/models

		curl \
		  -sk \
		  -H "Content-Type: application/json" \
		  ${model_url}/v2/models/yolo/infer \
		  -d @./bus.json


## Frontend

To run nginx locally for testing

*   Forward a local port to the inference service

		oc port-forward \
		  -n demo \
		  svc/yolo-predictor-00001-private \
		  8000:80

*   Modify `./frontend/conf/server_block.conf` to point to the local port

		proxy_pass http://host.docker.internal:8000/v2/models/yolo/infer

*   Start nginx

		docker run \
		  --rm \
		  -it \
		  --name nginx \
		  -p 8080:8080 \
		  -v ./frontend/conf/server_block.conf:/opt/bitnami/nginx/conf/server_blocks/server_block.conf \
		  -v ./frontend/html:/html \
		  docker.io/bitnami/nginx:latest


## Accessing Minio

*   Get the URL of the minio console with

		make minio-console

*   Login to the console with `minio` / `minio123`


## Metrics

TorchServe emits [metrics](https://github.com/pytorch/serve/blob/master/ts/configs/metrics.yaml). These metrics can be accessed from the OpenShift Console, under Observe / Metrics.

To access these metrics via curl,

	oc port-forward \
	  -n demo \
	  svc/yolo-torchserve-metrics \
	  8082:8082

	curl localhost:8082/metrics

You can also access metrics through the [`thanos-querier`](https://docs.openshift.com/container-platform/4.15/monitoring/enabling-monitoring-for-user-defined-projects.html#accessing-metrics-from-outside-cluster_enabling-monitoring-for-user-defined-projects).


## Resources

*   [KServe Pytorch integration](https://kserve.github.io/website/0.12/modelserving/v1beta1/torchserve/#deploy-pytorch-model-with-open-inference-rest-protocol)
*   [TorchServe yolo custom handler](https://github.com/pytorch/serve/tree/master/examples/object_detector/yolo/yolov8)
*   [YOLOv8 models](https://github.com/ultralytics/ultralytics?tab=readme-ov-file#models)
