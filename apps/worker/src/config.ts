export const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT!,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION || 'us-east-1',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
};
