import {
  TableChunksTransformer,
  transforms as tf
} from '@wmakeev/table-transform'

export interface CollectParams {
  column: string
  outColumn?: string
}

/**
 * Collect objects from `column` and serialize to stable ndjson string
 */
export const collect: (params: CollectParams) => TableChunksTransformer = ({
  column,
  outColumn = column
}): TableChunksTransformer =>
  tf.compose({
    transforms: [
      tf.column.transform({
        column,
        expression: `value() | Obj:toPlainRecord`
      }),

      tf.column.transform({
        column,
        expression: `value() | JSON:Stable:toStr`
      }),

      tf.column.collect({
        column
      }),

      tf.column.rename({
        oldColumn: column,
        newColumn: outColumn
      }),

      tf.column.transform({
        column: outColumn,
        expression: `Arr:join(value(), NEW_LINE)`
      })
    ]
  })
