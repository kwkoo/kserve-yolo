#!/usr/bin/env python3

import boto3
import os

if __name__ == '__main__':
    bucket = os.environ.get('S3_BUCKET', 'models')
    session = boto3.session.Session()
    s3_client = session.client(
            service_name='s3',
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
            endpoint_url=os.environ.get('AWS_ENDPOINT_URL_S3')
        )

    s3_client.upload_file("/data/config.properties", bucket, "config/config.properties")
    s3_client.upload_file("yolov8n.mar", bucket, "model-store/yolov8x.mar")
