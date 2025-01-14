import {
  TableChunksTransformer,
  transforms as tf
} from '@wmakeev/table-transform'

/**
 * Формирует отдельные колонки частей даты.
 *
 * Входящие колоноки:
 * - `[dateColumn]`
 *
 * Исходящие колоноки:
 * - ... (все входящие)
 * - `year: number`
 * - `month: number`
 * - `day: number`
 */
export const addYMD = (params: {
  dateColumn: string
}): TableChunksTransformer => {
  const { dateColumn } = params

  const TEMP_SAVE_DATE_COLUMN_NAME =
    '__tmp_date_column_' + String(Math.round(Math.random() * 1000))

  return tf.compose({
    transforms: [
      tf.column.rename({
        oldColumn: dateColumn,
        newColumn: TEMP_SAVE_DATE_COLUMN_NAME
      }),

      tf.column.derive({
        column: 'year',
        // TODO Подставлять непонятно какую строку в выражение не лучшая идея,
        // поэтому колонка временно переименовывается в TEMP_SAVE_DATE_COLUMN_NAME.
        // Возможно есть более универсальное решение через контекст или доп. параметры
        // для конкретного блока трансформации с указанием доп. переменных.
        expression: `'${TEMP_SAVE_DATE_COLUMN_NAME}' | Date:getYear`
      }),

      tf.column.derive({
        column: 'month',
        expression: `'${TEMP_SAVE_DATE_COLUMN_NAME}' | Date:getMonth`
      }),

      tf.column.derive({
        column: 'day',
        expression: `'${TEMP_SAVE_DATE_COLUMN_NAME}' | Date:getDate`
      }),

      tf.column.rename({
        oldColumn: TEMP_SAVE_DATE_COLUMN_NAME,
        newColumn: dateColumn
      })
    ]
  })
}
