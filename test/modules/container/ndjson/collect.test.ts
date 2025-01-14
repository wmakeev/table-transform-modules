import {
  Context,
  createTableTransformer,
  TableRow
} from '@wmakeev/table-transform'
import assert from 'node:assert'
import test from 'node:test'
import { modules } from '../../../../src/index.js'
import { expressionContext } from '../../../context.js'

test('transforms.container.ndjson.collect', async () => {
  const transformer = createTableTransformer({
    context: new Context()._setTransformContext(expressionContext),
    transforms: [
      modules.container.ndjson.collect({
        column: 'item',
        outColumn: 'items'
      })
    ]
  })

  const inputChunks: TableRow[][] = [
    [
      ['item'],
      [{ b: 2, a: 1, foo: { bar: 'text' } }],
      [{ b: 4, a: 3, foo: { bar: 'text', aaa: 'xxx' } }]
    ]
  ]

  const chunks = []

  for await (const chunk of transformer(inputChunks)) {
    chunks.push(chunk)
  }

  assert.deepEqual(chunks, [
    [['items']],
    [
      [
        '{"a":1,"b":2,"foo":"{\\"bar\\":\\"text\\"}"}\n{"a":3,"b":4,"foo":"{\\"aaa\\":\\"xxx\\",\\"bar\\":\\"text\\"}"}'
      ]
    ]
  ])
})
