# Custom TorchServe KFS image

The original image does not run on OpenShift because the application tries to write to `/home/model-server`. This `Dockerfile` modifies the permissions of that directory so that it's writable when run on OpenShift.
