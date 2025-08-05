module.exports = {
	semi: true,
	singleQuote: true,
	trailingComma: 'all',
	useTabs: true,
	tabWidth: 4,
	printWidth: 100,
	endOfLine: 'lf',
	arrowParens: 'always',
	bracketSpacing: true,
	bracketSameLine: false,
	quoteProps: 'as-needed',
	overrides: [
		{
			files: '*.json',
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},
		{
			files: '*.md',
			options: {
				useTabs: false,
				tabWidth: 2,
				printWidth: 80,
			},
		},
		{
			files: '*.yml',
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},
	],
};