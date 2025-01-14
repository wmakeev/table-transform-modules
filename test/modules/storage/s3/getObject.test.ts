import {
  Context,
  createTableTransformer,
  FlattenTransform,
  transforms as tf
} from '@wmakeev/table-transform'

import test from 'node:test'
import { modules } from '../../../../src/index.js'
import { expressionContext, s3ClientParams } from '../../../context.js'
import { env } from '../../../env.js'
import { pipeline } from 'node:stream/promises'

const { S3_BUCKET_TEST } = env

const SAMPLE_OBJECT_KEYS = [
  'feedbacks-api.wildberries.ru/v1/feedbacks/year=2024/month=12/day=09/feedbacks_20241209.ndjson',
  'feedbacks-api.wildberries.ru/v1/feedbacks/year=2024/month=12/day=10/foo.ndjson',
  'feedbacks-api.wildberries.ru/v1/feedbacks/year=2024/month=12/day=11/feedbacks_20241211.ndjson'
]

test.skip('storage.s3.getObject', async () => {
  const mainTransformer = createTableTransformer({
    context: new Context()._setTransformContext(expressionContext),
    transforms: [
      modules.storage.s3.getObject({
        resultColumn: 'response',
        s3ClientParams
      }),

      tf.column.filter({
        column: 'response',
        expression: `isFound of value() == TRUE`
      }),

      tf.column.derive({
        column: 'body',
        expression: `body of 'response'`
      }),

      modules.container.buffer.toString({
        column: 'body',
        encoding: 'utf8'
      })
    ]
  })

  const items: unknown[] = []

  await pipeline(
    [
      [
        ['bucket', 'key'],
        ...SAMPLE_OBJECT_KEYS.map(key => [S3_BUCKET_TEST, key])
      ]
    ],
    mainTransformer,
    new FlattenTransform(),
    async src => {
      for await (const item of src) {
        items.push(item)
      }
    }
  )

  console.log(items)
})
