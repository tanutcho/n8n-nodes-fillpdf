import { IExecuteFunctions } from 'n8n-workflow';
import {
	IFillPdfNodeParams,
	IFieldMapping,
	IFieldInfo,
	IPythonInput,
	IPythonOutput,
	INodeOutputData,
} from './types';
import { PdfInputHandler } from './pdf-input-handler';
import { FieldMapper } from './field-mapper';
import { FieldInspector } from './field-inspector';
import { PythonBridge } from './python-bridge';
import { OutputHandler } from './output-handler';
import { ValidationUtils } from './validation';
import { BackwardCompatibilityManager } from './backward-compatibility';
import {
	FillPdfError,
	FillPdfDataError,
	FillPdfRuntimeError,
	FillPdfValidationError,
	ErrorUtils,
} from './errors';

/**
 * Main PDF processing workflow coordinator
 * Integrates all components to handle PDF filling operations
 */
export class PdfProcessor {
	private context: IExecuteFunctions;
	private itemIndex: number;
	private pythonBridge: PythonBridge;
	private compatibilityManager?: BackwardCompatibilityManager;

	constructor(
		context: IExecuteFunctions,
		itemIndex: number,
		compatibilityManager?: BackwardCompatibilityManager,
	) {
		this.context = context;
		this.itemIndex = itemIndex;
		this.pythonBridge = new PythonBridge();
		this.compatibilityManager = compatibilityManager || new BackwardCompatibilityManager(context);
	}

	/**
	 * Main processing workflow
	 */
	async processPdf(): Promise<INodeOutputData> {
		const startTime = Date.now();

		try {
			// Step 0: Perform item-level validation
			const validator = new ValidationUtils(this.context, this.itemIndex);
			const inputValidation = validator.validateInputData();
			if (!inputValidation.isValid) {
				throw new FillPdfValidationError(
					this.context.getNode(),
					`Input validation failed: ${inputValidation.errors.join(', ')}`,
					{
						component: 'PDF Processor',
						operation: 'processPdf',
						itemIndex: this.itemIndex,
					},
				);
			}

			// Step 1: Get node parameters
			const params = this.getNodeParameters();

			// Step 2: Handle PDF input
			const pdfData = await this.handlePdfInput();

			// Step 3: Inspect PDF fields if validation is enabled
			const pdfFields = await this.inspectPdfFields(pdfData, params);

			// Step 4: Map workflow data to PDF fields
			const fieldValues = await this.mapFieldValues(params.fieldMappings, pdfFields);

			// Step 5: Fill PDF using Python bridge
			const filledPdfData = await this.fillPdf(pdfData, fieldValues, params);

			// Step 6: Handle output formatting with field extraction metadata
			const outputData = await this.formatOutput(filledPdfData, params, startTime, pdfFields);

			return outputData;
		} catch (error) {
			// Enhanced error handling with context
			if (error instanceof FillPdfError) {
				throw error;
			}

			throw ErrorUtils.wrapError(
				this.context.getNode(),
				error instanceof Error ? error : new Error('Unknown PDF processing error'),
				'runtime',
				{
					component: 'PDF Processor',
					operation: 'processPdf',
					itemIndex: this.itemIndex,
				},
			);
		}
	}

	/**
	 * Get and validate node parameters
	 */
	private getNodeParameters(): IFillPdfNodeParams {
		const pdfSource = this.context.getNodeParameter('pdfSource', this.itemIndex) as
			| 'upload'
			| 'url'
			| 'binary';
		const fieldMappings = this.compatibilityManager!.getCompatibleFieldMappings(this.itemIndex);
		const outputFormat = this.context.getNodeParameter('outputFormat', this.itemIndex) as
			| 'binary'
			| 'file'
			| 'both';
		const options = this.context.getNodeParameter('options', this.itemIndex, {}) as any;

		// Get source-specific parameters
		let pdfFile: string | undefined;
		let pdfUrl: string | undefined;
		let binaryPropertyName: string | undefined;
		let outputPath: string | undefined;

		switch (pdfSource) {
			case 'upload':
				pdfFile = this.context.getNodeParameter('pdfFile', this.itemIndex) as string;
				break;
			case 'url':
				pdfUrl = this.context.getNodeParameter('pdfUrl', this.itemIndex) as string;
				break;
			case 'binary':
				binaryPropertyName = this.context.getNodeParameter(
					'binaryPropertyName',
					this.itemIndex,
				) as string;
				break;
		}

		if (outputFormat === 'file' || outputFormat === 'both') {
			outputPath = this.context.getNodeParameter('outputPath', this.itemIndex) as string;
		}

		return {
			pdfSource,
			pdfFile,
			pdfUrl,
			binaryPropertyName,
			fieldMappings,
			outputFormat,
			outputPath,
			options: {
				flattenPdf: options.flattenPdf ?? true,
				validateFields: options.validateFields ?? true,
				skipMissingFields: options.skipMissingFields ?? false,
			},
		};
	}

