import {
  createTableTransformer,
  FlattenTransform,
  transforms as tf
} from '@wmakeev/table-transform'
import assert from 'node:assert'
import {
  // @ts-expect-error no typings for compose
  compose
} from 'node:stream'
import test from 'node:test'
import { modules } from '../../../../src/index.js'
import { s3ClientParams } from '../../../context.js'
import { env } from '../../../env.js'

test.skip('storage.s3.listObjects', async () => {
  const GOODS_FEEDBACK_PATH =
    'api.partner.market.yandex.ru/v2/reports/goods-feedback'

  const mainTransformer = createTableTransformer({
    transforms: [
      modules.storage.s3.listObjects({
        resultColumn: 'response',
        s3ClientParams
      }),

      tf.column.unnest({
        column: 'response',
        fields: ['key']
      }),

      tf.column.remove({ column: 'response' }),

      tf.column.tapValue({
        column: 'key',
        tapFunction(val, row, index) {
          assert.ok(typeof val === 'string')
          const entries = Array.from(
            val.matchAll(/\/([^=/]+)=([^/]+)/g),
            it => [it[1], it[2]]
          )
          row[index] = Object.fromEntries(entries)
        }
      }),

      tf.column.unnest({
        column: 'key',
        fields: ['business_id', 'year', 'month', 'day']
      }),

      tf.column.remove({ column: 'key' })
    ]
  })

  const resultStream = await compose(
    [
      [
        ['bucket', 'prefix'],
        [env.S3_BUCKET_TEST, GOODS_FEEDBACK_PATH]
      ]
    ],
    mainTransformer,
    new FlattenTransform()
  )

  const items = []

  for await (const item of resultStream) {
    items.push(item)
  }

  console.log(items)
})
