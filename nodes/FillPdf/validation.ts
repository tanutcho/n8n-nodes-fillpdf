import { IExecuteFunctions, INode } from 'n8n-workflow';
import { IFieldMapping } from './types';
import { IErrorContext } from './errors';
import { existsSync, accessSync, constants } from 'fs';
import { dirname } from 'path';

/**
 * Validation result interface
 */
export interface IValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	context?: IErrorContext;
}

/**
 * Safety check result interface
 */
export interface ISafetyCheckResult {
	isSafe: boolean;
	risks: string[];
	recommendations: string[];
}

/**
 * Comprehensive validation and safety check utilities
 */
export class ValidationUtils {
	private context: IExecuteFunctions;
	// private node: INode; // Available if needed for error context
	private itemIndex: number;

	constructor(context: IExecuteFunctions, itemIndex: number = 0) {
		this.context = context;
		// this.node = context.getNode(); // Available if needed for error context
		this.itemIndex = itemIndex;
	}

	/**
	 * Validate all node parameters comprehensively
	 */
	async validateNodeParameters(): Promise<IValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			// Get all parameters
			const pdfSource = this.context.getNodeParameter('pdfSource', this.itemIndex) as string;
			const fieldMappings = this.context.getNodeParameter('fieldMappings', this.itemIndex) as {
				mapping: IFieldMapping[];
			};
			const outputFormat = this.context.getNodeParameter('outputFormat', this.itemIndex) as string;
			const options = this.context.getNodeParameter('options', this.itemIndex, {}) as any;

			// Validate PDF source
			const pdfSourceValidation = this.validatePdfSource(pdfSource);
			errors.push(...pdfSourceValidation.errors);
			warnings.push(...pdfSourceValidation.warnings);

			// Validate field mappings
			const fieldMappingValidation = this.validateFieldMappings(fieldMappings);
			errors.push(...fieldMappingValidation.errors);
			warnings.push(...fieldMappingValidation.warnings);

			// Validate output format
			const outputValidation = this.validateOutputFormat(outputFormat);
			errors.push(...outputValidation.errors);
			warnings.push(...outputValidation.warnings);

			// Validate options
			const optionsValidation = this.validateOptions(options);
			errors.push(...optionsValidation.errors);
			warnings.push(...optionsValidation.warnings);

