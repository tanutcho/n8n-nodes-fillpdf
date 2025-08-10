import { IExecuteFunctions, INode } from 'n8n-workflow';
import { IFieldMapping, IFieldInfo } from './types';
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
 * Field validation result interface
 */
export interface IFieldValidationResult {
	isValid: boolean;
	fieldName: string;
	value: any;
	errors: string[];
	warnings: string[];
	fieldInfo?: IFieldInfo;
}

/**
 * Comprehensive field validation result
 */
export interface IComprehensiveFieldValidationResult {
	isValid: boolean;
	totalFields: number;
	validFields: number;
	invalidFields: number;
	fieldResults: IFieldValidationResult[];
	summary: {
		requiredFieldsValidated: number;
		optionalFieldsValidated: number;
		typeValidationErrors: number;
		lengthValidationErrors: number;
		optionValidationErrors: number;
		expressionValidationErrors: number;
	};
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
	 * Enhanced n8n expression syntax validation with comprehensive checks
	 */
	private validateExpression(expression: string, mappingIndex: number): IValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Basic expression format checks
		if (!expression.includes('{{') || !expression.includes('}}')) {
			warnings.push(`Field mapping ${mappingIndex + 1}: Expression should be wrapped in {{ }}`);
		}

		// Check for balanced braces
		const openBraces = (expression.match(/\{\{/g) || []).length;
		const closeBraces = (expression.match(/\}\}/g) || []).length;

		if (openBraces !== closeBraces) {
			errors.push(
				`Field mapping ${
					mappingIndex + 1
				}: Mismatched braces - ${openBraces} opening {{ and ${closeBraces} closing }}`,
			);
		}

		// Check for common expression patterns and provide suggestions
		if (
			expression.includes('$json') &&
			!expression.includes('$json[') &&
			!expression.includes('$json.')
		) {
			warnings.push(
				`Field mapping ${
					mappingIndex + 1
				}: $json expressions should specify a property like $json["propertyName"] or $json.propertyName`,
			);
		}

		// Check for deprecated or problematic patterns
		if (expression.includes('$json.') && !expression.match(/\$json\.\w+/)) {
			warnings.push(
				`Field mapping ${
					mappingIndex + 1
				}: Consider using $json["propertyName"] instead of $json.propertyName for better compatibility`,
			);
		}

