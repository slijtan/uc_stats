#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$PROJECT_ROOT/infra"

# Read Terraform outputs
BUCKET=$(terraform -chdir="$INFRA_DIR" output -raw s3_bucket_name)
DISTRIBUTION_ID=$(terraform -chdir="$INFRA_DIR" output -raw cloudfront_distribution_id)

echo "==> Building site..."
cd "$PROJECT_ROOT"
npm run build

echo "==> Syncing dist/ to s3://$BUCKET ..."

# Upload index.html with no-cache
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

# Upload assets/ with 1 year cache (content-hashed)
aws s3 sync dist/assets/ "s3://$BUCKET/assets/" \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

# Upload data/ with 1 day cache
aws s3 sync dist/data/ "s3://$BUCKET/data/" \
  --cache-control "public, max-age=86400" \
  --delete

# Upload remaining files (favicon, etc.) with short cache
aws s3 sync dist/ "s3://$BUCKET/" \
  --exclude "index.html" \
  --exclude "assets/*" \
  --exclude "data/*" \
  --cache-control "public, max-age=3600" \
  --delete

echo "==> Invalidating CloudFront cache for index.html..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html" \
  --query 'Invalidation.Id' \
  --output text

echo "==> Deploy complete!"
echo "    Site: https://$(terraform -chdir="$INFRA_DIR" output -raw cloudfront_domain)"