	/**
	 * Handle PDF input using PdfInputHandler
	 */
	private async handlePdfInput(): Promise<string> {
		const pdfInputHandler = new PdfInputHandler(this.context, this.itemIndex);
		return await pdfInputHandler.getPdfData();
	}

	/**
	 * Inspect PDF fields with runtime extraction and logging
	 */
	private async inspectPdfFields(pdfData: string, params: IFillPdfNodeParams) {
		try {
			const fieldInspector = new FieldInspector();

			// For upload and binary sources, extract and log fields for user reference (only if validation is enabled)
			if (
				(params.pdfSource === 'upload' || params.pdfSource === 'binary') &&
				params.options.validateFields
			) {
				console.log(`\n🔍 Extracting PDF fields from ${params.pdfSource} source...`);

				try {
					// Use the standard inspectPdfFields method but add enhanced logging
					const fields = await fieldInspector.inspectPdfFields(pdfData);

					// Add enhanced logging for runtime field extraction
					this.logRuntimeFieldExtraction(fields, params.pdfSource);

					// Perform runtime field validation if enabled
					if (fields && fields.length > 0) {
						await this.performRuntimeFieldValidation(fields, params, fieldInspector);
					}

					// Return fields for validation
					return fields;
				} catch (extractionError) {
					// For upload/binary sources, log the error but don't fail the workflow unless validation is strictly required
					console.error(
						`⚠️  Field extraction failed for ${params.pdfSource} source:`,
						extractionError instanceof Error ? extractionError.message : 'Unknown error',
					);
					console.log(
						'💡 Proceeding with manual field mapping. You can still fill the PDF using configured field mappings.\n',
					);

					// If validation is enabled and extraction fails, we should still throw for consistency
					throw extractionError;
				}
			}

			// For URL sources, only inspect if validation is enabled
			if (!params.options.validateFields) {
				return [];
			}

			const fields = await fieldInspector.inspectPdfFields(pdfData);
			console.log(`Detected ${fields.length} PDF fields for validation`);
			return fields;
		} catch (error) {
			// Throw error for all sources when validation is enabled or for URL sources
			throw new FillPdfDataError(
				this.context.getNode(),
				`Failed to inspect PDF fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{
					component: 'PDF Processor',
					operation: 'inspectPdfFields',
					itemIndex: this.itemIndex,
					originalError: error instanceof Error ? error : undefined,
				},
				{
					dataType: 'PDF',
					expectedFormat: 'Valid PDF with fillable fields',
					troubleshootingHints: [
						{
							issue: 'PDF field inspection failed',
							solution: 'Verify the PDF file is valid and contains fillable form fields',
							priority: 'high',
						},
					],
				},
			);
		}
	}

	/**
	 * Log runtime field extraction results with enhanced formatting
	 */
	private logRuntimeFieldExtraction(fields: IFieldInfo[] | undefined, pdfSource: string): void {
		// const extractionTime = Date.now(); // Placeholder for timing

		if (!fields || fields.length === 0) {
			console.log(`\n📄 PDF Field Extraction Complete`);
			console.log('='.repeat(60));
			console.log('⚠️  No fillable fields found in this PDF');
			console.log('💡 This PDF may not contain form fields, or they may not be detectable');
			console.log('   You can still use manual field mapping if needed');
			console.log(`${'='.repeat(60)}\n`);
			return;
		}

		// Header with extraction summary
		console.log(`\n📋 PDF Field Extraction Complete`);
		console.log('='.repeat(60));
		console.log(
			`✅ Found ${fields.length} fillable field${
				fields.length === 1 ? '' : 's'
			} in ${pdfSource} PDF`,
		);
		console.log('');

		// Group fields by type for better organization
		const fieldsByType = this.groupFieldsByType(fields);

		// Display fields organized by type
		Object.entries(fieldsByType).forEach(([type, typeFields]) => {
			const typeIcon = this.getFieldTypeIcon(type);
			const typeName = this.getFieldTypeName(type);

			console.log(`${typeIcon} ${typeName} Fields (${typeFields.length}):`);

			typeFields.forEach((field, index) => {
				const requiredText = field.required ? ' ⚠️ Required' : '';
				const optionsText =
					field.options && field.options.length > 0
						? ` [${field.options.length} options: ${field.options.slice(0, 3).join(', ')}${
								field.options.length > 3 ? '...' : ''
						  }]`
						: '';
				const maxLengthText = field.maxLength ? ` (max: ${field.maxLength} chars)` : '';
				const defaultText = field.defaultValue ? ` (default: "${field.defaultValue}")` : '';

				console.log(
					`   ${index + 1}. ${
						field.name
					}${requiredText}${optionsText}${maxLengthText}${defaultText}`,
				);
			});
			console.log('');
		});

		// Field validation summary
		this.logFieldValidationSummary(fields);

		console.log(`${'='.repeat(60)}\n`);
	}

	/**
	 * Group fields by type for organized display
	 */
	private groupFieldsByType(fields: IFieldInfo[]): Record<string, IFieldInfo[]> {
		const grouped: Record<string, IFieldInfo[]> = {};

		fields.forEach((field) => {
			if (!grouped[field.type]) {
				grouped[field.type] = [];
			}
			grouped[field.type].push(field);
		});

		// Sort groups by priority (required fields first, then by type)
		const typeOrder = ['checkbox', 'radio', 'dropdown', 'text'];
		const sortedGrouped: Record<string, IFieldInfo[]> = {};

		typeOrder.forEach((type) => {
			if (grouped[type]) {
				// Sort fields within type (required first, then alphabetically)
				sortedGrouped[type] = grouped[type].sort((a, b) => {
					if (a.required !== b.required) {
						return a.required ? -1 : 1;
					}
					return a.name.localeCompare(b.name);
				});
			}
		});

		// Add any remaining types not in the order
		Object.keys(grouped).forEach((type) => {
			if (!sortedGrouped[type]) {
				sortedGrouped[type] = grouped[type];
			}
		});

		return sortedGrouped;
	}

	/**
	 * Get human-readable field type name
	 */
	private getFieldTypeName(type: string): string {
		switch (type) {
			case 'checkbox':
				return 'Checkbox';
			case 'radio':
				return 'Radio Button';
			case 'dropdown':
				return 'Dropdown';
			case 'text':
				return 'Text';
			default:
				return 'Other';
		}
	}

	/**
	 * Log field validation summary against configured mappings
	 */
	private logFieldValidationSummary(fields: IFieldInfo[]): void {
		try {
			const fieldMappings = this.compatibilityManager!.getCompatibleFieldMappings(this.itemIndex);
			const mappings = fieldMappings.mapping || [];

			if (mappings.length === 0) {
				console.log('💡 Field Mapping Guidance:');
				console.log('   No field mappings configured yet. Use the field names above in your');
				console.log('   field mapping configuration to fill these PDF fields with data.');
				return;
			}

			// Validate mappings against extracted fields
			const fieldNames = new Set(fields.map((f) => f.name));
			const validMappings: string[] = [];
			const invalidMappings: string[] = [];
			const missingRequiredFields: string[] = [];

			mappings.forEach((mapping) => {
				if (mapping.pdfFieldName && fieldNames.has(mapping.pdfFieldName)) {
					validMappings.push(mapping.pdfFieldName);
				} else if (mapping.pdfFieldName) {
					invalidMappings.push(mapping.pdfFieldName);
				}
			});

			// Check for required fields without mappings
			fields.forEach((field) => {
				if (field.required && !validMappings.includes(field.name)) {
					missingRequiredFields.push(field.name);
				}
			});

			// Display validation results
			console.log('🔍 Field Mapping Validation:');

			if (validMappings.length > 0) {
				console.log(
					`   ✅ ${validMappings.length} valid mapping${
						validMappings.length === 1 ? '' : 's'
					}: ${validMappings.join(', ')}`,
				);
			}

			if (invalidMappings.length > 0) {
				console.log(
					`   ❌ ${invalidMappings.length} invalid mapping${
						invalidMappings.length === 1 ? '' : 's'
					}: ${invalidMappings.join(', ')}`,
				);
				console.log('      These fields do not exist in the PDF and will be skipped');
			}

			if (missingRequiredFields.length > 0) {
				console.log(
					`   ⚠️  ${missingRequiredFields.length} required field${
						missingRequiredFields.length === 1 ? '' : 's'
					} without mapping${
						missingRequiredFields.length === 1 ? '' : 's'
					}: ${missingRequiredFields.join(', ')}`,
				);
				console.log('      Consider adding mappings for these required fields');
			}

			// Summary statistics
			const mappingCoverage = Math.round((validMappings.length / fields.length) * 100);
			console.log(
				`   📊 Mapping coverage: ${mappingCoverage}% (${validMappings.length}/${fields.length} fields)`,
			);
		} catch (error) {
			// Don't fail if validation summary fails
			console.log('💡 Use the extracted field names above in your field mapping configuration');
		}
	}

	/**
	 * Perform runtime field validation against configured mappings
	 */
	private async performRuntimeFieldValidation(
		fields: IFieldInfo[],
		params: IFillPdfNodeParams,
		fieldInspector: FieldInspector,
	): Promise<void> {
		try {
			const mappings = params.fieldMappings.mapping || [];

			if (mappings.length === 0) {
				console.log(
					'💡 No field mappings configured - extracted fields are available for reference',
				);
				return;
			}

			// Validate mappings against extracted fields
			const validationResult = await fieldInspector.validateFieldMappingsAtRuntime(
				fields,
				mappings,
				this.context,
				this.itemIndex,
			);

			// Log validation summary
			console.log(`\n🔍 Runtime Field Validation:`);
			console.log(`   ${validationResult.validationSummary}`);

			// Handle validation issues based on configuration
			if (validationResult.invalidMappings.length > 0) {
				const skipMissing = params.options.skipMissingFields ?? false;

				if (!skipMissing) {
					console.warn(
						`   ⚠️  Invalid field mappings detected but will be processed according to skipMissingFields setting`,
					);
				} else {
					console.log(`   ✅ Invalid field mappings will be skipped as configured`);
				}
			}

			// Warn about missing required fields
			if (validationResult.missingRequiredFields.length > 0) {
				console.warn(
					`   ⚠️  Required fields without mappings: ${validationResult.missingRequiredFields.join(
						', ',
					)}`,
				);
				console.warn(`      These fields will remain empty in the filled PDF`);
			}
		} catch (error) {
			// Don't fail the workflow if validation fails
			console.warn(
				`⚠️  Runtime field validation failed: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
			);
			console.log('💡 Proceeding with configured field mappings');
		}
	}

