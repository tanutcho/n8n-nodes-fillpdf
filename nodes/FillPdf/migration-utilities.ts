import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping, IFieldInfo } from './types';

/**
 * Configuration migration utilities for Fill PDF node
 * Helps users migrate from legacy configurations to enhanced mode
 */
export class MigrationUtilities {
	private context: IExecuteFunctions;

	constructor(context: IExecuteFunctions) {
		this.context = context;
	}

	/**
	 * Detect if this is a legacy workflow configuration
	 */
	private isLegacyConfiguration(itemIndex: number = 0): boolean {
		try {
			// Check for legacy field mapping structure
			const fieldMappings = this.context.getNodeParameter('fieldMappings', itemIndex, {
				mapping: [],
			}) as { mapping: IFieldMapping[] };

			// Check if fieldConfigMode exists (new feature)
			const pdfSource = this.context.getNodeParameter('pdfSource', itemIndex) as string;

			// For URL sources, check if fieldConfigMode parameter exists
			if (pdfSource === 'url') {
				try {
					this.context.getNodeParameter('fieldConfigMode', itemIndex);
					// If fieldConfigMode exists, this is a new configuration
					return false;
				} catch {
					// If fieldConfigMode doesn't exist, this might be legacy
					// But we need to check if there are existing field mappings
					return fieldMappings.mapping.length > 0;
				}
			}

			// For upload/binary sources, they are not considered legacy
			// They use enhanced field extraction at runtime
			return false;
		} catch (error) {
			// If we can't determine, assume it's not legacy to be safe
			return false;
		}
	}

	/**
	 * Get field mappings in a backward-compatible way
	 */
	private getCompatibleFieldMappings(itemIndex: number = 0): { mapping: IFieldMapping[] } {
		const pdfSource = this.context.getNodeParameter('pdfSource', itemIndex) as
			| 'upload'
			| 'url'
			| 'binary';

		// For URL sources, check the configuration mode
		if (pdfSource === 'url') {
			try {
				const fieldConfigMode = this.context.getNodeParameter(
					'fieldConfigMode',
					itemIndex,
					'enhanced',
				) as 'enhanced' | 'manual';

				if (fieldConfigMode === 'manual') {
					// Use manual field mappings
					return this.context.getNodeParameter('manualFieldMappings', itemIndex, {
						mapping: [],
					}) as { mapping: IFieldMapping[] };
				}
			} catch {
				// fieldConfigMode doesn't exist, use legacy behavior
				// Fall through to use fieldMappings
			}
		}

		// Use enhanced field mappings (default for all sources and enhanced mode for URL)
		return this.context.getNodeParameter('fieldMappings', itemIndex, { mapping: [] }) as {
			mapping: IFieldMapping[];
		};
	}

	/**
	 * Detect existing configuration type and recommend migration
	 */
	analyzeConfiguration(itemIndex: number = 0): IMigrationAnalysis {
		const pdfSource = this.context.getNodeParameter('pdfSource', itemIndex) as
			| 'upload'
			| 'url'
			| 'binary';
		const isLegacy = this.isLegacyConfiguration(itemIndex);
		const fieldMappings = this.getCompatibleFieldMappings(itemIndex);

		let migrationRecommendation: IMigrationRecommendation = {
			recommended: false,
			reason: 'Configuration is already using enhanced features',
			benefits: [],
			risks: [],
			complexity: 'none',
		};

		// Analyze migration potential
		if (isLegacy && pdfSource === 'url') {
			migrationRecommendation = {
				recommended: true,
				reason: 'URL-based PDF source can benefit from enhanced field extraction',
				benefits: [
					'Automatic field detection and validation',
					'Real-time field type indicators',
					'Dropdown option extraction',
					'Better error handling and user feedback',
					'Field caching for improved performance',
					'Enhanced field validation',
				],
				risks: [
					'Minimal risk - existing field mappings will be preserved',
					'May need to verify field names match PDF structure',
				],
				complexity: 'low',
			};
		} else if (pdfSource === 'upload' || pdfSource === 'binary') {
			migrationRecommendation = {
				recommended: false,
				reason: 'Upload and binary sources already use enhanced field extraction at runtime',
				benefits: [
					'Already using enhanced field extraction during execution',
					'Field information logged during workflow runs',
				],
				risks: [],
				complexity: 'none',
			};
		}

		return {
			currentConfiguration: {
				pdfSource,
				isLegacy,
				fieldMappingCount: fieldMappings.mapping.length,
				hasFieldConfigMode: this.hasFieldConfigMode(itemIndex),
				configurationMode: this.getConfigurationMode(itemIndex),
			},
			migrationRecommendation,
			migrationSteps: this.generateMigrationSteps(pdfSource, isLegacy),
			preservedData: this.identifyPreservableData(fieldMappings),
		};
	}

