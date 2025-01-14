import test from 'node:test'
import { createTableTransformer, TableRow } from '@wmakeev/table-transform'
import assert from 'node:assert'
import { modules } from '../../../src/index.js'

test('transforms.transport.httpRequest', async () => {
  const tableTransformer = createTableTransformer({
    transforms: [
      modules.transport.httpRequest({
        resultColumn: 'response'
      })
    ]
  })

  const URL =
    'https://raw.githubusercontent.com/yandex-cloud/json-schema-store/master/serverless/workflows/yawl.json'

  const tableRowsChunk: TableRow[] = [['url'], [URL]]

  const result: TableRow[] = []

  for await (const chunk of tableTransformer([tableRowsChunk])) {
    result.push(...chunk)
  }

  assert.deepEqual(result[0], ['url', 'response'])

  const firstResult = result[1]
  assert.ok(Array.isArray(firstResult))

  const [url, response] = firstResult

  assert.ok(response != null && typeof response === 'object')
  assert.ok('url' in response)
  assert.ok('status' in response)
  assert.ok(
    'headers' in response &&
      response.headers != null &&
      typeof response.headers === 'object'
  )
  assert.ok('body' in response)
  assert.ok('body_content_type' in response)
  assert.ok('is_body_parsed' in response)
  assert.ok('is_ok' in response)
  assert.ok('is_redirect' in response)

  assert.equal(url, URL)
  assert.equal(response.url, URL)
  assert.equal(response.status, 200)
  assert.ok('content-type' in response.headers)
  assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8')
  assert.equal(typeof response.body, 'string')
  assert.equal(response.body_content_type, 'text/plain')
  assert.equal(response.is_body_parsed, true)
  assert.equal(response.is_ok, true)
  assert.equal(response.is_redirect, false)
})
