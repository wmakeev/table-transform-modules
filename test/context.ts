import { cast } from '@wmakeev/filtrex'
import { createExpressionContext } from '@wmakeev/simplex-context'
import { addDays } from 'date-fns/addDays'
import { endOfDay } from 'date-fns/endOfDay'
import { startOfDay } from 'date-fns/startOfDay'
import assert from 'node:assert'
import { S3ClientParams } from '../src/modules/storage/s3/types.js'
import { env } from './env.js'

export const expressionContext = createExpressionContext({
  symbols: {
    // TODO Временно. Подумать как добавлять переменные окружения.
    'env': (name: string): string => {
      return String(process.env[name] ?? '')
    },

    //#region Constants
    'EMPTY': null,
    'NEW_LINE': '\n',
    'START_TIME': new Date(),
    //#endregion

    //#region Additional functions
    'Date:addDays': addDays,
    'Date:startOfDay': startOfDay,
    'Date:endOfDay': endOfDay,
    'Str:toStr': (val: unknown) => String(val),
    'Arr:length': (arr: unknown[]) => arr.length,
    'Obj:assign': (obj1: unknown, obj2: unknown) =>
      Object.assign({}, obj1, obj2),
    'Arr:slice': (arr: unknown, start: unknown, end?: unknown) => {
      assert.ok(Array.isArray(arr), 'Expected array argument')
      return arr.slice(
        cast.asNumber(start),
        end == null ? undefined : cast.asNumber(end)
      ) as unknown[]
    }
    //#endregion
  }
})

export const s3ClientParams: S3ClientParams = {
  endpoint: env.S3_BUCKET_ENDPOINT,
  region: env.S3_BUCKET_REGION,
  credentials: {
    accessKeyId: env.S3_BUCKET_ACCESS_KEY,
    secretAccessKey: env.S3_BUCKET_ACCESS_SECRET
  }
}
