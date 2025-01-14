import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'warn',
        {
          allowForKnownSafeCalls: [
            { from: 'package', name: 'it', package: 'node:test' },
            { from: 'package', name: 'test', package: 'node:test' },
            { from: 'package', name: 'skip', package: 'node:test' },
            {
              from: 'package',
              name: 'stringToUint8Array',
              package: 'uint8array-extras'
            }
          ]
        }
      ],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn'
    }
  },
  {
    ignores: ['build/', '__temp/']
  }
)
