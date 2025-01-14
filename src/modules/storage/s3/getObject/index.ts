import {
  GetObjectCommand,
  S3Client,
  S3ServiceException
} from '@aws-sdk/client-s3'
import {
  createRecordFromRow,
  TableChunksTransformer,
  transforms as tf,
  TransformRowError
} from '@wmakeev/table-transform'
import assert from 'node:assert'
import { z } from 'zod'
import parseParamsWithSchema from '../../../../tools/parseParamsWithSchema.js'
import { S3ResultParams } from '../types.js'

const TRANSFORM_NAME = 'Storage:S3:GetObject'

type S3GetObjectResult =
  | {
      isFound: true
      bucket: string
      key: string
      body: Uint8Array
      etag: string
      lastModified: Date
      versionId?: string
      contentType?: string
      contentLength?: number
      metadata?: Record<string, string>
    }
  | {
      isFound: false
      bucket: string
      key: string
      body: null
      etag: undefined
      lastModified: undefined
      versionId: undefined
      contentType: undefined
      contentLength: undefined
      metadata: undefined
    }

const S3GetObjectCommandSchema = z.object({
  bucket: z.string(),
  key: z.string()
})

/**
 * Получает объект из S3-хранилища
 *
 * Входящие колонки:
 * - `bucket: string`
 * - `key: string`
 *
 * Исходящие колоноки:
 * - ...
 * - [resultColumn]
 *
 * `resultColumn`:
 *
 * ```ts
 * type StorageS3GetObjectResult = {
 *   isFound: true
 *   bucket: string
 *   key: string
 *   body: Uint8Array
 *   etag: string
 *   lastModified: Date
 *   versionId?: string
 *   contentType?: string
 *   contentLength?: number
 *   metadata?: Record<string, string>
 * }
 * ```
 */
export const getObject =
  (params: S3ResultParams): TableChunksTransformer =>
  source => {
    const { s3ClientParams, resultColumn } = params

    const s3Client = new S3Client({ ...s3ClientParams, forcePathStyle: true })

    const source_ = tf.column.add({ column: resultColumn })(source)

    return {
      ...source_,

      async *[Symbol.asyncIterator]() {
        const header = source_.getHeader()

        const resultColumnHeader = header.find(
          h => !h.isDeleted && h.name === resultColumn
        )

        assert.ok(resultColumnHeader)

        for await (const chunk of source_) {
          for (const [rowIndex, row] of chunk.entries()) {
            try {
              const params = createRecordFromRow(header, row)

              const commandParams = parseParamsWithSchema(
                S3GetObjectCommandSchema,
                params,
                TRANSFORM_NAME
              )

              let getObjectResult

              try {
                getObjectResult = await s3Client.send(
                  new GetObjectCommand({
                    Bucket: commandParams.bucket,
                    Key: commandParams.key
                  })
                )
              } catch (err) {
                if (
                  err instanceof S3ServiceException &&
                  err.name === 'NoSuchKey'
                ) {
                  row[resultColumnHeader.index] = {
                    isFound: false,
                    bucket: commandParams.bucket,
                    key: commandParams.key,
                    body: null,
                    etag: undefined,
                    lastModified: undefined,
                    versionId: undefined,
                    contentType: undefined,
                    contentLength: undefined,
                    metadata: undefined
                  } as S3GetObjectResult

                  yield [row]
                  continue
                }

                throw err
              }

              const bodyBuffer =
                (await getObjectResult.Body?.transformToByteArray()) ?? null

              row[resultColumnHeader.index] = {
                isFound: true,
                bucket: commandParams.bucket,
                key: commandParams.key,
                body: bodyBuffer,
                etag:
                  getObjectResult.ETag != null
                    ? JSON.parse(getObjectResult.ETag)
                    : null,
                lastModified: getObjectResult.LastModified,
                versionId: getObjectResult.VersionId,
                contentType: getObjectResult.ContentType,
                contentLength: getObjectResult.ContentLength,
                metadata: getObjectResult.Metadata
              } as S3GetObjectResult

              yield [row]
            } catch (err) {
              assert.ok(err instanceof Error)

              throw new TransformRowError(
                err.message,
                TRANSFORM_NAME,
                header,
                chunk,
                rowIndex,
                null,
                { cause: err }
              )
            }
          }
        }
      }
    }
  }