	/**
	 * Map workflow data to PDF field values with comprehensive validation
	 */
	private async mapFieldValues(fieldMappings: { mapping: IFieldMapping[] }, pdfFields: any[]) {
		if (!fieldMappings.mapping || fieldMappings.mapping.length === 0) {
			console.log('No field mappings configured, returning empty values');
			return {};
		}

		try {
			console.log('\n🔍 Starting Field Value Mapping and Validation...');
			console.log('═'.repeat(60));

			const fieldMapper = new FieldMapper(this.context, this.itemIndex);
			const mappedValues = await fieldMapper.mapFieldsToValues(fieldMappings.mapping, pdfFields);

			// Handle case where mappedValues might be null/undefined
			const valueCount = mappedValues ? Object.keys(mappedValues).length : 0;
			console.log(`✅ Successfully mapped and validated ${valueCount} field values`);
			console.log(`${'═'.repeat(60)}\n`);

			return mappedValues || {};
		} catch (error) {
			// Enhanced error handling with field validation context
			let errorMessage = 'Field mapping failed';
			const troubleshootingHints = [
				{
					issue: 'Field mapping validation failed',
					solution: 'Check your field mappings and ensure input data matches expected types',
					priority: 'high' as const,
				},
			];

			if (error && typeof error === 'object' && 'message' in error) {
				errorMessage = error.message as string;

				// Add specific troubleshooting hints based on error type
				if (errorMessage.includes('required')) {
					troubleshootingHints.push({
						issue: 'Required field validation failed',
						solution:
							'Ensure all required PDF fields have values configured in your field mappings',
						priority: 'high' as const,
					});
				}

				if (errorMessage.includes('length') || errorMessage.includes('characters')) {
					troubleshootingHints.push({
						issue: 'Field length validation failed',
						solution:
							'Check that text field values do not exceed the maximum length allowed by the PDF',
						priority: 'high' as const,
					});
				}

				if (errorMessage.includes('options') || errorMessage.includes('Available options')) {
					troubleshootingHints.push({
						issue: 'Field option validation failed',
						solution:
							'Ensure dropdown and radio button values match the exact options available in the PDF',
						priority: 'high' as const,
					});
				}

				if (errorMessage.includes('expression')) {
					troubleshootingHints.push({
						issue: 'Expression evaluation failed',
						solution:
							'Check your n8n expressions for syntax errors and ensure referenced data exists',
						priority: 'high' as const,
					});
				}
			}

			throw new FillPdfValidationError(
				this.context.getNode(),
				errorMessage,
				{
					component: 'PDF Processor',
					operation: 'mapFieldValues',
					itemIndex: this.itemIndex,
					originalError: error instanceof Error ? error : undefined,
				},
				{
					troubleshootingHints,
				},
			);
		}
	}

