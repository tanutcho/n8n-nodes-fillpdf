import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping, IFieldInfo } from './types';
import { ValidationUtils, IComprehensiveFieldValidationResult } from './validation';
// Error handling is done at higher levels

/**
 * Field mapper for converting n8n workflow data to PDF field values
 * Handles static values, expressions, and field type conversion
 */
export class FieldMapper {
	private context: IExecuteFunctions;
	private itemIndex: number;

	constructor(context: IExecuteFunctions, itemIndex: number = 0) {
		this.context = context;
		this.itemIndex = itemIndex;
	}

	/**
	 * Map n8n workflow data to PDF fields based on field mappings with comprehensive validation
	 */
	async mapFieldsToValues(
		fieldMappings: IFieldMapping[],
		pdfFields: IFieldInfo[],
	): Promise<Record<string, any>> {
		const mappedValues: Record<string, any> = {};
		const errors: string[] = [];

		// Create field info lookup for validation
		const fieldInfoMap = new Map<string, IFieldInfo>();
		pdfFields.forEach((field) => fieldInfoMap.set(field.name, field));

		// First pass: Evaluate all expressions and get raw values
		const evaluatedValues: Record<string, any> = {};
		for (const mapping of fieldMappings) {
			try {
				// Skip empty field names
				if (!mapping.pdfFieldName) {
					continue;
				}

				// Get the raw value based on source type
				const rawValue = await this.getRawValue(mapping);
				evaluatedValues[mapping.pdfFieldName] = rawValue;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Field '${mapping.pdfFieldName}' evaluation failed: ${errorMessage}`);
			}
		}

		// Perform comprehensive field validation
		const validator = new ValidationUtils(this.context, this.itemIndex);
		const validationResult = await validator.validateFieldValues(
			fieldMappings,
			pdfFields,
			evaluatedValues,
		);

		// Log validation warnings
		validator.logFieldValidationWarnings(validationResult);

		// If validation failed, throw detailed error
		if (!validationResult.isValid) {
			const errorMessage = validator.createFieldValidationErrorMessage(validationResult);
			throw {
				message: errorMessage,
				errorType: 'data' as const,
				details: {
					validationResult,
					evaluatedValues,
					fieldMappings,
					pdfFields,
				},
			};
		}

		// Second pass: Convert and store validated values
		for (const mapping of fieldMappings) {
			try {
				// Skip empty field names
				if (!mapping.pdfFieldName) {
					continue;
				}

				// Get field info for conversion
				const fieldInfo = fieldInfoMap.get(mapping.pdfFieldName);
				if (!fieldInfo) {
					continue; // Already handled in validation
				}

				// Get the evaluated value
				const rawValue = evaluatedValues[mapping.pdfFieldName];

				// Convert value based on field type
				const convertedValue = this.convertValueForFieldType(rawValue, fieldInfo);

				// Store the mapped value
				mappedValues[mapping.pdfFieldName] = convertedValue;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Field '${mapping.pdfFieldName}' conversion failed: ${errorMessage}`);
			}
		}

		// Throw error if there were conversion issues
		if (errors.length > 0) {
			throw {
				message: `Field mapping conversion failed:\n${errors.join('\n')}`,
				errorType: 'data' as const,
				details: { errors, mappedValues, validationResult },
			};
		}

		// Log successful mapping summary
		this.logMappingSuccess(mappedValues, validationResult);

