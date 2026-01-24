#!/bin/bash
set -e

PROFILE="hooseedev"
REGION="eu-north-1"
STACK_NAME="vaikia-dev-static-site"
WEB_DIR="../../web/vaikia-dev"

echo "Getting bucket name from stack outputs..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

echo "Syncing web files to S3 bucket: $BUCKET_NAME"
aws s3 sync $WEB_DIR s3://$BUCKET_NAME --profile $PROFILE --region $REGION

echo "Getting CloudFront distribution ID..."
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text \
  --profile $PROFILE \
  --region $REGION)

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --profile $PROFILE

echo ""
echo "App deployment complete!"