	/**
	 * Fill PDF using Python bridge
	 */
	private async fillPdf(
		pdfData: string,
		fieldValues: Record<string, any>,
		params: IFillPdfNodeParams,
	): Promise<string> {
		try {
			// Prepare Python input
			const pythonInput: IPythonInput = {
				action: 'fill',
				pdfData,
				fieldMappings: fieldValues,
				options: {
					flatten: params.options.flattenPdf ?? true,
					outputFormat: 'base64',
				},
			};

			// Execute Python script
			const pythonOutput: IPythonOutput = await this.pythonBridge.executePythonScript(pythonInput);

			// Check for Python execution errors
			if (!pythonOutput) {
				throw new Error('Python script execution returned no result');
			}

			if (!pythonOutput.success) {
				throw new Error(pythonOutput.error || 'Python script execution failed');
			}

			if (!pythonOutput.data) {
				throw new Error('Python script returned no PDF data');
			}

			console.log(`PDF filled successfully with ${Object.keys(fieldValues).length} fields`);
			return pythonOutput.data;
		} catch (error) {
			// If it's already a FillPdf error from Python bridge, re-throw it
			if (error instanceof FillPdfError) {
				throw error;
			}

			throw new FillPdfRuntimeError(
				this.context.getNode(),
				`PDF filling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{
					component: 'PDF Processor',
					operation: 'fillPdf',
					itemIndex: this.itemIndex,
					originalError: error instanceof Error ? error : undefined,
				},
				{
					troubleshootingHints: [
						{
							issue: 'PDF filling operation failed',
							solution: 'Check your Python environment and fillpdf library installation',
							priority: 'high',
						},
					],
				},
			);
		}
	}

	/**
	 * Format output data based on configuration using OutputHandler
	 */
	private async formatOutput(
		filledPdfData: string,
		params: IFillPdfNodeParams,
		startTime: number,
		extractedFields?: IFieldInfo[],
	): Promise<INodeOutputData> {
		const processingTime = Date.now() - startTime;
		const fieldsProcessed = Object.keys(params.fieldMappings.mapping || []).length;

		// Create enhanced metadata including field extraction information
		const metadata = {
			originalFieldCount: extractedFields?.length || fieldsProcessed,
			filledFieldCount: fieldsProcessed,
			processingTime,

			// Add field extraction metadata
			fieldExtraction: {
				extractedFieldCount: extractedFields?.length || 0,
				extractionPerformed: !!extractedFields,
				pdfSource: params.pdfSource,
				fieldTypes: extractedFields ? this.getFieldTypesSummary(extractedFields) : undefined,
				requiredFields: extractedFields ? extractedFields.filter((f) => f.required).length : 0,
				optionalFields: extractedFields ? extractedFields.filter((f) => !f.required).length : 0,
			},
		};

		// Use OutputHandler to format the output
		const outputHandler = new OutputHandler(this.context, this.itemIndex);
		return await outputHandler.formatOutput(filledPdfData, params, metadata);
	}

	/**
	 * Generate field types summary for metadata
	 */
	private getFieldTypesSummary(fields: IFieldInfo[]): Record<string, number> {
		const summary: Record<string, number> = {};

		fields.forEach((field) => {
			summary[field.type] = (summary[field.type] || 0) + 1;
		});

		return summary;
	}

	/**
	 * Get processing metadata for debugging
	 */
	async getProcessingMetadata(): Promise<{
		pdfSource: string;
		fieldMappingCount: number;
		pythonValidation: any;
	}> {
		const params = this.getNodeParameters();
		const pythonValidation = await this.pythonBridge.validateEnvironment();

		return {
			pdfSource: params.pdfSource,
			fieldMappingCount: params.fieldMappings.mapping?.length || 0,
			pythonValidation: {
				isValid: pythonValidation.isValid,
				pythonExecutable: pythonValidation.pythonExecutable,
				fillpdfVersion: pythonValidation.fillpdfVersion,
			},
		};
	}

	/**
	 * Set custom Python executable
	 */
	setPythonExecutable(executable: string): void {
		this.pythonBridge.setPythonExecutable(executable);
	}

	/**
	 * Get current Python bridge instance
	 */
	getPythonBridge(): PythonBridge {
		return this.pythonBridge;
	}

	/**
	 * Extract PDF fields for runtime analysis and logging
	 * This method provides field extraction capabilities for upload/binary sources
	 */
	async extractPdfFieldsAtRuntime(pdfData: string): Promise<IFieldInfo[]> {
		try {
			const fieldInspector = new FieldInspector();
			const fields = await fieldInspector.extractAndLogFields(
				this.context,
				this.itemIndex,
				pdfData,
			);

			console.log(`\n📊 Field Extraction Summary:`);
			console.log(`   Total fields found: ${fields.length}`);
			console.log(`   Required fields: ${fields.filter((f) => f.required).length}`);
			console.log(`   Optional fields: ${fields.filter((f) => !f.required).length}`);

			// Log field type distribution
			const typeDistribution = this.getFieldTypesSummary(fields);
			if (Object.keys(typeDistribution).length > 0) {
				console.log(
					`   Field types: ${Object.entries(typeDistribution)
						.map(([type, count]) => `${type}(${count})`)
						.join(', ')}`,
				);
			}

			return fields;
		} catch (error) {
			console.error(
				`❌ Runtime field extraction failed: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
			);
			return [];
		}
	}

