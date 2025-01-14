import {
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  S3Client
} from '@aws-sdk/client-s3'
import {
  createRecordFromRow,
  TableChunksTransformer,
  TableRowFlatMapper,
  transforms as tf
} from '@wmakeev/table-transform'
import { z } from 'zod'
import parseParamsWithSchema from '../../../../tools/parseParamsWithSchema.js'
import { S3ResultParams } from '../types.js'

const TRANSFORM_NAME = 'Storage:S3:ListObjects'

const S3ListObjectCommandSchema = z.object({
  bucket: z.string(),
  prefix: z.string().optional()
})

const s3ListFlatMapper = (params: S3ResultParams): TableRowFlatMapper => {
  const { resultColumn, s3ClientParams } = params
  const s3Client = new S3Client({ ...s3ClientParams, forcePathStyle: true })

  return async function* (header, row) {
    yield [[resultColumn]]

    const params = createRecordFromRow(header, row)

    const commandParams = parseParamsWithSchema(
      S3ListObjectCommandSchema,
      params,
      TRANSFORM_NAME
    )

    let continuationToken: string | undefined = ''

    while (continuationToken != null) {
      const listObjectsOutput: ListObjectsV2CommandOutput = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: commandParams.bucket,
          Prefix: commandParams.prefix,
          ContinuationToken: continuationToken
        })
      )

      continuationToken = listObjectsOutput.ContinuationToken

      if (!listObjectsOutput.Contents?.length) break

      const outChunk = Array.from(listObjectsOutput.Contents, item => {
        return [
          {
            key: item.Key,
            etag: item.ETag,
            size: item.Size,
            last_modified: item.LastModified
          }
        ]
      })

      yield outChunk
    }
  }
}

/**
 * Возвращает список ключей в указанном бакете с учетом префикса.
 *
 * Ожидаемые колонки:
 * - `bucket`
 * - `prefix` (опционально)
 *
 * Структура значения в `resultColumn`:
 *
 * ```ts
 * {
 *   key: string
 *   etag: string
 *   size: number
 *   last_modified: Date
 * }
 * ```
 */
export const listObjects =
  (params: S3ResultParams): TableChunksTransformer =>
  source => {
    // FIXME Добавлять результат к уже существующим колонкам
    return tf.flatMapWith({
      mapper: s3ListFlatMapper(params),
      outputColumns: [params.resultColumn]
    })(source)
  }
