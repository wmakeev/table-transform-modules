export interface S3ClientParams {
  endpoint: string
  region: string
  credentials: {
    accessKeyId: string
    secretAccessKey: string
  }
}

export interface S3ResultParams {
  // TODO Добавить маппинг колонок
  s3ClientParams: S3ClientParams
  resultColumn: string
}
