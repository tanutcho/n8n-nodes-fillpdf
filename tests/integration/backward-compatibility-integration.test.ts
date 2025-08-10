import { BackwardCompatibilityManager } from '../../nodes/FillPdf/backward-compatibility';
import { MigrationUtilities } from '../../nodes/FillPdf/migration-utilities';
import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping, IFieldInfo } from '../../nodes/FillPdf/types';

// Mock n8n execution context
const createMockContext = (parameters: Record<string, any> = {}): IExecuteFunctions => {
	return {
		getNodeParameter: jest.fn((paramName: string, itemIndex: number, defaultValue?: any) => {
			const key = `${paramName}_${itemIndex}`;
			if (parameters[key] !== undefined) {
				return parameters[key];
			}
			if (parameters[paramName] !== undefined) {
				return parameters[paramName];
			}
			if (defaultValue !== undefined) {
				return defaultValue;
			}
			throw new Error(`Parameter ${paramName} not found`);
		}),
	} as any;
};

describe('Backward Compatibility Integration', () => {
	describe('End-to-End Legacy Configuration Support', () => {
		it('should handle complete legacy workflow configuration', () => {
			const legacyConfig = {
				pdfSource: 'url',
				pdfUrl: 'https://example.com/form.pdf',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'firstName',
							valueSource: 'static',
							staticValue: 'John'
						},
						{
							pdfFieldName: 'lastName',
							valueSource: 'expression',
							expression: '{{ $json.surname }}'
						},
						{
							pdfFieldName: 'isActive',
							valueSource: 'static',
							staticValue: true
						}
					]
				},
				outputFormat: 'binary',
				options: {
					flattenPdf: true,
					validateFields: true
				}
			};

			const mockContext = createMockContext(legacyConfig);
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);

			// Test legacy detection
			expect(compatibilityManager.isLegacyConfiguration(0)).toBe(true);

			// Test field mapping retrieval
			const fieldMappings = compatibilityManager.getCompatibleFieldMappings(0);
			expect(fieldMappings.mapping).toHaveLength(3);
			expect(fieldMappings.mapping[0].pdfFieldName).toBe('firstName');

			// Test validation
			const validation = compatibilityManager.validateFieldMappingsWithCompatibility(0);
			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('Using legacy configuration mode - all functionality is supported');
			expect(validation.warnings).toContain('Migration to enhanced mode is recommended for better features');

			// Test migration recommendation
			expect(compatibilityManager.shouldRecommendMigration(0)).toBe(true);
			const migrationRec = compatibilityManager.getMigrationRecommendation(0);
			expect(migrationRec).toContain('Migration Recommendation');
		});

		it('should handle enhanced configuration without issues', () => {
			const enhancedConfig = {
				pdfSource: 'url',
				pdfUrl: 'https://example.com/form.pdf',
				fieldConfigMode: 'enhanced',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'firstName',
							valueSource: 'static',
							staticValue: 'John'
						}
					]
				},
				outputFormat: 'binary',
				options: {
					flattenPdf: true,
					validateFields: true
				}
			};

			const mockContext = createMockContext(enhancedConfig);
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);

			// Test enhanced detection
			expect(compatibilityManager.isLegacyConfiguration(0)).toBe(false);

			// Test field mapping retrieval
			const fieldMappings = compatibilityManager.getCompatibleFieldMappings(0);
			expect(fieldMappings.mapping).toHaveLength(1);

			// Test validation
			const validation = compatibilityManager.validateFieldMappingsWithCompatibility(0);
			expect(validation.valid).toBe(true);
			expect(validation.warnings).not.toContain('Using legacy configuration mode');

			// Test no migration recommendation
			expect(compatibilityManager.shouldRecommendMigration(0)).toBe(false);
		});

		it('should handle manual configuration mode', () => {
			const manualConfig = {
				pdfSource: 'url',
				pdfUrl: 'https://example.com/form.pdf',
				fieldConfigMode: 'manual',
				manualFieldMappings: {
					mapping: [
						{
							pdfFieldName: 'customField',
							valueSource: 'static',
							staticValue: 'manual value'
						}
					]
				},
				fieldMappings: { mapping: [] }, // Empty enhanced mappings
				outputFormat: 'binary'
			};

			const mockContext = createMockContext(manualConfig);
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);

			// Test manual mode detection
			expect(compatibilityManager.isLegacyConfiguration(0)).toBe(false);

			// Test field mapping retrieval uses manual mappings
			const fieldMappings = compatibilityManager.getCompatibleFieldMappings(0);
			expect(fieldMappings.mapping).toHaveLength(1);
			expect(fieldMappings.mapping[0].pdfFieldName).toBe('customField');
			expect(fieldMappings.mapping[0].staticValue).toBe('manual value');
		});

		it('should handle upload/binary sources correctly', () => {
			const uploadConfig = {
				pdfSource: 'upload',
				pdfFile: 'uploaded-form.pdf',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'uploadField',
							valueSource: 'static',
							staticValue: 'upload value'
						}
					]
				},
				outputFormat: 'binary'
			};

			const mockContext = createMockContext(uploadConfig);
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);

			// Upload sources should not be considered legacy
			expect(compatibilityManager.isLegacyConfiguration(0)).toBe(false);

			// Should not recommend migration
			expect(compatibilityManager.shouldRecommendMigration(0)).toBe(false);

			// Field mappings should work normally
			const fieldMappings = compatibilityManager.getCompatibleFieldMappings(0);
			expect(fieldMappings.mapping).toHaveLength(1);
			expect(fieldMappings.mapping[0].pdfFieldName).toBe('uploadField');
		});
	});

	describe('Migration Workflow Integration', () => {
		it('should perform complete migration analysis and automation', async () => {
			const legacyConfig = {
				pdfSource: 'url',
				pdfUrl: 'https://example.com/form.pdf',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'textField',
							valueSource: 'static',
							staticValue: 'test value'
						},
						{
							pdfFieldName: 'dropdownField',
							valueSource: 'static',
							staticValue: 'Option1'
						}
					]
				}
			};

			const extractedFields: IFieldInfo[] = [
				{
					name: 'textField',
					type: 'text',
					required: false
				},
				{
					name: 'dropdownField',
					type: 'dropdown',
					required: true,
					options: ['Option1', 'Option2', 'Option3']
				}
			];

			const mockContext = createMockContext(legacyConfig);
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);
			const migrationUtilities = compatibilityManager.getMigrationUtilities();

			// Analyze configuration
			const analysis = migrationUtilities.analyzeConfiguration(0);
			expect(analysis.migrationRecommendation.recommended).toBe(true);
			expect(analysis.preservedData.fieldCount).toBe(2);
			expect(analysis.migrationSteps).toHaveLength(6);

			// Perform automated migration
			const migrationResult = await migrationUtilities.performAutomatedMigration(0, extractedFields);
			expect(migrationResult.success).toBe(true);
			expect(migrationResult.migratedFields).toHaveLength(2);
			expect(migrationResult.migratedFields[0].migrationStatus).toBe('success');
			expect(migrationResult.migratedFields[1].migrationStatus).toBe('success');

			// Generate comprehensive report
			const report = migrationUtilities.generateMigrationReport(analysis, migrationResult);
			expect(report).toContain('Fill PDF Configuration Migration Report');
			expect(report).toContain('Migration Result:');
			expect(report).toContain('Status: Success');
		});

		it('should handle migration with field validation warnings', async () => {
			const legacyConfig = {
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'dropdownField',
							valueSource: 'static',
							staticValue: 'InvalidOption'
						},
						{
							pdfFieldName: 'missingField',
							valueSource: 'static',
							staticValue: 'some value'
						}
					]
				}
			};

			const extractedFields: IFieldInfo[] = [
				{
					name: 'dropdownField',
					type: 'dropdown',
					required: false,
					options: ['Option1', 'Option2', 'Option3']
				}
			];

			const mockContext = createMockContext(legacyConfig);
			const migrationUtilities = new MigrationUtilities(mockContext);

			const migrationResult = await migrationUtilities.performAutomatedMigration(0, extractedFields);
			
			expect(migrationResult.success).toBe(true);
			expect(migrationResult.migratedFields).toHaveLength(1);
			expect(migrationResult.migratedFields[0].migrationStatus).toBe('warning');
			expect(migrationResult.warnings).toContain("Field 'missingField' not found in extracted PDF fields");
			expect(migrationResult.warnings.some(w => w.includes('not found in dropdown options'))).toBe(true);
		});
	});

	describe('Configuration Summary and Logging', () => {
		it('should generate accurate configuration summaries', () => {
			const testCases = [
				{
					name: 'Legacy URL Configuration',
					config: {
						pdfSource: 'url',
						fieldMappings: { mapping: [{ pdfFieldName: 'test', valueSource: 'static', staticValue: 'value' }] }
					},
					expectedMode: 'Legacy (No fieldConfigMode)',
					expectedLegacy: true
				},
				{
					name: 'Enhanced URL Configuration',
					config: {
						pdfSource: 'url',
						fieldConfigMode: 'enhanced',
						fieldMappings: { mapping: [{ pdfFieldName: 'test', valueSource: 'static', staticValue: 'value' }] }
					},
					expectedMode: 'Enhanced',
					expectedLegacy: false
				},
				{
					name: 'Manual URL Configuration',
					config: {
						pdfSource: 'url',
						fieldConfigMode: 'manual',
						manualFieldMappings: { mapping: [{ pdfFieldName: 'test', valueSource: 'static', staticValue: 'value' }] },
						fieldMappings: { mapping: [] }
					},
					expectedMode: 'Manual',
					expectedLegacy: false
				},
				{
					name: 'Upload Configuration',
					config: {
						pdfSource: 'upload',
						fieldMappings: { mapping: [{ pdfFieldName: 'test', valueSource: 'static', staticValue: 'value' }] }
					},
					expectedMode: 'Enhanced (Default)',
					expectedLegacy: false
				}
			];

			testCases.forEach(testCase => {
				const mockContext = createMockContext(testCase.config);
				const compatibilityManager = new BackwardCompatibilityManager(mockContext);
				
				const summary = compatibilityManager.getConfigurationSummary(0);
				const isLegacy = compatibilityManager.isLegacyConfiguration(0);

				expect(summary).toContain(`Configuration Mode: ${testCase.expectedMode}`);
				expect(summary).toContain(`Legacy Configuration: ${testCase.expectedLegacy ? 'Yes' : 'No'}`);
				expect(isLegacy).toBe(testCase.expectedLegacy);
			});
		});

		it('should provide migration prompts when appropriate', () => {
			const legacyConfig = {
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'field1',
							valueSource: 'static',
							staticValue: 'value1'
						}
					]
				}
			};

			const mockContext = createMockContext(legacyConfig);
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);
			
			const prompt = compatibilityManager.createMigrationPrompt(0);
			expect(prompt).toContain('Configuration Migration Available');
			expect(prompt).toContain('Benefits of upgrading:');
			expect(prompt).toContain('Automatic field detection and validation');
			expect(prompt).toContain('1 field mappings will be preserved');
		});
	});

	describe('Error Handling and Edge Cases', () => {
		it('should handle missing parameters gracefully', () => {
			const mockContext = createMockContext({});
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);

			// Should not throw errors
			expect(() => compatibilityManager.isLegacyConfiguration(0)).not.toThrow();
			expect(() => compatibilityManager.getConfigurationSummary(0)).not.toThrow();
			expect(() => compatibilityManager.ensureParameterCompatibility(0)).not.toThrow();
		});

		it('should handle invalid field mapping structures', () => {
			const invalidConfig = {
				pdfSource: 'url',
				fieldMappings: { mapping: null }
			};

			const mockContext = createMockContext(invalidConfig);
			const compatibilityManager = new BackwardCompatibilityManager(mockContext);

			const validation = compatibilityManager.validateFieldMappingsWithCompatibility(0);
			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Invalid field mapping structure');
		});

		it('should handle migration for non-recommended configurations', async () => {
			const enhancedConfig = {
				pdfSource: 'url',
				fieldConfigMode: 'enhanced',
				fieldMappings: { mapping: [] }
			};

			const mockContext = createMockContext(enhancedConfig);
			const migrationUtilities = new MigrationUtilities(mockContext);

			const result = await migrationUtilities.performAutomatedMigration(0, []);
			expect(result.success).toBe(false);
			expect(result.message).toContain('Migration not recommended');
		});
	});
});