		// Check for potentially unsafe expressions
		const unsafePatterns = [
			{ pattern: /eval\s*\(/, name: 'eval()' },
			{ pattern: /Function\s*\(/, name: 'Function()' },
			{ pattern: /require\s*\(/, name: 'require()' },
			{ pattern: /import\s*\(/, name: 'import()' },
			{ pattern: /process\./, name: 'process object access' },
			{ pattern: /global\./, name: 'global object access' },
			{ pattern: /__dirname/, name: '__dirname' },
			{ pattern: /__filename/, name: '__filename' },
		];

		for (const { pattern, name } of unsafePatterns) {
			if (pattern.test(expression)) {
				errors.push(
					`Field mapping ${mappingIndex + 1}: Unsafe expression detected - ${name} is not allowed`,
				);
			}
		}

		// Check for common mistakes
		const commonMistakes = [
			{
				pattern: /\{\{\s*\$json\s*\}\}/,
				message: 'Use $json["propertyName"] to access specific properties, not just $json',
			},
			{
				pattern: /\{\{\s*json\s*\}\}/,
				message: 'Use $json instead of json to access input data',
			},
			{
				pattern: /\{\{\s*\$\s*\}\}/,
				message: 'Invalid expression syntax. Use specific n8n variables like $json, $node, etc.',
			},
		];

		for (const { pattern, message } of commonMistakes) {
			if (pattern.test(expression)) {
				errors.push(`Field mapping ${mappingIndex + 1}: ${message}`);
			}
		}

		// Validate expression length
		if (expression.length > 1000) {
			warnings.push(
				`Field mapping ${mappingIndex + 1}: Expression is very long (${
					expression.length
				} characters) - consider simplifying`,
			);
		}

		// Check for nested expressions (which might be problematic)
		const nestedBraces = expression.match(/\{\{[^}]*\{\{/);
		if (nestedBraces) {
			warnings.push(
				`Field mapping ${mappingIndex + 1}: Nested expressions detected - ensure proper syntax`,
			);
		}

		return { isValid: errors.length === 0, errors, warnings };
	}

	/**
	 * Validate expression evaluation during runtime
	 */
	async validateExpressionEvaluation(
		expression: string,
		fieldName: string,
		context: IExecuteFunctions,
		itemIndex: number,
	): Promise<{ isValid: boolean; result?: any; error?: string; warnings: string[] }> {
		const warnings: string[] = [];

		try {
			// Attempt to evaluate the expression
			const result = context.evaluateExpression(expression, itemIndex);

			// Validate the result
			if (result === undefined) {
				warnings.push(
					`Expression for field '${fieldName}' evaluated to undefined - check if referenced data exists`,
				);
			}

			if (result === null) {
				warnings.push(
					`Expression for field '${fieldName}' evaluated to null - will be treated as empty value`,
				);
			}

			// Check for circular references in objects
			if (typeof result === 'object' && result !== null) {
				try {
					JSON.stringify(result);
				} catch (error) {
					return {
						isValid: false,
						error: `Expression result for field '${fieldName}' contains circular references or non-serializable data`,
						warnings,
					};
				}
			}

			// Check for very large results
			if (typeof result === 'string' && result.length > 50000) {
				warnings.push(
					`Expression result for field '${fieldName}' is very large (${result.length} characters) - may cause performance issues`,
				);
			}

			return {
				isValid: true,
				result,
				warnings,
			};
		} catch (error) {
			return {
				isValid: false,
				error: `Expression evaluation failed for field '${fieldName}': ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				warnings,
			};
		}
	}

	/**
	 * Get expression suggestions based on available input data
	 */
	getExpressionSuggestions(context: IExecuteFunctions, itemIndex: number): string[] {
		const suggestions: string[] = [];

		try {
			const inputData = context.getInputData();
			const currentItem = inputData[itemIndex];

			// Basic n8n expressions
			suggestions.push('{{ $json["propertyName"] }}');
			suggestions.push('{{ $json.propertyName }}');
			suggestions.push('{{ $input.item.json["propertyName"] }}');

			// If we have current item data, suggest specific properties
			if (currentItem?.json) {
				const properties = Object.keys(currentItem.json);
				if (properties.length > 0) {
					suggestions.push('// Available properties in current item:');
					properties.slice(0, 5).forEach((key) => {
						suggestions.push(`{{ $json["${key}"] }}`);
					});

					if (properties.length > 5) {
						suggestions.push(`// ... and ${properties.length - 5} more properties`);
					}
				}
			}

			// Node references
			suggestions.push('{{ $("Previous Node Name").json["propertyName"] }}');

			// Utility functions
			suggestions.push('{{ $now }}');
			suggestions.push('{{ $today }}');
			suggestions.push('{{ $workflow.id }}');

			// Conditional expressions
			suggestions.push('{{ $json["field"] ? "value1" : "value2" }}');
			suggestions.push('{{ $json["field"] || "default value" }}');
		} catch (error) {
			// Fallback suggestions
			suggestions.push('{{ $json["propertyName"] }}');
			suggestions.push('{{ $input.item.json["propertyName"] }}');
		}

		return suggestions;
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

	/**
	 * Comprehensive field value validation during workflow execution
	 * Validates field values against PDF field constraints and requirements
	 */
	async validateFieldValues(
		fieldMappings: IFieldMapping[],
		pdfFields: IFieldInfo[],
		evaluatedValues: Record<string, any>,
	): Promise<IComprehensiveFieldValidationResult> {
		const fieldResults: IFieldValidationResult[] = [];
		const summary = {
			requiredFieldsValidated: 0,
			optionalFieldsValidated: 0,
			typeValidationErrors: 0,
			lengthValidationErrors: 0,
			optionValidationErrors: 0,
			expressionValidationErrors: 0,
		};

		// Create field info lookup
		const fieldInfoMap = new Map<string, IFieldInfo>();
		pdfFields.forEach((field) => fieldInfoMap.set(field.name, field));

		// Validate each field mapping
		for (const mapping of fieldMappings) {
			const fieldResult = await this.validateSingleFieldValue(
				mapping,
				fieldInfoMap.get(mapping.pdfFieldName),
				evaluatedValues[mapping.pdfFieldName],
			);

			fieldResults.push(fieldResult);

			// Update summary statistics
			if (fieldResult.fieldInfo?.required) {
				summary.requiredFieldsValidated++;
			} else {
				summary.optionalFieldsValidated++;
			}

			// Count error types
			fieldResult.errors.forEach((error) => {
				if (error.includes('required')) {
					// Required field errors are counted separately
				} else if (error.includes('length') || error.includes('characters')) {
					summary.lengthValidationErrors++;
				} else if (error.includes('options') || error.includes('Available options')) {
					summary.optionValidationErrors++;
				} else if (error.includes('type') || error.includes('must be')) {
					summary.typeValidationErrors++;
				} else if (error.includes('expression') || error.includes('Expression')) {
					summary.expressionValidationErrors++;
				}
			});
		}

		// Check for required fields without mappings
		const mappedFieldNames = new Set(fieldMappings.map((m) => m.pdfFieldName));
		for (const pdfField of pdfFields) {
			if (pdfField.required && !mappedFieldNames.has(pdfField.name)) {
				fieldResults.push({
					isValid: false,
					fieldName: pdfField.name,
					value: undefined,
					errors: [`Required field '${pdfField.name}' has no mapping configured`],
					warnings: [],
					fieldInfo: pdfField,
				});
			}
		}

		const validFields = fieldResults.filter((r) => r.isValid).length;
		const invalidFields = fieldResults.filter((r) => !r.isValid).length;

		return {
			isValid: invalidFields === 0,
			totalFields: fieldResults.length,
			validFields,
			invalidFields,
			fieldResults,
			summary,
		};
	}

	/**
	 * Validate a single field value against its constraints
	 */
	private async validateSingleFieldValue(
		mapping: IFieldMapping,
		fieldInfo: IFieldInfo | undefined,
		evaluatedValue: any,
	): Promise<IFieldValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check if field exists in PDF
		if (!fieldInfo) {
			errors.push(`Field '${mapping.pdfFieldName}' not found in PDF`);
			return {
				isValid: false,
				fieldName: mapping.pdfFieldName,
				value: evaluatedValue,
				errors,
				warnings,
			};
		}

		// Validate required fields
		if (fieldInfo.required && this.isEmptyValue(evaluatedValue)) {
			errors.push(`Required field '${mapping.pdfFieldName}' cannot be empty`);
		}

		// Type-specific validation
		const typeValidation = this.validateFieldType(evaluatedValue, fieldInfo);
		errors.push(...typeValidation.errors);
		warnings.push(...typeValidation.warnings);

		// Length validation for text fields
		if (fieldInfo.type === 'text' && fieldInfo.maxLength && evaluatedValue) {
			const textValue = String(evaluatedValue);
			if (textValue.length > fieldInfo.maxLength) {
				errors.push(
					`Field '${mapping.pdfFieldName}' exceeds maximum length of ${fieldInfo.maxLength} characters (current: ${textValue.length})`,
				);
			}
		}

		// Option validation for dropdown/radio fields
		if (
			(fieldInfo.type === 'dropdown' || fieldInfo.type === 'radio') &&
			fieldInfo.options &&
			fieldInfo.options.length > 0 &&
			evaluatedValue &&
			!this.isEmptyValue(evaluatedValue)
		) {
			const stringValue = String(evaluatedValue);
			if (!fieldInfo.options.includes(stringValue)) {
				// Try case-insensitive match
				const lowerValue = stringValue.toLowerCase();
				const matchingOption = fieldInfo.options.find((opt) => opt.toLowerCase() === lowerValue);

				if (!matchingOption) {
					errors.push(
						`Field '${
							mapping.pdfFieldName
						}' has invalid value '${stringValue}'. Available options: ${fieldInfo.options.join(
							', ',
						)}`,
					);
				} else {
					warnings.push(
						`Field '${mapping.pdfFieldName}' value '${stringValue}' matched case-insensitively to '${matchingOption}'`,
					);
				}
			}
		}

		// Expression validation (if applicable)
		if (mapping.valueSource === 'expression' && mapping.expression) {
			const expressionValidation = this.validateExpressionResult(
				mapping.expression,
				evaluatedValue,
				fieldInfo,
			);
			errors.push(...expressionValidation.errors);
			warnings.push(...expressionValidation.warnings);
		}

		return {
			isValid: errors.length === 0,
			fieldName: mapping.pdfFieldName,
			value: evaluatedValue,
			errors,
			warnings,
			fieldInfo,
		};
	}

	/**
	 * Validate field value type against expected field type
	 */
	private validateFieldType(
		value: any,
		fieldInfo: IFieldInfo,
	): { errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		if (this.isEmptyValue(value)) {
			return { errors, warnings }; // Empty values are handled by required validation
		}

		switch (fieldInfo.type) {
			case 'text':
				// Text fields accept most types but warn about complex objects
				if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
					warnings.push(
						`Text field '${fieldInfo.name}' received object value - will be converted to JSON string`,
					);
				}
				break;

			case 'checkbox':
				// Checkbox fields should be boolean-convertible
				if (typeof value !== 'boolean' && typeof value !== 'string' && typeof value !== 'number') {
					warnings.push(
						`Checkbox field '${
							fieldInfo.name
						}' received ${typeof value} value - will be converted to boolean`,
					);
				}
				break;

			case 'radio':
			case 'dropdown':
				// Radio and dropdown fields should be strings
				if (typeof value !== 'string' && typeof value !== 'number') {
					warnings.push(
						`${fieldInfo.type} field '${
							fieldInfo.name
						}' received ${typeof value} value - will be converted to string`,
					);
				}
				break;

			default:
				warnings.push(`Unknown field type '${fieldInfo.type}' for field '${fieldInfo.name}'`);
		}

		return { errors, warnings };
	}

	/**
	 * Validate expression evaluation result
	 */
	private validateExpressionResult(
		expression: string,
		evaluatedValue: any,
		fieldInfo: IFieldInfo,
	): { errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for expression evaluation errors
		if (evaluatedValue === undefined && expression.includes('{{')) {
			warnings.push(
				`Expression '${expression}' evaluated to undefined - check if referenced data exists`,
			);
		}

		// Check for null/undefined results from expressions
		if (evaluatedValue === null) {
			warnings.push(`Expression '${expression}' evaluated to null`);
		}

		// Validate expression result type compatibility
		if (fieldInfo.type === 'checkbox' && evaluatedValue !== null && evaluatedValue !== undefined) {
			if (
				typeof evaluatedValue !== 'boolean' &&
				typeof evaluatedValue !== 'string' &&
				typeof evaluatedValue !== 'number'
			) {
				warnings.push(
					`Checkbox expression result should be boolean, string, or number for proper conversion`,
				);
			}
		}

		// Check for potentially problematic expression results
		if (
			typeof evaluatedValue === 'object' &&
			evaluatedValue !== null &&
			!(evaluatedValue instanceof Date)
		) {
			if (fieldInfo.type !== 'text') {
				warnings.push(
					`Expression returned object for ${fieldInfo.type} field - may not convert properly`,
				);
			}
		}

		return { errors, warnings };
	}

	/**
	 * Check if a value is considered empty
	 */
	private isEmptyValue(value: any): boolean {
		return (
			value === null ||
			value === undefined ||
			value === '' ||
			(typeof value === 'string' && value.trim() === '')
		);
	}

	/**
	 * Create detailed validation error messages with field context
	 */
	createFieldValidationErrorMessage(validationResult: IComprehensiveFieldValidationResult): string {
		if (validationResult.isValid) {
			return `All ${validationResult.totalFields} fields validated successfully`;
		}

		const errorMessages: string[] = [];

		// Summary
		errorMessages.push(
			`Field validation failed: ${validationResult.invalidFields} of ${validationResult.totalFields} fields have errors`,
		);
		errorMessages.push('');

		// Group errors by type
		const requiredFieldErrors = validationResult.fieldResults.filter((r) =>
			r.errors.some((e) => e.includes('required')),
		);

		const typeErrors = validationResult.fieldResults.filter((r) =>
			r.errors.some((e) => e.includes('type') || e.includes('must be')),
		);

		const lengthErrors = validationResult.fieldResults.filter((r) =>
			r.errors.some((e) => e.includes('length') || e.includes('characters')),
		);

		const optionErrors = validationResult.fieldResults.filter((r) =>
			r.errors.some((e) => e.includes('options') || e.includes('Available options')),
		);

		// Required field errors
		if (requiredFieldErrors.length > 0) {
			errorMessages.push('❌ Required Field Errors:');
			requiredFieldErrors.forEach((result) => {
				const requiredErrors = result.errors.filter((e) => e.includes('required'));
				requiredErrors.forEach((error) => {
					errorMessages.push(`   • ${error}`);
				});
			});
			errorMessages.push('');
		}

		// Type validation errors
		if (typeErrors.length > 0) {
			errorMessages.push('❌ Type Validation Errors:');
			typeErrors.forEach((result) => {
				const typeErrs = result.errors.filter((e) => e.includes('type') || e.includes('must be'));
				typeErrs.forEach((error) => {
					errorMessages.push(`   • ${error}`);
				});
			});
			errorMessages.push('');
		}

		// Length validation errors
		if (lengthErrors.length > 0) {
			errorMessages.push('❌ Length Validation Errors:');
			lengthErrors.forEach((result) => {
				const lengthErrs = result.errors.filter(
					(e) => e.includes('length') || e.includes('characters'),
				);
				lengthErrs.forEach((error) => {
					errorMessages.push(`   • ${error}`);
				});
			});
			errorMessages.push('');
		}

		// Option validation errors
		if (optionErrors.length > 0) {
			errorMessages.push('❌ Option Validation Errors:');
			optionErrors.forEach((result) => {
				const optionErrs = result.errors.filter(
					(e) => e.includes('options') || e.includes('Available options'),
				);
				optionErrs.forEach((error) => {
					errorMessages.push(`   • ${error}`);
				});
			});
			errorMessages.push('');
		}

		// Other errors
		const otherErrors = validationResult.fieldResults.filter((r) =>
			r.errors.some(
				(e) =>
					!e.includes('required') &&
					!e.includes('type') &&
					!e.includes('must be') &&
					!e.includes('length') &&
					!e.includes('characters') &&
					!e.includes('options') &&
					!e.includes('Available options'),
			),
		);

		if (otherErrors.length > 0) {
			errorMessages.push('❌ Other Validation Errors:');
			otherErrors.forEach((result) => {
				const otherErrs = result.errors.filter(
					(e) =>
						!e.includes('required') &&
						!e.includes('type') &&
						!e.includes('must be') &&
						!e.includes('length') &&
						!e.includes('characters') &&
						!e.includes('options') &&
						!e.includes('Available options'),
				);
				otherErrs.forEach((error) => {
					errorMessages.push(`   • ${error}`);
				});
			});
			errorMessages.push('');
		}

		// Validation summary
		errorMessages.push('📊 Validation Summary:');
		errorMessages.push(`   • Total fields: ${validationResult.totalFields}`);
		errorMessages.push(`   • Valid fields: ${validationResult.validFields}`);
		errorMessages.push(`   • Invalid fields: ${validationResult.invalidFields}`);
		errorMessages.push(
			`   • Required fields validated: ${validationResult.summary.requiredFieldsValidated}`,
		);
		errorMessages.push(
			`   • Optional fields validated: ${validationResult.summary.optionalFieldsValidated}`,
		);

		return errorMessages.join('\n');
	}

	/**
	 * Log field validation warnings to console
	 */
	logFieldValidationWarnings(validationResult: IComprehensiveFieldValidationResult): void {
		const warningsExist = validationResult.fieldResults.some((r) => r.warnings.length > 0);

		if (!warningsExist) {
			return;
		}

		console.log('\n⚠️  Field Validation Warnings:');
		console.log('═'.repeat(50));

		validationResult.fieldResults.forEach((result) => {
			if (result.warnings.length > 0) {
				console.log(`\n📝 Field: ${result.fieldName}`);
				result.warnings.forEach((warning) => {
					console.log(`   ⚠️  ${warning}`);
				});
			}
		});

		console.log("\n💡 These warnings indicate potential issues but won't prevent PDF processing.");
		console.log(`${'═'.repeat(50)}\n`);
	}
}