	/**
	 * Generate step-by-step migration instructions
	 */
	private generateMigrationSteps(pdfSource: string, isLegacy: boolean): IMigrationStep[] {
		if (!isLegacy || pdfSource !== 'url') {
			return [];
		}

		const steps: IMigrationStep[] = [
			{
				step: 1,
				title: 'Backup Current Configuration',
				description: 'Save your current field mappings as a backup',
				action: 'manual',
				details: [
					'Copy your existing field mapping configuration',
					'Save it in a text file or document for reference',
					'This ensures you can restore if needed',
				],
				automated: false,
				risk: 'low',
			},
			{
				step: 2,
				title: 'Switch to Enhanced Mode',
				description: 'Change Field Configuration Mode to "Enhanced Automatic"',
				action: 'configuration',
				details: [
					'In the node configuration, find "Field Configuration Mode"',
					'Change from "Manual Configuration" to "Enhanced Automatic (Recommended)"',
					'The interface will update to show enhanced features',
				],
				automated: false,
				risk: 'low',
			},
			{
				step: 3,
				title: 'Verify PDF Field Detection',
				description: 'Confirm that fields are automatically detected from your PDF URL',
				action: 'verification',
				details: [
					'Ensure your PDF URL is entered correctly',
					'Wait for automatic field extraction to complete',
					'Verify that detected fields match your expectations',
					'Check field types and requirements are correctly identified',
				],
				automated: false,
				risk: 'medium',
			},
			{
				step: 4,
				title: 'Migrate Field Values',
				description: 'Transfer your field values to the new enhanced interface',
				action: 'data_migration',
				details: [
					'For each field in your backup configuration:',
					'  - Find the corresponding field in the enhanced interface',
					'  - Copy the value (static value or expression)',
					'  - Verify the field type matches your expectations',
					'Use the migration utility to automate this process',
				],
				automated: true,
				risk: 'medium',
			},
			{
				step: 5,
				title: 'Test Configuration',
				description: 'Test the migrated configuration with sample data',
				action: 'testing',
				details: [
					'Run the workflow with test data',
					'Verify that all fields are filled correctly',
					'Check that the PDF output matches expectations',
					'Compare with previous results if available',
				],
				automated: false,
				risk: 'low',
			},
			{
				step: 6,
				title: 'Cleanup and Optimization',
				description: 'Remove old configuration and optimize settings',
				action: 'cleanup',
				details: [
					'Remove backup field mappings once migration is confirmed',
					'Enable field caching if desired for better performance',
					'Adjust extraction timeout if needed for large PDFs',
					'Update any documentation or notes about the workflow',
				],
				automated: false,
				risk: 'low',
			},
		];

		return steps;
	}