	/**
	 * Log field extraction results to workflow execution output
	 */
	logFieldExtractionToOutput(fields: IFieldInfo[], params: IFillPdfNodeParams): void {
		if (fields.length === 0) {
			console.log(`\n📄 No fillable fields detected in ${params.pdfSource} PDF`);
			return;
		}

		console.log(`\n📋 Extracted ${fields.length} PDF fields from ${params.pdfSource} source:`);
		console.log('─'.repeat(50));

		// Group and display fields by type
		const fieldsByType = fields.reduce((acc, field) => {
			if (!acc[field.type]) acc[field.type] = [];
			acc[field.type].push(field);
			return acc;
		}, {} as Record<string, IFieldInfo[]>);

		Object.entries(fieldsByType).forEach(([type, typeFields]) => {
			const typeIcon = this.getFieldTypeIcon(type);
			console.log(`${typeIcon} ${type.toUpperCase()} (${typeFields.length}):`);

			typeFields.forEach((field, index) => {
				const requiredText = field.required ? ' [Required]' : '';
				const optionsText = field.options?.length ? ` (${field.options.length} options)` : '';
				console.log(`   ${index + 1}. ${field.name}${requiredText}${optionsText}`);
			});
			console.log('');
		});

		console.log('💡 Use these field names in your field mappings to fill the PDF');
		console.log(`${'─'.repeat(50)}\n`);
	}

