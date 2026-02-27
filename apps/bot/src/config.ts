export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN!,
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
  web: {
    baseUrl: process.env.WEB_BASE_URL || 'http://localhost:3000',
  },
};
