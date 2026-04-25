#!/bin/bash
# Full deploy: build SAM template, deploy infra, sync built web assets, invalidate CDN.
# Usage: ./deploy.sh [staging|prod]
set -e

STAGE="${1:-staging}"
if [ "$STAGE" != "staging" ] && [ "$STAGE" != "prod" ]; then
  echo "Usage: $0 [staging|prod]" >&2
  exit 1
fi

PROFILE="hooseedev"
REGION="eu-north-1"
STACK_NAME="peaktrack-app-site-$STAGE"
WEB_DIST="../../web/peaktrack-app/dist"

echo "Building web assets ($STAGE)..."
pnpm --filter @evil-empire/web-app build

echo "Building SAM template..."
sam build

echo "Deploying infrastructure to $STACK_NAME..."
sam deploy --config-env "$STAGE"

echo "Getting bucket name from stack outputs..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text \
  --profile "$PROFILE" \
  --region "$REGION")

echo "Syncing $WEB_DIST to s3://$BUCKET_NAME ..."
aws s3 sync "$WEB_DIST" "s3://$BUCKET_NAME" --profile "$PROFILE" --region "$REGION" --delete

echo "Getting CloudFront distribution ID..."
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text \
  --profile "$PROFILE" \
  --region "$REGION")

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --profile "$PROFILE"

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text \
  --profile "$PROFILE" \
  --region "$REGION")

echo ""
echo "Deployment ($STAGE) complete!"
echo "Website URL: https://$CLOUDFRONT_DOMAIN"