	/**
	 * Get field type icon for display
	 */
	private getFieldTypeIcon(type: string): string {
		switch (type) {
			case 'checkbox':
				return '☑️';
			case 'radio':
				return '🔘';
			case 'dropdown':
				return '📋';
			case 'text':
				return '📝';
			default:
				return '❓';
		}
	}

	/**
	 * Create field extraction metadata for output
	 */
	createFieldExtractionMetadata(fields: IFieldInfo[], params: IFillPdfNodeParams) {
		return {
			extractedFields: fields.map((field) => ({
				name: field.name,
				type: field.type,
				required: field.required,
				hasOptions: !!field.options?.length,
				optionCount: field.options?.length || 0,
				maxLength: field.maxLength,
				defaultValue: field.defaultValue,
			})),
			summary: {
				totalFields: fields.length,
				requiredFields: fields.filter((f) => f.required).length,
				optionalFields: fields.filter((f) => !f.required).length,
				fieldTypes: this.getFieldTypesSummary(fields),
				extractionSource: params.pdfSource,
				extractionTimestamp: new Date().toISOString(),
			},
		};
	}

	/**
	 * Get PDF data for batch processing
	 */
	async getPdfData(): Promise<string> {
		return await this.handlePdfInput();
	}
}

/**
 * Utility function to create PDF processor instance
 */
export function createPdfProcessor(context: IExecuteFunctions, itemIndex: number): PdfProcessor {
	return new PdfProcessor(context, itemIndex);
}