			return {
				isValid: errors.length === 0,
				errors,
				warnings,
				context: {
					component: 'Parameter Validation',
					operation: 'validateNodeParameters',
					itemIndex: this.itemIndex,
				},
			};
		} catch (error) {
			return {
				isValid: false,
				errors: [
					`Parameter validation failed: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`,
				],
				warnings: [],
				context: {
					component: 'Parameter Validation',
					operation: 'validateNodeParameters',
					itemIndex: this.itemIndex,
					originalError: error instanceof Error ? error : undefined,
				},
			};
		}
	}

	/**
	 * Validate PDF source configuration
	 */
	private validatePdfSource(pdfSource: string): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check if PDF source is valid
		const validSources = ['upload', 'url', 'binary'];
		if (!validSources.includes(pdfSource)) {
			errors.push(`Invalid PDF source: ${pdfSource}. Must be one of: ${validSources.join(', ')}`);
		}

		// Validate source-specific parameters
		try {
			switch (pdfSource) {
				case 'upload':
					const pdfFile = this.context.getNodeParameter('pdfFile', this.itemIndex) as string;
					if (!pdfFile || pdfFile.trim() === '') {
						errors.push('PDF file is required when using upload source');
					} else if (!pdfFile.toLowerCase().endsWith('.pdf')) {
						warnings.push('PDF file should have .pdf extension');
					}
					break;

				case 'url':
					const pdfUrl = this.context.getNodeParameter('pdfUrl', this.itemIndex) as string;
					if (!pdfUrl || pdfUrl.trim() === '') {
						errors.push('PDF URL is required when using URL source');
					} else {
						const urlValidation = this.validateUrl(pdfUrl);
						errors.push(...urlValidation.errors);
						warnings.push(...urlValidation.warnings);
					}
					break;

				case 'binary':
					const binaryPropertyName = this.context.getNodeParameter(
						'binaryPropertyName',
						this.itemIndex,
					) as string;
					if (!binaryPropertyName || binaryPropertyName.trim() === '') {
						errors.push('Binary property name is required when using binary source');
					} else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(binaryPropertyName)) {
						errors.push('Binary property name must be a valid identifier');
					}
					break;
			}
		} catch (error) {
			errors.push(
				`Failed to validate PDF source parameters: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
			);
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate URL format and accessibility
	 */
	private validateUrl(url: string): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			const urlObj = new URL(url);

			// Check protocol
			if (!['http:', 'https:'].includes(urlObj.protocol)) {
				errors.push('URL must use HTTP or HTTPS protocol');
			}

			// Check if it looks like a PDF URL
			if (!url.toLowerCase().includes('.pdf')) {
				warnings.push('URL does not appear to point to a PDF file');
			}

			// Basic security checks
			if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
				warnings.push('Using localhost URLs may not work in all environments');
			}
		} catch (error) {
			errors.push('Invalid URL format');
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate field mappings configuration
	 */
	private validateFieldMappings(fieldMappings: { mapping: IFieldMapping[] }): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!fieldMappings?.mapping) {
			warnings.push('No field mappings configured - PDF will not be filled');
			return { isValid: true, errors, warnings };
		}

		const mappings = fieldMappings.mapping;
		if (!Array.isArray(mappings)) {
			errors.push('Field mappings must be an array');
			return { isValid: false, errors, warnings };
		}

		if (mappings.length === 0) {
			warnings.push('No field mappings configured - PDF will not be filled');
			return { isValid: true, errors, warnings };
		}

		// Validate each mapping
		const fieldNames = new Set<string>();
		mappings.forEach((mapping, index) => {
			const mappingValidation = this.validateSingleFieldMapping(mapping, index);
			errors.push(...mappingValidation.errors);
			warnings.push(...mappingValidation.warnings);

			// Check for duplicate field names
			if (mapping.pdfFieldName) {
				if (fieldNames.has(mapping.pdfFieldName)) {
					warnings.push(
						`Duplicate field mapping for "${mapping.pdfFieldName}" - only the last mapping will be used`,
					);
				}
				fieldNames.add(mapping.pdfFieldName);
			}
		});

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate a single field mapping
	 */
	private validateSingleFieldMapping(mapping: IFieldMapping, index: number): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check required fields
		if (!mapping.pdfFieldName || mapping.pdfFieldName.trim() === '') {
			errors.push(`Field mapping ${index + 1}: PDF field name is required`);
		}

		if (!mapping.valueSource) {
			errors.push(`Field mapping ${index + 1}: Value source is required`);
		} else if (!['static', 'expression'].includes(mapping.valueSource)) {
			errors.push(`Field mapping ${index + 1}: Value source must be 'static' or 'expression'`);
		}

		// Validate based on value source
		if (mapping.valueSource === 'static') {
			if (mapping.staticValue === undefined || mapping.staticValue === null) {
				warnings.push(`Field mapping ${index + 1}: Static value is empty`);
			} else if (typeof mapping.staticValue === 'string' && mapping.staticValue.length > 10000) {
				warnings.push(
					`Field mapping ${index + 1}: Static value is very long (${
						mapping.staticValue.length
					} characters)`,
				);
			}
		} else if (mapping.valueSource === 'expression') {
			if (!mapping.expression || mapping.expression.trim() === '') {
				errors.push(
					`Field mapping ${index + 1}: Expression is required when using expression value source`,
				);
			} else {
				const expressionValidation = this.validateExpression(mapping.expression, index);
				errors.push(...expressionValidation.errors);
				warnings.push(...expressionValidation.warnings);
			}
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate n8n expression syntax
	 */
	private validateExpression(expression: string, mappingIndex: number): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic expression format checks
		if (!expression.includes('{{') || !expression.includes('}}')) {
			warnings.push(`Field mapping ${mappingIndex + 1}: Expression should be wrapped in {{ }}`);
		}

		// Check for common expression patterns
		if (expression.includes('$json') && !expression.includes('$json[')) {
			warnings.push(
				`Field mapping ${
					mappingIndex + 1
				}: $json expressions should specify a property like $json["propertyName"]`,
			);
		}

		// Check for potentially unsafe expressions
		if (expression.includes('eval(') || expression.includes('Function(')) {
			errors.push(
				`Field mapping ${
					mappingIndex + 1
				}: Unsafe expression detected - eval() and Function() are not allowed`,
			);
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate output format configuration
	 */
	private validateOutputFormat(outputFormat: string): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		const validFormats = ['binary', 'file', 'both'];
		if (!validFormats.includes(outputFormat)) {
			errors.push(
				`Invalid output format: ${outputFormat}. Must be one of: ${validFormats.join(', ')}`,
			);
		}

		// Validate output path if file output is selected
		if (outputFormat === 'file' || outputFormat === 'both') {
			try {
				const outputPath = this.context.getNodeParameter('outputPath', this.itemIndex) as string;
				const pathValidation = this.validateOutputPath(outputPath);
				errors.push(...pathValidation.errors);
				warnings.push(...pathValidation.warnings);
			} catch (error) {
				errors.push('Output path is required when using file output format');
			}
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate output path
	 */
	private validateOutputPath(outputPath: string): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!outputPath || outputPath.trim() === '') {
			errors.push('Output path is required');
			return { isValid: false, errors, warnings };
		}

		// Check file extension
		if (!outputPath.toLowerCase().endsWith('.pdf')) {
			errors.push('Output path must end with .pdf extension');
		}

		// Check if directory exists and is writable
		try {
			const dir = dirname(outputPath);
			if (!existsSync(dir)) {
				warnings.push(`Output directory does not exist: ${dir}`);
			} else {
				try {
					accessSync(dir, constants.W_OK);
				} catch {
					warnings.push(`Output directory may not be writable: ${dir}`);
				}
			}
		} catch (error) {
			warnings.push('Could not validate output directory permissions');
		}

		// Check for potentially unsafe paths
		if (outputPath.includes('..') || outputPath.includes('~')) {
			warnings.push('Output path contains potentially unsafe characters');
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate options configuration
	 */
	private validateOptions(options: any): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!options || typeof options !== 'object') {
			return { isValid: true, errors, warnings }; // Options are optional
		}

		// Validate boolean options
		const booleanOptions = ['flattenPdf', 'validateFields', 'skipMissingFields'];
		booleanOptions.forEach((option) => {
			if (options[option] !== undefined && typeof options[option] !== 'boolean') {
				errors.push(`Option "${option}" must be a boolean value`);
			}
		});

		// Logical validation
		if (options.validateFields === false && options.skipMissingFields === true) {
			warnings.push('Skip missing fields option has no effect when field validation is disabled');
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Perform safety checks for file operations and Python execution
	 */
	async performSafetyChecks(): Promise<ISafetyCheckResult> {
		const risks: string[] = [];
		const recommendations: string[] = [];

		try {
			// Check system resources
			const memoryCheck = this.checkMemoryUsage();
			risks.push(...memoryCheck.risks);
			recommendations.push(...memoryCheck.recommendations);

			// Check file system permissions
			const fileSystemCheck = await this.checkFileSystemSafety();
			risks.push(...fileSystemCheck.risks);
			recommendations.push(...fileSystemCheck.recommendations);

			// Check Python execution safety
			const pythonCheck = this.checkPythonExecutionSafety();
			risks.push(...pythonCheck.risks);
			recommendations.push(...pythonCheck.recommendations);

			return {
				isSafe: risks.length === 0,
				risks,
				recommendations,
			};
		} catch (error) {
			return {
				isSafe: false,
				risks: [`Safety check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
				recommendations: ['Review system configuration and permissions'],
			};
		}
	}

	/**
	 * Check memory usage and system resources
	 */
	private checkMemoryUsage(): ISafetyCheckResult {
		const risks: string[] = [];
		const recommendations: string[] = [];

		try {
			const memUsage = process.memoryUsage();
			const totalMem = memUsage.heapTotal;
			const usedMem = memUsage.heapUsed;
			const memoryUsagePercent = (usedMem / totalMem) * 100;

			if (memoryUsagePercent > 80) {
				risks.push('High memory usage detected - may cause performance issues');
				recommendations.push('Consider processing smaller batches or restarting the workflow');
			} else if (memoryUsagePercent > 60) {
				recommendations.push('Monitor memory usage during PDF processing');
			}
		} catch (error) {
			recommendations.push('Could not check memory usage - monitor system resources manually');
		}

		return { isSafe: risks.length === 0, risks, recommendations };
	}

	/**
	 * Check file system safety
	 */
	private async checkFileSystemSafety(): Promise<ISafetyCheckResult> {
		const risks: string[] = [];
		const recommendations: string[] = [];

		try {
			const outputFormat = this.context.getNodeParameter('outputFormat', this.itemIndex) as string;

			if (outputFormat === 'file' || outputFormat === 'both') {
				const outputPath = this.context.getNodeParameter('outputPath', this.itemIndex) as string;

				// Check if path is absolute and safe
				if (!outputPath.startsWith('/') && !outputPath.match(/^[A-Za-z]:/)) {
					recommendations.push('Consider using absolute paths for output files');
				}

				// Check for path traversal attempts
				if (outputPath.includes('..')) {
					risks.push('Output path contains path traversal characters (..)');
					recommendations.push('Use absolute paths without .. characters');
				}

				// Check directory permissions
				try {
					const dir = dirname(outputPath);
					if (existsSync(dir)) {
						accessSync(dir, constants.W_OK);
					} else {
						risks.push(`Output directory does not exist: ${dir}`);
						recommendations.push('Create the output directory before running the workflow');
					}
				} catch (error) {
					risks.push('Cannot write to output directory');
					recommendations.push('Check directory permissions and ensure the path is writable');
				}
			}
		} catch (error) {
			recommendations.push('Could not validate file system safety - check permissions manually');
		}

		return { isSafe: risks.length === 0, risks, recommendations };
	}

	/**
	 * Check Python execution safety
	 */
	private checkPythonExecutionSafety(): ISafetyCheckResult {
		const risks: string[] = [];
		const recommendations: string[] = [];

		// Check for potentially unsafe field mappings
		try {
			const fieldMappings = this.context.getNodeParameter('fieldMappings', this.itemIndex) as {
				mapping: IFieldMapping[];
			};

			if (fieldMappings && fieldMappings.mapping) {
				fieldMappings.mapping.forEach((mapping, index) => {
					if (mapping.valueSource === 'expression' && mapping.expression) {
						// Check for potentially unsafe expressions
						if (
							mapping.expression.includes('eval(') ||
							mapping.expression.includes('Function(') ||
							mapping.expression.includes('require(') ||
							mapping.expression.includes('import(')
						) {
							risks.push(`Field mapping ${index + 1} contains potentially unsafe expression`);
							recommendations.push(
								'Avoid using eval(), Function(), require(), or import() in expressions',
							);
						}
					}

					if (mapping.valueSource === 'static' && mapping.staticValue) {
						const value = String(mapping.staticValue);
						// Check for extremely long values that might cause issues
						if (value.length > 50000) {
							risks.push(
								`Field mapping ${index + 1} has extremely long static value (${
									value.length
								} characters)`,
							);
							recommendations.push('Consider using shorter values or expressions for large data');
						}
					}
				});
			}
		} catch (error) {
			recommendations.push('Could not validate field mappings for safety');
		}

		return { isSafe: risks.length === 0, risks, recommendations };
	}

	/**
	 * Create graceful fallback for non-critical errors
	 */
	static createGracefulFallback<T>(
		operation: () => Promise<T>,
		fallbackValue: T,
		context: {
			node: INode;
			operationName: string;
			component?: string;
		},
	): Promise<T> {
		return operation().catch((error) => {
			console.warn(`Non-critical error in ${context.operationName}:`, error);

			// Log the error but don't throw
			const errorContext: IErrorContext = {
				component: context.component || 'Unknown',
				operation: context.operationName,
				originalError: error instanceof Error ? error : undefined,
			};

			console.warn('Using fallback value due to error:', errorContext);
			return fallbackValue;
		});
	}

	/**
	 * Validate input data from previous nodes
	 */
	validateInputData(): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		try {
			const inputData = this.context.getInputData();

			if (!inputData || inputData.length === 0) {
				warnings.push('No input data received from previous nodes');
				return { isValid: true, errors, warnings };
			}

			// Check each input item
			inputData.forEach((item, index) => {
				if (!item) {
					warnings.push(`Input item ${index} is null or undefined`);
					return;
				}

				// Check for binary data if using binary source
				const pdfSource = this.context.getNodeParameter('pdfSource', this.itemIndex) as string;
				if (pdfSource === 'binary') {
					const binaryPropertyName = this.context.getNodeParameter(
						'binaryPropertyName',
						this.itemIndex,
					) as string;

					if (!item.binary?.[binaryPropertyName]) {
						errors.push(`Input item ${index} missing binary property "${binaryPropertyName}"`);
					} else {
						const binaryData = item.binary[binaryPropertyName];
						if (!binaryData.data) {
							errors.push(
								`Input item ${index} binary property "${binaryPropertyName}" has no data`,
							);
						}
						if (binaryData.mimeType && !binaryData.mimeType.includes('pdf')) {
							warnings.push(
								`Input item ${index} binary property "${binaryPropertyName}" may not be a PDF (MIME type: ${binaryData.mimeType})`,
							);
						}
					}
				}
			});
		} catch (error) {
			errors.push(
				`Failed to validate input data: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
			);
		}

		return { isValid: errors.length === 0, errors, warnings };
	}
}
