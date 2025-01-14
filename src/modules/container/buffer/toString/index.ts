import {
  TableChunksTransformer,
  TransformColumnsNotFoundError,
  TransformRowError
} from '@wmakeev/table-transform'
import { isUint8Array, uint8ArrayToString } from 'uint8array-extras'

const TRANSFORM_NAME = 'Container:Buffer:toString'

interface BufferToStringParams {
  column: string
  encoding?: string
}

/**
 * Преобразует Uint8Array в строку.
 */
export const toString =
  (params: BufferToStringParams): TableChunksTransformer =>
  source => {
    const { column, encoding } = params

    const header = source.getHeader()

    const columnHeader = header.find(h => !h.isDeleted && h.name === column)

    if (columnHeader === undefined) {
      throw new TransformColumnsNotFoundError(TRANSFORM_NAME, header, [column])
    }

    return {
      ...source,

      async *[Symbol.asyncIterator]() {
        for await (const chunk of source) {
          for (const [rowIndex, row] of chunk.entries()) {
            const buffer = row[columnHeader.index]

            if (buffer == null) continue

            if (!isUint8Array(buffer)) {
              // TODO Нужно более конкретную ошибку для значения строки
              throw new TransformRowError(
                'Expected column value to be Uint8Array',
                TRANSFORM_NAME,
                header,
                chunk,
                rowIndex,
                columnHeader.index
              )
            }

            row[columnHeader.index] = uint8ArrayToString(
              buffer,
              encoding ?? 'utf8'
            )
          }

          yield chunk
        }
      }
    }
  }