	/**
	 * Identify data that can be preserved during migration
	 */
	private identifyPreservableData(fieldMappings: { mapping: IFieldMapping[] }): IPreservableData {
		const staticValues: Record<string, any> = {};
		const expressions: Record<string, string> = {};
		const fieldTypes: Record<string, string> = {};

		fieldMappings.mapping.forEach((mapping) => {
			if (mapping.valueSource === 'static' && mapping.staticValue !== undefined) {
				staticValues[mapping.pdfFieldName] = mapping.staticValue;
			}
			if (mapping.valueSource === 'expression' && mapping.expression) {
				expressions[mapping.pdfFieldName] = mapping.expression;
			}
			// Note: fieldType might not be available in legacy configurations
		});

		return {
			fieldCount: fieldMappings.mapping.length,
			staticValues,
			expressions,
			fieldTypes,
			preservationRate: fieldMappings.mapping.length > 0 ? 100 : 0, // All field mappings can be preserved
		};
	}

	/**
	 * Perform automated field mapping migration
	 */
	async performAutomatedMigration(
		itemIndex: number = 0,
		extractedFields: IFieldInfo[],
	): Promise<IMigrationResult> {
		const analysis = this.analyzeConfiguration(itemIndex);

		if (!analysis.migrationRecommendation.recommended) {
			return {
				success: false,
				message: 'Migration not recommended for this configuration',
				migratedFields: [],
				warnings: [],
				errors: ['Migration not applicable for current configuration type'],
			};
		}

		const legacyMappings = this.getCompatibleFieldMappings(itemIndex);
		const migratedFields: IMigratedField[] = [];
		const warnings: string[] = [];
		const errors: string[] = [];

		// Create field lookup for validation
		const fieldLookup = new Map<string, IFieldInfo>();
		extractedFields.forEach((field) => fieldLookup.set(field.name, field));

		// Migrate each field mapping
		for (const mapping of legacyMappings.mapping) {
			try {
				const extractedField = fieldLookup.get(mapping.pdfFieldName);

				if (!extractedField) {
					warnings.push(`Field '${mapping.pdfFieldName}' not found in extracted PDF fields`);
					continue;
				}

				const migratedField: IMigratedField = {
					originalFieldName: mapping.pdfFieldName,
					newFieldName: mapping.pdfFieldName,
					originalValueSource: mapping.valueSource,
					newValueSource: mapping.valueSource,
					originalValue:
						mapping.valueSource === 'static' ? mapping.staticValue : mapping.expression,
					newValue: mapping.valueSource === 'static' ? mapping.staticValue : mapping.expression,
					fieldType: extractedField.type,
					migrationStatus: 'success',
					validationResult: {
						valid: true,
						warnings: [],
					},
				};

				// Validate field type compatibility
				if (mapping.valueSource === 'static') {
					const typeValidation = this.validateFieldTypeCompatibility(
						mapping.staticValue,
						extractedField.type,
						extractedField.options,
					);

					if (!typeValidation.valid) {
						migratedField.migrationStatus = 'warning';
						migratedField.validationResult = typeValidation;
						warnings.push(`Field '${mapping.pdfFieldName}': ${typeValidation.warnings.join(', ')}`);
					}
				}

				migratedFields.push(migratedField);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Failed to migrate field '${mapping.pdfFieldName}': ${errorMessage}`);
			}
		}

		const success = errors.length === 0;
		const message = success
			? `Successfully migrated ${migratedFields.length} field mappings`
			: `Migration completed with ${errors.length} errors and ${warnings.length} warnings`;

		return {
			success,
			message,
			migratedFields,
			warnings,
			errors,
		};
	}

	/**
	 * Validate field type compatibility during migration
	 */
	private validateFieldTypeCompatibility(
		value: any,
		fieldType: string,
		fieldOptions?: string[],
	): { valid: boolean; warnings: string[] } {
		const warnings: string[] = [];

		switch (fieldType) {
			case 'checkbox':
				if (
					typeof value !== 'boolean' &&
					value !== 'true' &&
					value !== 'false' &&
					value !== 'Yes' &&
					value !== 'Off' &&
					value !== '1' &&
					value !== '0'
				) {
					warnings.push('Value may not be compatible with checkbox field type');
				}
				break;

			case 'dropdown':
			case 'radio':
				if (fieldOptions && fieldOptions.length > 0) {
					const stringValue = String(value);
					if (!fieldOptions.includes(stringValue)) {
						const caseInsensitiveMatch = fieldOptions.find(
							(option) => option.toLowerCase() === stringValue.toLowerCase(),
						);
						if (caseInsensitiveMatch) {
							warnings.push(
								`Value case doesn't match exactly. Consider using '${caseInsensitiveMatch}' instead of '${stringValue}'`,
							);
						} else {
							warnings.push(
								`Value '${stringValue}' not found in dropdown options: ${fieldOptions.join(', ')}`,
							);
						}
					}
				}
				break;

			case 'text':
				// Text fields are generally compatible with any value
				if (typeof value === 'object' && value !== null) {
					warnings.push('Object values will be converted to JSON string for text fields');
				}
				break;
		}

		return {
			valid: warnings.length === 0,
			warnings,
		};
	}

	/**
	 * Generate migration report
	 */
	generateMigrationReport(analysis: IMigrationAnalysis, result?: IMigrationResult): string {
		const lines: string[] = [];

		lines.push('📋 Fill PDF Configuration Migration Report');
		lines.push('═'.repeat(50));
		lines.push('');

		// Current configuration
		lines.push('📊 Current Configuration:');
		lines.push(`   • PDF Source: ${analysis.currentConfiguration.pdfSource}`);
		lines.push(
			`   • Legacy Configuration: ${analysis.currentConfiguration.isLegacy ? 'Yes' : 'No'}`,
		);
		lines.push(`   • Field Mappings: ${analysis.currentConfiguration.fieldMappingCount}`);
		lines.push(`   • Configuration Mode: ${analysis.currentConfiguration.configurationMode}`);
		lines.push('');

		// Migration recommendation
		lines.push('🎯 Migration Recommendation:');
		lines.push(`   • Recommended: ${analysis.migrationRecommendation.recommended ? 'Yes' : 'No'}`);
		lines.push(`   • Reason: ${analysis.migrationRecommendation.reason}`);
		lines.push(`   • Complexity: ${analysis.migrationRecommendation.complexity}`);
		lines.push('');

		if (analysis.migrationRecommendation.recommended) {
			lines.push('✨ Benefits of Migration:');
			analysis.migrationRecommendation.benefits.forEach((benefit) => {
				lines.push(`   • ${benefit}`);
			});
			lines.push('');

			if (analysis.migrationRecommendation.risks.length > 0) {
				lines.push('⚠️ Migration Risks:');
				analysis.migrationRecommendation.risks.forEach((risk) => {
					lines.push(`   • ${risk}`);
				});
				lines.push('');
			}

			// Migration steps
			if (analysis.migrationSteps.length > 0) {
				lines.push('📝 Migration Steps:');
				analysis.migrationSteps.forEach((step) => {
					lines.push(`   ${step.step}. ${step.title}`);
					lines.push(`      ${step.description}`);
					if (step.automated) {
						lines.push('      ✅ Can be automated');
					}
				});
				lines.push('');
			}
		}

		// Migration result
		if (result) {
			lines.push('🔄 Migration Result:');
			lines.push(`   • Status: ${result.success ? 'Success' : 'Failed'}`);
			lines.push(`   • Message: ${result.message}`);
			lines.push(`   • Migrated Fields: ${result.migratedFields.length}`);
			lines.push(`   • Warnings: ${result.warnings.length}`);
			lines.push(`   • Errors: ${result.errors.length}`);
			lines.push('');

			if (result.warnings.length > 0) {
				lines.push('⚠️ Migration Warnings:');
				result.warnings.forEach((warning) => {
					lines.push(`   • ${warning}`);
				});
				lines.push('');
			}

			if (result.errors.length > 0) {
				lines.push('❌ Migration Errors:');
				result.errors.forEach((error) => {
					lines.push(`   • ${error}`);
				});
				lines.push('');
			}
		}

		// Preservable data
		lines.push('💾 Data Preservation:');
		lines.push(`   • Field Count: ${analysis.preservedData.fieldCount}`);
		lines.push(`   • Static Values: ${Object.keys(analysis.preservedData.staticValues).length}`);
		lines.push(`   • Expressions: ${Object.keys(analysis.preservedData.expressions).length}`);
		lines.push(`   • Preservation Rate: ${analysis.preservedData.preservationRate}%`);
		lines.push('');

		lines.push('═'.repeat(50));

		return lines.join('\n');
	}

	/**
	 * Check if fieldConfigMode parameter exists
	 */
	private hasFieldConfigMode(itemIndex: number): boolean {
		try {
			this.context.getNodeParameter('fieldConfigMode', itemIndex);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get current configuration mode
	 */
	private getConfigurationMode(itemIndex: number): string {
		const pdfSource = this.context.getNodeParameter('pdfSource', itemIndex);

		if (pdfSource === 'url') {
			try {
				const fieldConfigMode = this.context.getNodeParameter('fieldConfigMode', itemIndex);
				return fieldConfigMode === 'manual' ? 'Manual' : 'Enhanced';
			} catch {
				return 'Legacy';
			}
		}

		return 'Enhanced (Runtime)';
	}

	/**
	 * Create migration prompt for user
	 */
	createMigrationPrompt(analysis: IMigrationAnalysis): string {
		if (!analysis.migrationRecommendation.recommended) {
			return '';
		}

		const lines: string[] = [];

		lines.push('🚀 Configuration Migration Available');
		lines.push('');
		lines.push(
			'Your workflow is using a legacy configuration that can be upgraded to the enhanced field extraction system.',
		);
		lines.push('');
		lines.push('Benefits of upgrading:');
		analysis.migrationRecommendation.benefits.forEach((benefit) => {
			lines.push(`  ✅ ${benefit}`);
		});
		lines.push('');
		lines.push(
			`Migration complexity: ${analysis.migrationRecommendation.complexity.toUpperCase()}`,
		);
		lines.push(
			`Your existing ${analysis.preservedData.fieldCount} field mappings will be preserved.`,
		);
		lines.push('');
		lines.push('Would you like to proceed with the migration?');

		return lines.join('\n');
	}
}

// Migration interfaces
export interface IMigrationAnalysis {
	currentConfiguration: {
		pdfSource: string;
		isLegacy: boolean;
		fieldMappingCount: number;
		hasFieldConfigMode: boolean;
		configurationMode: string;
	};
	migrationRecommendation: IMigrationRecommendation;
	migrationSteps: IMigrationStep[];
	preservedData: IPreservableData;
}

export interface IMigrationRecommendation {
	recommended: boolean;
	reason: string;
	benefits: string[];
	risks: string[];
	complexity: 'none' | 'low' | 'medium' | 'high';
}

export interface IMigrationStep {
	step: number;
	title: string;
	description: string;
	action: 'manual' | 'configuration' | 'verification' | 'data_migration' | 'testing' | 'cleanup';
	details: string[];
	automated: boolean;
	risk: 'low' | 'medium' | 'high';
}

export interface IPreservableData {
	fieldCount: number;
	staticValues: Record<string, any>;
	expressions: Record<string, string>;
	fieldTypes: Record<string, string>;
	preservationRate: number;
}

export interface IMigrationResult {
	success: boolean;
	message: string;
	migratedFields: IMigratedField[];
	warnings: string[];
	errors: string[];
}

export interface IMigratedField {
	originalFieldName: string;
	newFieldName: string;
	originalValueSource: 'static' | 'expression';
	newValueSource: 'static' | 'expression';
	originalValue: any;
	newValue: any;
	fieldType: string;
	migrationStatus: 'success' | 'warning' | 'error';
	validationResult: {
		valid: boolean;
		warnings: string[];
	};
}

/**
 * Create a migration utilities instance
 */
export function createMigrationUtilities(context: IExecuteFunctions): MigrationUtilities {
	return new MigrationUtilities(context);
}
