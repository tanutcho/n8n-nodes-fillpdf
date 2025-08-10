import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping } from './types';
import { MigrationUtilities } from './migration-utilities';

/**
 * Backward compatibility manager for Fill PDF node
 * Ensures existing workflows continue to work with new field extraction features
 */
export class BackwardCompatibilityManager {
	private context: IExecuteFunctions;
	private migrationUtilities: MigrationUtilities;

	constructor(context: IExecuteFunctions) {
		this.context = context;
		this.migrationUtilities = new MigrationUtilities(context);
	}

	/**
	 * Detect if this is a legacy workflow configuration
	 */
	isLegacyConfiguration(itemIndex: number = 0): boolean {
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
	getCompatibleFieldMappings(itemIndex: number = 0): { mapping: IFieldMapping[] } {
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
	 * Validate that existing field mapping structure is still supported
	 */
	validateLegacyFieldMappings(fieldMappings: { mapping: IFieldMapping[] }): {
		valid: boolean;
		warnings: string[];
	} {
		const warnings: string[] = [];
		let valid = true;

		if (!fieldMappings || !fieldMappings.mapping || !Array.isArray(fieldMappings.mapping)) {
			return { valid: false, warnings: ['Invalid field mapping structure'] };
		}

		// Validate each mapping for backward compatibility
		fieldMappings.mapping.forEach((mapping, index) => {
			// Check required fields
			if (!mapping.pdfFieldName) {
				valid = false;
				warnings.push(`Field mapping ${index + 1}: PDF field name is required`);
			}

			if (!mapping.valueSource) {
				valid = false;
				warnings.push(`Field mapping ${index + 1}: Value source is required`);
			}

			// Check value source compatibility
			if (mapping.valueSource === 'static') {
				if (
					mapping.staticValue === undefined &&
					mapping.staticValue !== false &&
					mapping.staticValue !== 0
				) {
					warnings.push(
						`Field mapping ${index + 1}: Static value should be provided for static value source`,
					);
				}
			} else if (mapping.valueSource === 'expression') {
				if (!mapping.expression) {
					valid = false;
					warnings.push(
						`Field mapping ${index + 1}: Expression is required for expression value source`,
					);
				}
			} else {
				valid = false;
				warnings.push(
					`Field mapping ${index + 1}: Unsupported value source '${mapping.valueSource}'`,
				);
			}

			// Warn about deprecated patterns
			if (mapping.expression && typeof mapping.expression === 'string') {
				if (mapping.expression.includes('$node[')) {
					warnings.push(
						`Field mapping ${
							index + 1
						}: Consider using $("NodeName").json syntax instead of $node[] for better compatibility`,
					);
				}
			}
		});

		return { valid, warnings };
	}

	/**
	 * Convert legacy field mappings to new format if needed
	 */
	migrateLegacyFieldMappings(fieldMappings: { mapping: IFieldMapping[] }): {
		mapping: IFieldMapping[];
	} {
		// For now, the field mapping structure is compatible
		// This method is a placeholder for future migration needs
		return {
			mapping: fieldMappings.mapping.map((mapping) => ({
				...mapping,
				// Ensure all required fields are present with defaults
				valueSource: mapping.valueSource || 'static',
				staticValue: mapping.staticValue !== undefined ? mapping.staticValue : '',
				expression: mapping.expression || '',
			})),
		};
	}

	/**
	 * Get configuration summary for logging/debugging
	 */
	getConfigurationSummary(itemIndex: number = 0): string {
		try {
			const pdfSource = this.context.getNodeParameter('pdfSource', itemIndex, 'upload');
			const isLegacy = this.isLegacyConfiguration(itemIndex);
			const fieldMappings = this.getCompatibleFieldMappings(itemIndex);

			let configMode = 'Enhanced (Default)';

			if (pdfSource === 'url') {
				try {
					const fieldConfigMode = this.context.getNodeParameter('fieldConfigMode', itemIndex);
					configMode = fieldConfigMode === 'manual' ? 'Manual' : 'Enhanced';
				} catch {
					// fieldConfigMode doesn't exist, determine based on legacy status
					configMode = isLegacy ? 'Legacy (No fieldConfigMode)' : 'Enhanced (Default)';
				}
			}

			return [
				`📊 Configuration Summary:`,
				`   • PDF Source: ${pdfSource}`,
				`   • Configuration Mode: ${configMode}`,
				`   • Legacy Configuration: ${isLegacy ? 'Yes' : 'No'}`,
				`   • Field Mappings: ${fieldMappings.mapping.length}`,
				`   • Backward Compatibility: Active`,
			].join('\n');
		} catch (error) {
			return [
				`📊 Configuration Summary:`,
				`   • Error retrieving configuration details`,
				`   • Backward Compatibility: Active (Safe Mode)`,
			].join('\n');
		}
	}

	/**
	 * Log backward compatibility status
	 */
	logCompatibilityStatus(itemIndex: number = 0): void {
		const isLegacy = this.isLegacyConfiguration(itemIndex);
		const summary = this.getConfigurationSummary(itemIndex);

		if (isLegacy) {
			console.log('\n🔄 Backward Compatibility Mode Active');
			console.log('═'.repeat(50));
			console.log('This workflow uses a legacy configuration that is fully supported.');
			console.log('All existing functionality will work as expected.');
			console.log(summary);
			console.log('💡 Consider migrating to enhanced mode for better field extraction features.');
			console.log('═'.repeat(50));
		} else {
			console.log('\n✨ Enhanced Configuration Mode');
			console.log('═'.repeat(50));
			console.log('This workflow uses the enhanced field extraction system.');
			console.log(summary);
			console.log('═'.repeat(50));
		}
	}

	/**
	 * Check if migration is recommended for this configuration
	 */
	shouldRecommendMigration(itemIndex: number = 0): boolean {
		const isLegacy = this.isLegacyConfiguration(itemIndex);
		const pdfSource = this.context.getNodeParameter('pdfSource', itemIndex);

		// Recommend migration for URL sources using legacy configuration
		return isLegacy && pdfSource === 'url';
	}

	/**
	 * Get migration recommendation message
	 */
	getMigrationRecommendation(itemIndex: number = 0): string | null {
		if (!this.shouldRecommendMigration(itemIndex)) {
			return null;
		}

		const pdfSource = this.context.getNodeParameter('pdfSource', itemIndex);

		if (pdfSource === 'url') {
			return [
				'🚀 Migration Recommendation:',
				'Your workflow uses URL-based PDF source with legacy field mapping.',
				'Consider switching to Enhanced Automatic mode for:',
				'  • Automatic field detection and validation',
				'  • Real-time field type indicators',
				'  • Dropdown option extraction',
				'  • Better error handling and user feedback',
				'',
				'Your existing field mappings will be preserved during migration.',
			].join('\n');
		}

		return null;
	}

	/**
	 * Ensure parameter compatibility across different node versions
	 */
	ensureParameterCompatibility(itemIndex: number = 0): void {
		try {
			// Ensure options parameter exists with defaults
			const options = this.context.getNodeParameter('options', itemIndex, {});

			// Set default values for new options if they don't exist
			const defaultOptions = {
				flattenPdf: true,
				validateFields: true,
				skipMissingFields: false,
				extractionTimeout: 30,
				enableFieldCaching: true,
			};

			// This is mainly for logging - we can't modify parameters at runtime
			const missingOptions = Object.keys(defaultOptions).filter((key) => !(key in options));

			if (missingOptions.length > 0) {
				console.log(`📝 Using default values for new options: ${missingOptions.join(', ')}`);
			}
		} catch (error) {
			// Options parameter might not exist in very old configurations
			console.log('📝 Using default options for legacy configuration');
		}
	}

	/**
	 * Get field mapping validation with backward compatibility considerations
	 */
	validateFieldMappingsWithCompatibility(itemIndex: number = 0): {
		valid: boolean;
		errors: string[];
		warnings: string[];
	} {
		const fieldMappings = this.getCompatibleFieldMappings(itemIndex);
		const validation = this.validateLegacyFieldMappings(fieldMappings);

		const result = {
			valid: validation.valid,
			errors: validation.valid
				? []
				: validation.warnings.filter(
						(w) => w.includes('required') || w.includes('Invalid field mapping structure'),
				  ),
			warnings: validation.warnings.filter(
				(w) => !w.includes('required') && !w.includes('Invalid field mapping structure'),
			),
		};

		// Add compatibility-specific warnings
		if (this.isLegacyConfiguration(itemIndex)) {
			result.warnings.push('Using legacy configuration mode - all functionality is supported');
		}

		const migrationRec = this.getMigrationRecommendation(itemIndex);
		if (migrationRec) {
			result.warnings.push('Migration to enhanced mode is recommended for better features');
		}

		return result;
	}

	/**
	 * Get migration utilities instance
	 */
	getMigrationUtilities(): MigrationUtilities {
		return this.migrationUtilities;
	}

	/**
	 * Analyze configuration for migration potential
	 */
	analyzeMigrationPotential(itemIndex: number = 0) {
		return this.migrationUtilities.analyzeConfiguration(itemIndex);
	}

	/**
	 * Generate migration report
	 */
	generateMigrationReport(itemIndex: number = 0): string {
		const analysis = this.migrationUtilities.analyzeConfiguration(itemIndex);
		return this.migrationUtilities.generateMigrationReport(analysis);
	}

	/**
	 * Create migration prompt for user
	 */
	createMigrationPrompt(itemIndex: number = 0): string {
		const analysis = this.migrationUtilities.analyzeConfiguration(itemIndex);
		return this.migrationUtilities.createMigrationPrompt(analysis);
	}

	/**
	 * Log migration information if applicable
	 */
	logMigrationInformation(itemIndex: number = 0): void {
		const analysis = this.migrationUtilities.analyzeConfiguration(itemIndex);

		if (analysis.migrationRecommendation.recommended) {
			console.log('\n🚀 Migration Opportunity Detected');
			console.log('═'.repeat(50));
			console.log(analysis.migrationRecommendation.reason);
			console.log('\nBenefits of migrating:');
			analysis.migrationRecommendation.benefits.forEach((benefit) => {
				console.log(`  ✅ ${benefit}`);
			});
			console.log(
				`\nMigration complexity: ${analysis.migrationRecommendation.complexity.toUpperCase()}`,
			);
			console.log(
				`Preservable data: ${analysis.preservedData.fieldCount} field mappings (${analysis.preservedData.preservationRate}% preservation rate)`,
			);
			console.log('\n💡 Use the migration utilities to upgrade your configuration.');
			console.log('═'.repeat(50));
		}
	}
}

/**
 * Create a backward compatibility manager instance
 */
export function createBackwardCompatibilityManager(
	context: IExecuteFunctions,
): BackwardCompatibilityManager {
	return new BackwardCompatibilityManager(context);
}
