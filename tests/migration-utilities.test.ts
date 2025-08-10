import { MigrationUtilities, IMigrationAnalysis } from '../nodes/FillPdf/migration-utilities';
import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping, IFieldInfo } from '../nodes/FillPdf/types';

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

describe('MigrationUtilities', () => {
	describe('Configuration Analysis', () => {
		it('should analyze legacy URL configuration and recommend migration', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'field1',
							valueSource: 'static',
							staticValue: 'value1'
						},
						{
							pdfFieldName: 'field2',
							valueSource: 'expression',
							expression: '{{ $json.field2 }}'
						}
					]
				}
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);

			expect(analysis.currentConfiguration.isLegacy).toBe(true);
			expect(analysis.currentConfiguration.pdfSource).toBe('url');
			expect(analysis.currentConfiguration.fieldMappingCount).toBe(2);
			expect(analysis.migrationRecommendation.recommended).toBe(true);
			expect(analysis.migrationRecommendation.complexity).toBe('low');
			expect(analysis.migrationRecommendation.benefits).toContain('Automatic field detection and validation');
		});

		it('should not recommend migration for enhanced configuration', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'enhanced',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'field1',
							valueSource: 'static',
							staticValue: 'value1'
						}
					]
				}
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);

			expect(analysis.currentConfiguration.isLegacy).toBe(false);
			expect(analysis.migrationRecommendation.recommended).toBe(false);
			expect(analysis.migrationRecommendation.reason).toContain('already using enhanced features');
		});

		it('should not recommend migration for upload/binary sources', () => {
			const mockContext = createMockContext({
				pdfSource: 'upload',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'field1',
							valueSource: 'static',
							staticValue: 'value1'
						}
					]
				}
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);

			expect(analysis.migrationRecommendation.recommended).toBe(false);
			expect(analysis.migrationRecommendation.reason).toContain('already use enhanced field extraction at runtime');
		});

		it('should generate appropriate migration steps for legacy URL configuration', () => {
			const mockContext = createMockContext({
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
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);

			expect(analysis.migrationSteps).toHaveLength(6);
			expect(analysis.migrationSteps[0].title).toBe('Backup Current Configuration');
			expect(analysis.migrationSteps[1].title).toBe('Switch to Enhanced Mode');
			expect(analysis.migrationSteps[3].automated).toBe(true); // Data migration step
		});

		it('should identify preservable data correctly', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'field1',
							valueSource: 'static',
							staticValue: 'static_value'
						},
						{
							pdfFieldName: 'field2',
							valueSource: 'expression',
							expression: '{{ $json.field2 }}'
						}
					]
				}
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);

			expect(analysis.preservedData.fieldCount).toBe(2);
			expect(analysis.preservedData.staticValues).toEqual({
				field1: 'static_value'
			});
			expect(analysis.preservedData.expressions).toEqual({
				field2: '{{ $json.field2 }}'
			});
			expect(analysis.preservedData.preservationRate).toBe(100);
		});
	});

	describe('Automated Migration', () => {
		it('should successfully migrate compatible field mappings', async () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'textField',
							valueSource: 'static',
							staticValue: 'test value'
						},
						{
							pdfFieldName: 'checkboxField',
							valueSource: 'static',
							staticValue: true
						}
					]
				}
			});

			const extractedFields: IFieldInfo[] = [
				{
					name: 'textField',
					type: 'text',
					required: false
				},
				{
					name: 'checkboxField',
					type: 'checkbox',
					required: true
				}
			];

			const utilities = new MigrationUtilities(mockContext);
			const result = await utilities.performAutomatedMigration(0, extractedFields);

			expect(result.success).toBe(true);
			expect(result.migratedFields).toHaveLength(2);
			expect(result.migratedFields[0].originalFieldName).toBe('textField');
			expect(result.migratedFields[0].migrationStatus).toBe('success');
			expect(result.migratedFields[1].originalFieldName).toBe('checkboxField');
			expect(result.migratedFields[1].migrationStatus).toBe('success');
		});

		it('should handle missing fields with warnings', async () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'missingField',
							valueSource: 'static',
							staticValue: 'test value'
						},
						{
							pdfFieldName: 'existingField',
							valueSource: 'static',
							staticValue: 'another value'
						}
					]
				}
			});

			const extractedFields: IFieldInfo[] = [
				{
					name: 'existingField',
					type: 'text',
					required: false
				}
			];

			const utilities = new MigrationUtilities(mockContext);
			const result = await utilities.performAutomatedMigration(0, extractedFields);

			expect(result.success).toBe(true);
			expect(result.migratedFields).toHaveLength(1);
			expect(result.warnings).toContain("Field 'missingField' not found in extracted PDF fields");
		});

		it('should validate dropdown field compatibility', async () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'dropdownField',
							valueSource: 'static',
							staticValue: 'InvalidOption'
						}
					]
				}
			});

			const extractedFields: IFieldInfo[] = [
				{
					name: 'dropdownField',
					type: 'dropdown',
					required: false,
					options: ['Option1', 'Option2', 'Option3']
				}
			];

			const utilities = new MigrationUtilities(mockContext);
			const result = await utilities.performAutomatedMigration(0, extractedFields);

			expect(result.success).toBe(true);
			expect(result.migratedFields[0].migrationStatus).toBe('warning');
			expect(result.warnings.some(w => w.includes('not found in dropdown options'))).toBe(true);
		});

		it('should handle case-insensitive dropdown matches', async () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'dropdownField',
							valueSource: 'static',
							staticValue: 'option1' // lowercase
						}
					]
				}
			});

			const extractedFields: IFieldInfo[] = [
				{
					name: 'dropdownField',
					type: 'dropdown',
					required: false,
					options: ['Option1', 'Option2', 'Option3'] // proper case
				}
			];

			const utilities = new MigrationUtilities(mockContext);
			const result = await utilities.performAutomatedMigration(0, extractedFields);

			expect(result.success).toBe(true);
			expect(result.migratedFields[0].migrationStatus).toBe('warning');
			expect(result.warnings.some(w => w.includes("Consider using 'Option1' instead of 'option1'"))).toBe(true);
		});

		it('should not migrate when not recommended', async () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'enhanced',
				fieldMappings: { mapping: [] }
			});

			const utilities = new MigrationUtilities(mockContext);
			const result = await utilities.performAutomatedMigration(0, []);

			expect(result.success).toBe(false);
			expect(result.message).toContain('Migration not recommended');
			expect(result.errors).toContain('Migration not applicable for current configuration type');
		});
	});

	describe('Migration Report Generation', () => {
		it('should generate comprehensive migration report', () => {
			const mockContext = createMockContext({
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
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);
			const report = utilities.generateMigrationReport(analysis);

			expect(report).toContain('Fill PDF Configuration Migration Report');
			expect(report).toContain('Current Configuration:');
			expect(report).toContain('Migration Recommendation:');
			expect(report).toContain('Benefits of Migration:');
			expect(report).toContain('Migration Steps:');
			expect(report).toContain('Data Preservation:');
		});

		it('should include migration result in report when provided', () => {
			const mockContext = createMockContext({
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
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);
			const migrationResult = {
				success: true,
				message: 'Migration completed successfully',
				migratedFields: [],
				warnings: ['Test warning'],
				errors: []
			};

			const report = utilities.generateMigrationReport(analysis, migrationResult);

			expect(report).toContain('Migration Result:');
			expect(report).toContain('Status: Success');
			expect(report).toContain('Migration Warnings:');
			expect(report).toContain('Test warning');
		});
	});

	describe('Migration Prompt Creation', () => {
		it('should create migration prompt for recommended migrations', () => {
			const mockContext = createMockContext({
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
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);
			const prompt = utilities.createMigrationPrompt(analysis);

			expect(prompt).toContain('Configuration Migration Available');
			expect(prompt).toContain('Benefits of upgrading:');
			expect(prompt).toContain('Automatic field detection and validation');
			expect(prompt).toContain('Migration complexity: LOW');
			expect(prompt).toContain('1 field mappings will be preserved');
		});

		it('should return empty prompt when migration not recommended', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'enhanced',
				fieldMappings: { mapping: [] }
			});

			const utilities = new MigrationUtilities(mockContext);
			const analysis = utilities.analyzeConfiguration(0);
			const prompt = utilities.createMigrationPrompt(analysis);

			expect(prompt).toBe('');
		});
	});

	describe('Field Type Validation', () => {
		it('should validate checkbox field types', () => {
			const mockContext = createMockContext({});
			const utilities = new MigrationUtilities(mockContext);
			
			// Access private method through any cast for testing
			const validateMethod = (utilities as any).validateFieldTypeCompatibility;
			
			const validResult = validateMethod(true, 'checkbox');
			expect(validResult.valid).toBe(true);
			
			const invalidResult = validateMethod('invalid', 'checkbox');
			expect(invalidResult.valid).toBe(false);
			expect(invalidResult.warnings[0]).toContain('not be compatible with checkbox field type');
		});

		it('should validate dropdown field options', () => {
			const mockContext = createMockContext({});
			const utilities = new MigrationUtilities(mockContext);
			
			const validateMethod = (utilities as any).validateFieldTypeCompatibility;
			
			const validResult = validateMethod('Option1', 'dropdown', ['Option1', 'Option2']);
			expect(validResult.valid).toBe(true);
			
			const invalidResult = validateMethod('InvalidOption', 'dropdown', ['Option1', 'Option2']);
			expect(invalidResult.valid).toBe(false);
			expect(invalidResult.warnings[0]).toContain('not found in dropdown options');
		});

		it('should handle text field validation', () => {
			const mockContext = createMockContext({});
			const utilities = new MigrationUtilities(mockContext);
			
			const validateMethod = (utilities as any).validateFieldTypeCompatibility;
			
			const validResult = validateMethod('text value', 'text');
			expect(validResult.valid).toBe(true);
			
			const objectResult = validateMethod({ key: 'value' }, 'text');
			expect(objectResult.valid).toBe(false);
			expect(objectResult.warnings[0]).toContain('Object values will be converted to JSON string');
		});
	});

	describe('Configuration Mode Detection', () => {
		it('should detect enhanced mode correctly', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'enhanced'
			});

			const utilities = new MigrationUtilities(mockContext);
			const configMode = (utilities as any).getConfigurationMode(0);

			expect(configMode).toBe('Enhanced');
		});

		it('should detect manual mode correctly', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'manual'
			});

			const utilities = new MigrationUtilities(mockContext);
			const configMode = (utilities as any).getConfigurationMode(0);

			expect(configMode).toBe('Manual');
		});

		it('should detect legacy mode when fieldConfigMode is missing', () => {
			const mockContext = createMockContext({
				pdfSource: 'url'
			});

			const utilities = new MigrationUtilities(mockContext);
			const configMode = (utilities as any).getConfigurationMode(0);

			expect(configMode).toBe('Legacy');
		});

		it('should return runtime mode for upload/binary sources', () => {
			const mockContext = createMockContext({
				pdfSource: 'upload'
			});

			const utilities = new MigrationUtilities(mockContext);
			const configMode = (utilities as any).getConfigurationMode(0);

			expect(configMode).toBe('Enhanced (Runtime)');
		});
	});
});