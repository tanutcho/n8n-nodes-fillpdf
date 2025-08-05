module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/tests'],
	testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],

	collectCoverageFrom: [
		'nodes/**/*.ts',
		'!nodes/**/*.d.ts',
		'!nodes/**/*.test.ts',
		'!nodes/**/*.spec.ts',
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	testTimeout: 30000,
	// More lenient TypeScript checking for tests
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			isolatedModules: true,
			tsconfig: {
				strict: false,
				noUnusedLocals: false,
				noUnusedParameters: false,
				noImplicitAny: false,
			},
		}],
	},
};