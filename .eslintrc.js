module.exports = {
	root: true,
	env: {
		browser: false,
		es6: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	plugins: [
		'@typescript-eslint',
		'n8n-nodes-base',
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:n8n-nodes-base/nodes',
		'prettier',
	],
	rules: {
		// Disable conflicting n8n rules
		'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
		'n8n-nodes-base/node-class-description-outputs-wrong': 'off',

		// TypeScript rules
		'@typescript-eslint/no-unused-vars': 'off', // Disable for tests
		'@typescript-eslint/no-explicit-any': 'off', // Allow any for n8n compatibility
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
		'@typescript-eslint/prefer-nullish-coalescing': 'off', // Too many false positives
		'@typescript-eslint/prefer-optional-chain': 'off', // Too many false positives
		'@typescript-eslint/no-var-requires': 'off', // Allow require for dynamic imports

		// General ESLint rules
		'eqeqeq': 'error',
		'no-console': 'off', // Allow console for debugging in development
		'no-debugger': 'error',
		'no-duplicate-imports': 'error',
		'no-unused-expressions': 'error',
		'no-case-declarations': 'off', // Allow declarations in case blocks
		'prefer-const': 'error',
		'prefer-template': 'warn',
	},
	overrides: [
		{
			files: ['**/*.test.ts', '**/*.test.js'],
			env: {
				jest: true,
			},
			rules: {
				// Relax some rules for test files
				'@typescript-eslint/no-explicit-any': 'off',
				'no-console': 'off',
			},
		},
		{
			files: ['**/*.js'],
			rules: {
				// Relax TypeScript rules for JavaScript files
				'@typescript-eslint/no-var-requires': 'off',
				'@typescript-eslint/explicit-function-return-type': 'off',
			},
		},
		{
			files: ['gulpfile.js', 'jest.config.js', '.eslintrc.js'],
			env: {
				node: true,
			},
			rules: {
				'@typescript-eslint/no-var-requires': 'off',
			},
		},
	],
	ignorePatterns: [
		'dist/',
		'node_modules/',
		'coverage/',
		'*.d.ts',
	],
};