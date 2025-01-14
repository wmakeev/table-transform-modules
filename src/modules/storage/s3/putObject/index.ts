import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import {
  createRecordFromRow,
  TableChunksTransformer,
  transforms as tf,
  TransformRowError
} from '@wmakeev/table-transform'
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { stringToUint8Array } from 'uint8array-extras'
import { z } from 'zod'
import parseParamsWithSchema from '../../../../tools/parseParamsWithSchema.js'
import { S3ResultParams } from '../types.js'

interface S3PutObjectResult {
  bucket: string
  key: string
  result: 'created' | 'updated' | 'not_changed'
  etag: string
  byteLength: number
}

const TRANSFORM_NAME = 'Storage:S3:PutObject'

const S3PutObjectCommandSchema = z.object({
  bucket: z.string(),
  key: z.string(),
  body: z.instanceof(Uint8Array).or(z.instanceof(Blob)).or(z.string()),
  content_type: z.string().optional()
})

/**
 * Загружает объект в S3-хранилище
 *
 * Входящие колонки:
 * - `bucket`
 * - `key`
 * - `body`
 * - `content_type`
 *
 * Исходящие колоноки:
 * - `...` - все входящие
 * - и дополнительно [resultColumn]
 * - - `bucket`
 * - - `key`
 * - - `result` - `created` | `updated` | `not_changed`
 * - - `etag`
 * - - `byteLength`
 */
export const putObject =
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
                S3PutObjectCommandSchema,
                params,
                TRANSFORM_NAME
              )

              let existObjEtag

              try {
                const existObj = await s3Client.send(
                  new HeadObjectCommand({
                    Bucket: commandParams.bucket,
                    Key: commandParams.key
                  })
                )

                assert.ok(existObj.ETag)

                existObjEtag = JSON.parse(existObj.ETag)
              } catch (err) {
                if (err instanceof Error && err.name === 'NotFound') {
                  existObjEtag = undefined
                } else {
                  throw err
                }
              }

              let bodyUnit8Array: Uint8Array

              if (typeof commandParams.body === 'string') {
                bodyUnit8Array = stringToUint8Array(commandParams.body)
              } else if (commandParams.body instanceof Blob) {
                bodyUnit8Array = await commandParams.body.bytes()
              } else {
                bodyUnit8Array = commandParams.body
              }

              const bodyHashBuffer = createHash('md5')
                .update(bodyUnit8Array)
                .digest()

              const bodyEtag = bodyHashBuffer.toString('hex')

              if (existObjEtag === bodyEtag) {
                row[resultColumnHeader.index] = {
                  bucket: commandParams.bucket,
                  key: commandParams.key,
                  result: 'not_changed',
                  etag: existObjEtag,
                  byteLength: bodyUnit8Array.byteLength
                } as S3PutObjectResult

                continue
              }

              const uploadResult = await s3Client.send(
                new PutObjectCommand({
                  Bucket: commandParams.bucket,
                  Key: commandParams.key,
                  Body: bodyUnit8Array,
                  ContentType: commandParams.content_type, // 'application/x-ndjson'
                  // IfNoneMatch - не поддерживается
                  ContentMD5: bodyHashBuffer.toString('base64')
                })
              )

              row[resultColumnHeader.index] = {
                bucket: commandParams.bucket,
                key: commandParams.key,
                result: existObjEtag === undefined ? 'created' : 'updated',
                etag: uploadResult.ETag,
                byteLength: bodyUnit8Array.byteLength
              } as S3PutObjectResult
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

          yield chunk
        }
      }
    }
  }