		return mappedValues;
	}

	/**
	 * Get raw value from mapping based on source type with enhanced expression support
	 */
	private async getRawValue(mapping: IFieldMapping): Promise<any> {
		switch (mapping.valueSource) {
			case 'static':
				console.log(
					`📝 Using static value for field '${mapping.pdfFieldName}': ${this.formatValueForDisplay(
						mapping.staticValue,
					)}`,
				);
				return mapping.staticValue;

			case 'expression':
				if (!mapping.expression) {
					throw new Error('Expression is required for expression-based mapping');
				}

				console.log(`🔧 Processing expression for field '${mapping.pdfFieldName}'`);
				const result = await this.evaluateExpression(mapping.expression);

				// Validate expression result
				const expressionValidation = this.validateExpressionResult(result, mapping.expression);
				if (!expressionValidation.valid) {
					console.log(`   ⚠️  Expression validation warning: ${expressionValidation.warning}`);
				}

				return result;

			default:
				throw new Error(`Unsupported value source: ${mapping.valueSource}`);
		}
	}

	/**
	 * Evaluate n8n expression with enhanced error handling and validation
	 */
	private async evaluateExpression(expression: string): Promise<any> {
		try {
			// Validate expression syntax first
			const syntaxValidation = await this.validateExpressionSyntax(expression);
			if (!syntaxValidation.valid) {
				throw new Error(`Expression syntax error: ${syntaxValidation.error}`);
			}

			// Log expression evaluation for debugging
			console.log(`🔧 Evaluating expression: ${expression}`);

			// Use n8n's expression evaluation
			const result = this.context.evaluateExpression(expression, this.itemIndex);

			// Log the result for debugging
			const resultType = typeof result;
			const resultPreview = this.formatValueForDisplay(result);
			console.log(`   ✅ Result (${resultType}): ${resultPreview}`);

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.log(`   ❌ Expression evaluation failed: ${errorMessage}`);

			// Provide enhanced error context
			throw new Error(
				`Expression evaluation failed for "${expression}": ${errorMessage}. ` +
					`Check that referenced data exists and expression syntax is correct.`,
			);
		}
	}

	/**
	 * Convert value to appropriate type based on PDF field type
	 */
	private convertValueForFieldType(value: any, fieldInfo: IFieldInfo): any {
		// Handle null/undefined values
		if (value === null || value === undefined) {
			return null;
		}

		switch (fieldInfo.type) {
			case 'text':
				return this.convertToText(value, fieldInfo);

			case 'checkbox':
				return this.convertToCheckbox(value);

			case 'radio':
				return this.convertToRadio(value, fieldInfo);

			case 'dropdown':
				return this.convertToDropdown(value, fieldInfo);

			default:
				// Default to text conversion
				return this.convertToText(value, fieldInfo);
		}
	}

	/**
	 * Convert value to text format
	 */
	private convertToText(value: any, fieldInfo: IFieldInfo): string {
		if (value === null || value === undefined) {
			return '';
		}

		let textValue: string;

		// Convert different types to string
		if (typeof value === 'string') {
			textValue = value;
		} else if (typeof value === 'number') {
			// Handle special number cases
			if (isNaN(value)) {
				throw new Error('Cannot use NaN as text value');
			}
			if (!isFinite(value)) {
				throw new Error('Cannot use infinite number as text value');
			}
			textValue = value.toString();
		} else if (typeof value === 'boolean') {
			textValue = value ? 'true' : 'false';
		} else if (value instanceof Date) {
			textValue = value.toISOString();
		} else if (typeof value === 'object') {
			try {
				textValue = JSON.stringify(value);
			} catch {
				textValue = '[Object]';
			}
		} else {
			textValue = String(value);
		}

		// Validate length constraints
		if (fieldInfo.maxLength && textValue.length > fieldInfo.maxLength) {
			throw new Error(`Text value exceeds maximum length of ${fieldInfo.maxLength} characters`);
		}

		// General length limit for safety
		if (textValue.length > 10000) {
			throw new Error('Text value exceeds maximum allowed length of 10,000 characters');
		}

		return textValue;
	}

	/**
	 * Convert value to checkbox format
	 */
	private convertToCheckbox(value: any): string {
		if (value === null || value === undefined) {
			return 'Off';
		}

		// Handle different value types
		if (typeof value === 'boolean') {
			return value ? 'Yes' : 'Off';
		}

		if (typeof value === 'string') {
			const lowerValue = value.toLowerCase().trim();

			// Handle common truthy string values
			if (['true', 'yes', '1', 'on', 'checked', 'selected'].includes(lowerValue)) {
				return 'Yes';
			}

			// Handle common falsy string values
			if (['false', 'no', '0', 'off', 'unchecked', 'unselected', ''].includes(lowerValue)) {
				return 'Off';
			}

			// Non-empty strings are considered truthy
			return value.length > 0 ? 'Yes' : 'Off';
		}

		if (typeof value === 'number') {
			if (isNaN(value)) {
				return 'Off';
			}
			return value !== 0 ? 'Yes' : 'Off';
		}

		// For other types, use JavaScript truthiness
		return value ? 'Yes' : 'Off';
	}

	/**
	 * Convert value to radio button format
	 */
	private convertToRadio(value: any, fieldInfo: IFieldInfo): string {
		if (value === null || value === undefined) {
			return '';
		}

		const stringValue = String(value).trim();

		// If field has defined options, validate against them
		if (fieldInfo.options && fieldInfo.options.length > 0) {
			// Check for exact match (case-sensitive)
			if (fieldInfo.options.includes(stringValue)) {
				return stringValue;
			}

			// Check for case-insensitive match
			const lowerValue = stringValue.toLowerCase();
			const matchingOption = fieldInfo.options.find(
				(option) => option.toLowerCase() === lowerValue,
			);

			if (matchingOption) {
				return matchingOption;
			}

			// If no match found, throw error with available options
			throw new Error(
				`Invalid radio button value '${stringValue}'. Available options: ${fieldInfo.options.join(
					', ',
				)}`,
			);
		}

		// If no options defined, return the string value
		return stringValue;
	}

	/**
	 * Convert value to dropdown format
	 */
	private convertToDropdown(value: any, fieldInfo: IFieldInfo): string {
		if (value === null || value === undefined) {
			return '';
		}

		const stringValue = String(value).trim();

		// If field has defined options, validate against them
		if (fieldInfo.options && fieldInfo.options.length > 0) {
			// Check for exact match (case-sensitive)
			if (fieldInfo.options.includes(stringValue)) {
				return stringValue;
			}

			// Check for case-insensitive match
			const lowerValue = stringValue.toLowerCase();
			const matchingOption = fieldInfo.options.find(
				(option) => option.toLowerCase() === lowerValue,
			);

			if (matchingOption) {
				return matchingOption;
			}

			// If no match found, throw error with available options
			throw new Error(
				`Invalid dropdown value '${stringValue}'. Available options: ${fieldInfo.options.join(
					', ',
				)}`,
			);
		}

		// If no options defined, return the string value
		return stringValue;
	}

	/**
	 * Validate all field mappings without processing values
	 */
	async validateMappings(
		fieldMappings: IFieldMapping[],
		pdfFields: IFieldInfo[],
	): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];
		const fieldNames = new Set(pdfFields.map((f) => f.name));

		for (const mapping of fieldMappings) {
			// Check if field exists in PDF
			if (!fieldNames.has(mapping.pdfFieldName)) {
				errors.push(`Field '${mapping.pdfFieldName}' not found in PDF`);
				continue;
			}

			// Validate mapping configuration
			if (mapping.valueSource === 'static') {
				if (mapping.staticValue === undefined || mapping.staticValue === null) {
					errors.push(`Static value required for field '${mapping.pdfFieldName}'`);
				}
			} else if (mapping.valueSource === 'expression') {
				if (!mapping.expression || mapping.expression.trim() === '') {
					errors.push(`Expression required for field '${mapping.pdfFieldName}'`);
				} else {
					// Basic expression syntax validation
					try {
						// Try to evaluate expression with dummy data to check syntax
						this.context.evaluateExpression(mapping.expression, this.itemIndex);
					} catch (error) {
						errors.push(
							`Invalid expression for field '${mapping.pdfFieldName}': ${
								error instanceof Error ? error.message : 'Unknown error'
							}`,
						);
					}
				}
			} else {
				errors.push(
					`Invalid value source '${mapping.valueSource}' for field '${mapping.pdfFieldName}'`,
				);
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Get field mapping summary for debugging/logging
	 */
	getMappingSummary(fieldMappings: IFieldMapping[]): string {
		const summary = fieldMappings.map((mapping) => {
			const source =
				mapping.valueSource === 'static'
					? `static: "${mapping.staticValue}"`
					: `expression: "${mapping.expression}"`;
			return `${mapping.pdfFieldName} <- ${source}`;
		});

		return `Field mappings (${fieldMappings.length}):\n${summary.join('\n')}`;
	}

	/**
	 * Set item index for expression evaluation context
	 */
	setItemIndex(index: number): void {
		this.itemIndex = index;
	}

	/**
	 * Get current item index
	 */
	getItemIndex(): number {
		return this.itemIndex;
	}

	/**
	 * Log successful field mapping with validation summary
	 */
	private logMappingSuccess(
		mappedValues: Record<string, any>,
		validationResult: IComprehensiveFieldValidationResult,
	): void {
		console.log('\n✅ Field Mapping Completed Successfully');
		console.log('═'.repeat(50));
		console.log(
			`📊 Mapped ${Object.keys(mappedValues).length} fields with comprehensive validation`,
		);
		console.log(`   • Required fields: ${validationResult.summary.requiredFieldsValidated}`);
		console.log(`   • Optional fields: ${validationResult.summary.optionalFieldsValidated}`);
		console.log(`   • All validations passed: ${validationResult.isValid ? '✅' : '❌'}`);

		// Show field mapping details
		if (Object.keys(mappedValues).length > 0) {
			console.log('\n📝 Field Values:');
			Object.entries(mappedValues).forEach(([fieldName, value]) => {
				const fieldResult = validationResult.fieldResults.find((r) => r.fieldName === fieldName);
				const fieldType = fieldResult?.fieldInfo?.type || 'unknown';
				const isRequired = fieldResult?.fieldInfo?.required ? ' (Required)' : '';
				const displayValue = this.formatValueForDisplay(value);
				console.log(`   • ${fieldName} [${fieldType}]${isRequired}: ${displayValue}`);
			});
		}

		console.log(`${'═'.repeat(50)}\n`);
	}

	/**
	 * Format field value for display in logs
	 */
	private formatValueForDisplay(value: any): string {
		if (value === null || value === undefined) {
			return '<empty>';
		}

		if (typeof value === 'string') {
			if (value.length > 50) {
				return `"${value.substring(0, 47)}..."`;
			}
			return `"${value}"`;
		}

		if (typeof value === 'boolean') {
			return value ? 'true' : 'false';
		}

		if (typeof value === 'number') {
			return value.toString();
		}

		if (typeof value === 'object') {
			try {
				const jsonStr = JSON.stringify(value);
				if (jsonStr.length > 50) {
					return `${jsonStr.substring(0, 47)}...`;
				}
				return jsonStr;
			} catch {
				return '[Object]';
			}
		}

		return String(value);
	}

	/**
	 * Enhanced expression validation with better error context
	 */
	async validateExpressionSyntax(expression: string): Promise<{ valid: boolean; error?: string }> {
		try {
			// Basic syntax validation
			if (!expression || expression.trim() === '') {
				return { valid: false, error: 'Expression cannot be empty' };
			}

			// Check for balanced braces
			const openBraces = (expression.match(/\{\{/g) || []).length;
			const closeBraces = (expression.match(/\}\}/g) || []).length;

			if (openBraces !== closeBraces) {
				return {
					valid: false,
					error: `Mismatched braces: ${openBraces} opening {{ and ${closeBraces} closing }}`,
				};
			}

			// Check for potentially unsafe expressions
			const unsafePatterns = [
				/eval\s*\(/,
				/Function\s*\(/,
				/require\s*\(/,
				/import\s*\(/,
				/process\./,
				/global\./,
				/__dirname/,
				/__filename/,
			];

			for (const pattern of unsafePatterns) {
				if (pattern.test(expression)) {
					return {
						valid: false,
						error: `Expression contains potentially unsafe code: ${pattern.source}`,
					};
				}
			}

			// Validate common n8n expression patterns
			const validationResult = this.validateN8nExpressionPatterns(expression);
			if (!validationResult.valid) {
				return validationResult;
			}

			// Try to evaluate with dummy context to check syntax
			try {
				this.context.evaluateExpression(expression, this.itemIndex);
			} catch (evalError) {
				// If it's a reference error, that's okay - we just want to check syntax
				if (evalError instanceof Error && !evalError.message.includes('ReferenceError')) {
					return {
						valid: false,
						error: `Expression syntax error: ${evalError.message}`,
					};
				}
			}

			return { valid: true };
		} catch (error) {
			return {
				valid: false,
				error: `Expression validation failed: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
			};
		}
	}

	/**
	 * Validate n8n-specific expression patterns and provide helpful suggestions
	 */
	private validateN8nExpressionPatterns(expression: string): { valid: boolean; error?: string } {
		// Check for common n8n expression patterns and provide suggestions
		const patterns = [
			{
				pattern: /\$json\s*\.\s*\w+/,
				suggestion:
					'Use $json["propertyName"] instead of $json.propertyName for better compatibility',
			},
			{
				pattern: /\$node\s*\[\s*["'][^"']+["']\s*\]\s*\.\s*json/,
				suggestion: 'Consider using $("NodeName").json["propertyName"] for cleaner syntax',
			},
			{
				pattern: /\$input\s*\.\s*all\s*\(\s*\)/,
				suggestion: 'Use $input.all() to access all input items',
			},
		];

		// These are just suggestions, not errors
		for (const { pattern, suggestion } of patterns) {
			if (pattern.test(expression)) {
				console.log(`💡 Expression suggestion: ${suggestion}`);
			}
		}

		// Check for common mistakes
		const mistakes = [
			{
				pattern: /\{\{\s*\$json\s*\}\}/,
				error: 'Use $json["propertyName"] to access specific properties, not just $json',
			},
			{
				pattern: /\{\{\s*\$\s*\}\}/,
				error: 'Invalid expression syntax. Use specific n8n variables like $json, $node, etc.',
			},
			{
				pattern: /\{\{\s*json\s*\}\}/,
				error: 'Use $json instead of json to access input data',
			},
		];

		for (const { pattern, error } of mistakes) {
			if (pattern.test(expression)) {
				return { valid: false, error };
			}
		}

		return { valid: true };
	}

	/**
	 * Validate expression evaluation result
	 */
	private validateExpressionResult(
		result: any,
		expression: string,
	): { valid: boolean; warning?: string } {
		// Check for potentially problematic results
		if (result === undefined) {
			return {
				valid: false,
				warning: `Expression "${expression}" evaluated to undefined. Check if referenced data exists.`,
			};
		}

		if (result === null) {
			return {
				valid: true,
				warning: `Expression "${expression}" evaluated to null. This will be treated as an empty value.`,
			};
		}

		// Check for circular references in objects
		if (typeof result === 'object' && result !== null) {
			try {
				JSON.stringify(result);
			} catch (error) {
				return {
					valid: false,
					warning: `Expression result contains circular references or non-serializable data.`,
				};
			}
		}

		// Check for very large strings that might cause issues
		if (typeof result === 'string' && result.length > 50000) {
			return {
				valid: true,
				warning: `Expression result is very large (${result.length} characters). This may cause performance issues.`,
			};
		}

		return { valid: true };
	}

	/**
	 * Get expression evaluation context information for debugging
	 */
	getExpressionContext(): any {
		try {
			const inputData = this.context.getInputData();
			const currentItem = inputData[this.itemIndex];

			return {
				itemIndex: this.itemIndex,
				totalItems: inputData.length,
				currentItemKeys: currentItem?.json ? Object.keys(currentItem.json) : [],
				hasBinaryData: !!currentItem?.binary,
				binaryKeys: currentItem?.binary ? Object.keys(currentItem.binary) : [],
			};
		} catch (error) {
			return {
				error: 'Could not retrieve expression context',
				itemIndex: this.itemIndex,
			};
		}
	}

	/**
	 * Provide expression suggestions based on available data
	 */
	getExpressionSuggestions(): string[] {
		const suggestions: string[] = [];

		try {
			const context = this.getExpressionContext();

			// Basic n8n expressions
			suggestions.push('{{ $json["propertyName"] }}');
			suggestions.push('{{ $json.propertyName }}');
			suggestions.push('{{ $input.item.json["propertyName"] }}');

			// If we have current item data, suggest specific properties
			if (context.currentItemKeys && context.currentItemKeys.length > 0) {
				suggestions.push('// Available properties in current item:');
				context.currentItemKeys.slice(0, 5).forEach((key: string) => {
					suggestions.push(`{{ $json["${key}"] }}`);
				});

				if (context.currentItemKeys.length > 5) {
					suggestions.push(`// ... and ${context.currentItemKeys.length - 5} more properties`);
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
			suggestions.push('{{ $json["propertyName"] }}');
			suggestions.push('{{ $input.item.json["propertyName"] }}');
		}

		return suggestions;
	}
}

/**
 * Utility function to create a configured field mapper instance
 */
export function createFieldMapper(context: IExecuteFunctions, itemIndex: number = 0): FieldMapper {
	return new FieldMapper(context, itemIndex);
}
