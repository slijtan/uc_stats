output "cloudfront_domain" {
  description = "CloudFront distribution domain name (site URL)"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.site.id
}

output "s3_bucket_name" {
  description = "S3 bucket name (for deploy script)"
  value       = aws_s3_bucket.site.id
}
