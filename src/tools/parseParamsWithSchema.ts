import { SafeParseReturnType, ZodType } from 'zod'

/**
 * parseParamsWithSchema
 *
 * @template {ZodType} T
 * @param {T} schema
 * @param {unknown} data
 * @param {string} transformName
 * @returns {T['_output']} Parsed and validated data
 * @throws {TypeError} When validation fails
 */

export default <T extends ZodType>(
  schema: T,
  data: unknown,
  transformName: string
): T['_output'] => {
  const parseResult: SafeParseReturnType<T['_input'], T['_output']> =
    schema.safeParse(data)

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]

    if (firstIssue === undefined) {
      throw new TypeError(`${transformName} incorrect parameters`, {
        cause: parseResult.error
      })
    }

    const message = firstIssue.path.join('.') + ' - ' + firstIssue.message

    throw new TypeError(`${transformName}: ${message}`, {
      cause: parseResult.error
    })
  }

  return parseResult.data /* eslint-disable-line @typescript-eslint/no-unsafe-return */
}
