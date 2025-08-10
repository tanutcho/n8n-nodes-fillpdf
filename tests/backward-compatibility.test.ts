import { BackwardCompatibilityManager } from '../nodes/FillPdf/backward-compatibility';
import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping } from '../nodes/FillPdf/types';

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

describe('BackwardCompatibilityManager', () => {
	describe('Legacy Configuration Detection', () => {
		it('should detect legacy configuration for URL source without fieldConfigMode', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'testField',
							valueSource: 'static',
							staticValue: 'test value'
						}
					]
				}
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const isLegacy = manager.isLegacyConfiguration(0);

			expect(isLegacy).toBe(true);
		});

		it('should not detect legacy configuration for URL source with fieldConfigMode', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'enhanced',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: 'testField',
							valueSource: 'static',
							staticValue: 'test value'
						}
					]
				}
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const isLegacy = manager.isLegacyConfiguration(0);

			expect(isLegacy).toBe(false);
		});

		it('should not detect legacy configuration for upload/binary sources with no mappings', () => {
			const mockContext = createMockContext({
				pdfSource: 'upload',
				fieldMappings: { mapping: [] }
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const isLegacy = manager.isLegacyConfiguration(0);

			expect(isLegacy).toBe(false);
		});

		it('should handle errors gracefully when detecting legacy configuration', () => {
			const mockContext = createMockContext({});

			const manager = new BackwardCompatibilityManager(mockContext);
			const isLegacy = manager.isLegacyConfiguration(0);

			// Should default to false when parameters are missing
			expect(isLegacy).toBe(false);
		});
	});

	describe('Compatible Field Mappings', () => {
		it('should return enhanced field mappings for URL source in enhanced mode', () => {
			const expectedMappings = {
				mapping: [
					{
						pdfFieldName: 'enhancedField',
						valueSource: 'expression',
						expression: '{{ $json.value }}'
					}
				]
			};

			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'enhanced',
				fieldMappings: expectedMappings
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const mappings = manager.getCompatibleFieldMappings(0);

			expect(mappings).toEqual(expectedMappings);
		});

		it('should return manual field mappings for URL source in manual mode', () => {
			const expectedMappings = {
				mapping: [
					{
						pdfFieldName: 'manualField',
						valueSource: 'static',
						staticValue: 'manual value'
					}
				]
			};

			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'manual',
				manualFieldMappings: expectedMappings,
				fieldMappings: { mapping: [] }
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const mappings = manager.getCompatibleFieldMappings(0);

			expect(mappings).toEqual(expectedMappings);
		});

		it('should return field mappings for upload/binary sources', () => {
			const expectedMappings = {
				mapping: [
					{
						pdfFieldName: 'uploadField',
						valueSource: 'static',
						staticValue: 'upload value'
					}
				]
			};

			const mockContext = createMockContext({
				pdfSource: 'upload',
				fieldMappings: expectedMappings
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const mappings = manager.getCompatibleFieldMappings(0);

			expect(mappings).toEqual(expectedMappings);
		});

		it('should handle legacy URL configuration without fieldConfigMode', () => {
			const expectedMappings = {
				mapping: [
					{
						pdfFieldName: 'legacyField',
						valueSource: 'static',
						staticValue: 'legacy value'
					}
				]
			};

			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: expectedMappings
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const mappings = manager.getCompatibleFieldMappings(0);

			expect(mappings).toEqual(expectedMappings);
		});
	});

	describe('Legacy Field Mapping Validation', () => {
		it('should validate correct legacy field mappings', () => {
			const validMappings = {
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
			};

			const mockContext = createMockContext({});
			const manager = new BackwardCompatibilityManager(mockContext);
			const validation = manager.validateLegacyFieldMappings(validMappings);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toHaveLength(0);
		});

		it('should detect missing required fields', () => {
			const invalidMappings = {
				mapping: [
					{
						pdfFieldName: '',
						valueSource: 'static',
						staticValue: 'value1'
					},
					{
						pdfFieldName: 'field2',
						valueSource: 'expression',
						expression: ''
					}
				]
			};

			const mockContext = createMockContext({});
			const manager = new BackwardCompatibilityManager(mockContext);
			const validation = manager.validateLegacyFieldMappings(invalidMappings);

			expect(validation.valid).toBe(false);
			expect(validation.warnings).toContain('Field mapping 1: PDF field name is required');
			expect(validation.warnings).toContain('Field mapping 2: Expression is required for expression value source');
		});

		it('should detect unsupported value sources', () => {
			const invalidMappings = {
				mapping: [
					{
						pdfFieldName: 'field1',
						valueSource: 'unsupported',
						staticValue: 'value1'
					} as any
				]
			};

			const mockContext = createMockContext({});
			const manager = new BackwardCompatibilityManager(mockContext);
			const validation = manager.validateLegacyFieldMappings(invalidMappings);

			expect(validation.valid).toBe(false);
			expect(validation.warnings).toContain("Field mapping 1: Unsupported value source 'unsupported'");
		});

		it('should warn about deprecated expression patterns', () => {
			const mappingsWithDeprecated = {
				mapping: [
					{
						pdfFieldName: 'field1',
						valueSource: 'expression',
						expression: '{{ $node["Previous Node"].json.field }}'
					}
				]
			};

			const mockContext = createMockContext({});
			const manager = new BackwardCompatibilityManager(mockContext);
			const validation = manager.validateLegacyFieldMappings(mappingsWithDeprecated);

			expect(validation.valid).toBe(true);
			expect(validation.warnings.some(w => w.includes('Consider using $("NodeName").json syntax'))).toBe(true);
		});

		it('should handle invalid mapping structure', () => {
			const invalidStructure = { mapping: null } as any;

			const mockContext = createMockContext({});
			const manager = new BackwardCompatibilityManager(mockContext);
			const validation = manager.validateLegacyFieldMappings(invalidStructure);

			expect(validation.valid).toBe(false);
			expect(validation.warnings).toContain('Invalid field mapping structure');
		});
	});

	describe('Migration Recommendations', () => {
		it('should recommend migration for legacy URL configurations', () => {
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

			const manager = new BackwardCompatibilityManager(mockContext);
			const shouldRecommend = manager.shouldRecommendMigration(0);
			const recommendation = manager.getMigrationRecommendation(0);

			expect(shouldRecommend).toBe(true);
			expect(recommendation).toContain('Migration Recommendation');
			expect(recommendation).toContain('Enhanced Automatic mode');
		});

		it('should not recommend migration for enhanced configurations', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'enhanced',
				fieldMappings: { mapping: [] }
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const shouldRecommend = manager.shouldRecommendMigration(0);
			const recommendation = manager.getMigrationRecommendation(0);

			expect(shouldRecommend).toBe(false);
			expect(recommendation).toBeNull();
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

			const manager = new BackwardCompatibilityManager(mockContext);
			const shouldRecommend = manager.shouldRecommendMigration(0);

			expect(shouldRecommend).toBe(false);
		});
	});

	describe('Configuration Summary', () => {
		it('should generate correct summary for enhanced configuration', () => {
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

			const manager = new BackwardCompatibilityManager(mockContext);
			const summary = manager.getConfigurationSummary(0);

			expect(summary).toContain('PDF Source: url');
			expect(summary).toContain('Configuration Mode: Enhanced');
			expect(summary).toContain('Legacy Configuration: No');
			expect(summary).toContain('Field Mappings: 1');
		});

		it('should generate correct summary for manual configuration', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldConfigMode: 'manual',
				manualFieldMappings: {
					mapping: [
						{
							pdfFieldName: 'field1',
							valueSource: 'static',
							staticValue: 'value1'
						}
					]
				},
				fieldMappings: { mapping: [] }
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const summary = manager.getConfigurationSummary(0);

			expect(summary).toContain('Configuration Mode: Manual');
		});

		it('should generate correct summary for legacy configuration', () => {
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

			const manager = new BackwardCompatibilityManager(mockContext);
			const summary = manager.getConfigurationSummary(0);

			expect(summary).toContain('Configuration Mode: Legacy');
			expect(summary).toContain('Legacy Configuration: Yes');
		});
	});

	describe('Field Mapping Migration', () => {
		it('should migrate legacy field mappings with defaults', () => {
			const legacyMappings = {
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
					},
					{
						pdfFieldName: 'field3'
						// Missing valueSource and values
					} as any
				]
			};

			const mockContext = createMockContext({});
			const manager = new BackwardCompatibilityManager(mockContext);
			const migrated = manager.migrateLegacyFieldMappings(legacyMappings);

			expect(migrated.mapping).toHaveLength(3);
			expect(migrated.mapping[0]).toEqual({
				pdfFieldName: 'field1',
				valueSource: 'static',
				staticValue: 'value1',
				expression: ''
			});
			expect(migrated.mapping[1]).toEqual({
				pdfFieldName: 'field2',
				valueSource: 'expression',
				staticValue: '',
				expression: '{{ $json.field2 }}'
			});
			expect(migrated.mapping[2]).toEqual({
				pdfFieldName: 'field3',
				valueSource: 'static',
				staticValue: '',
				expression: ''
			});
		});
	});

	describe('Parameter Compatibility', () => {
		it('should handle missing options parameter gracefully', () => {
			const mockContext = createMockContext({
				pdfSource: 'upload'
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			
			// Should not throw error
			expect(() => manager.ensureParameterCompatibility(0)).not.toThrow();
		});

		it('should handle existing options parameter', () => {
			const mockContext = createMockContext({
				pdfSource: 'upload',
				options: {
					flattenPdf: false,
					validateFields: true
				}
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			
			// Should not throw error
			expect(() => manager.ensureParameterCompatibility(0)).not.toThrow();
		});
	});

	describe('Field Mapping Validation with Compatibility', () => {
		it('should validate field mappings with compatibility warnings', () => {
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

			const manager = new BackwardCompatibilityManager(mockContext);
			const validation = manager.validateFieldMappingsWithCompatibility(0);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('Using legacy configuration mode - all functionality is supported');
			expect(validation.warnings).toContain('Migration to enhanced mode is recommended for better features');
		});

		it('should separate errors from warnings', () => {
			const mockContext = createMockContext({
				pdfSource: 'url',
				fieldMappings: {
					mapping: [
						{
							pdfFieldName: '',
							valueSource: 'static',
							staticValue: 'value1'
						}
					]
				}
			});

			const manager = new BackwardCompatibilityManager(mockContext);
			const validation = manager.validateFieldMappingsWithCompatibility(0);

			expect(validation.valid).toBe(false);
			expect(validation.errors.length).toBeGreaterThan(0);
			expect(validation.errors[0]).toContain('PDF field name is required');
		});
	});
});