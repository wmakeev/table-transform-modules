import {
  createRecordFromRow,
  transforms as tf,
  TableChunksTransformer,
  ColumnHeader,
  TableRow
} from '@wmakeev/table-transform'
import pRetry from 'p-retry'
import { fetch } from 'undici'
import { z } from 'zod'
import { parse as parseContentType, ParsedMediaType } from 'content-type'
import assert from 'node:assert/strict'
import { Response } from 'undici'
import parseParamsWithSchema from '../../../tools/parseParamsWithSchema.js'

export interface HttpRequestParams {
  resultColumn: string
}

const KeyValArraySchema = z.array(z.tuple([z.string().min(1), z.string()]))

const httpRequestParamsSchema = z.object({
  method: z.enum(['GET', 'POST', 'HEAD']).default('GET'),
  url: z.string().url(),
  query: KeyValArraySchema.optional(),
  headers: KeyValArraySchema.optional(),
  body: z.string().optional(),
  follow_redirect: z.boolean().optional()
})

const requestBodyParsers: Record<
  ParsedMediaType['type'],
  (
    response: Response,
    contentTypeParams: ParsedMediaType['parameters']
  ) => Promise<unknown>
> = {
  'application/json': async resp => await resp.json(),
  'text/plain': async resp => await resp.text()
}

async function getResponseBody(response: Response) {
  const contentType = response.headers.get('content-type')

  if (typeof contentType !== 'string') {
    return {
      content_type: contentType,
      body: await response.blob(),
      is_body_parsed: false
    }
  }

  const parsedContentType = parseContentType(contentType)
  const bodyParser = requestBodyParsers[parsedContentType.type]

  if (bodyParser === undefined) {
    return {
      content_type: parsedContentType.type,
      body: await response.blob(),
      is_body_parsed: false
    }
  }

  return {
    content_type: parsedContentType.type,
    body: await bodyParser(response, parsedContentType.parameters),
    is_body_parsed: true
  }
}

/**
 * Make http request
 */
async function getRequestResult(header: ColumnHeader[], row: TableRow) {
  const requestParamsRecord = createRecordFromRow(header, row)

  const paramsParseResult = parseParamsWithSchema(
    httpRequestParamsSchema,
    requestParamsRecord,
    'HttpRequest parameters row'
  )

  const { method, url, query, headers, body, follow_redirect } =
    paramsParseResult

  const urlObj = new URL(url)

  // Set query options
  if (query != null) {
    let query_ = query

    if (typeof query_ === 'string') {
      query_ = [...new URLSearchParams(query).entries()]
    }

    for (const kv of query) {
      urlObj.searchParams.append(kv[0], kv[1])
    }
  }

  const requestThunk = async () => {
    const response = await fetch(urlObj, {
      method,
      headers,
      body,
      redirect: follow_redirect ? 'follow' : 'manual'
    })

    const responseBodyInfo = await getResponseBody(response)

    return {
      method,
      url: response.url,
      status: response.status,
      status_text: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBodyInfo.body,
      body_content_type: responseBodyInfo.content_type,
      is_body_parsed: responseBodyInfo.is_body_parsed,
      is_ok: response.status >= 200 && response.status < 300,
      is_redirect: response.status >= 300 && response.status < 400
    }
  }

  const result = await pRetry(requestThunk, {
    onFailedAttempt: error => {
      console.log(
        `Attempt ${error.attemptNumber.toString()} failed. There are ${error.retriesLeft.toString()} retries left.`
      )
    },
    retries: 3
  })

  return result
}

/**
 * Make http request
 *
 * Input columns:
 * - `url: string`
 * - `method?: string`
 * - `query?: [string, string][]`
 * - `headers?: [string, string][]`
 * - `body?: string`
 * - `follow_redirect?: boolean`
 *
 * Result appended as `[resultColumn]` column as object with fields:
 * - `method`
 * - `url`
 * - `status`
 * - `status_text`
 * - `headers`
 * - `body`
 * - `body_content_type`
 * - `is_body_parsed`
 * - `is_ok`
 * - `is_redirect`
 */
export const httpRequest =
  (params: HttpRequestParams): TableChunksTransformer =>
  source => {
    const { resultColumn } = params

    const source_ = tf.column.add({ column: resultColumn })(source)

    const actualHeader = source_.getHeader().filter(h => !h.isDeleted)

    const resultColumnIndex = actualHeader.find(
      h => h.name === resultColumn
    )?.index

    assert.ok(resultColumnIndex)

    return {
      ...source_,
      async *[Symbol.asyncIterator]() {
        for await (const chunk of source_) {
          for (const row of chunk) {
            const requestResult = await getRequestResult(actualHeader, row)
            row[resultColumnIndex] = requestResult
            yield [row]
          }
        }
      }
    }
  }
