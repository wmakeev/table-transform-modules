import { cleanEnv, str } from 'envalid'

export const env = cleanEnv(process.env, {
  S3_BUCKET_REGION: str(),
  S3_BUCKET_ENDPOINT: str(),
  S3_BUCKET_ACCESS_KEY: str(),
  S3_BUCKET_ACCESS_SECRET: str(),
  S3_BUCKET_TEST: str()
})
