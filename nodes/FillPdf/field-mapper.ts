import { IExecuteFunctions } from 'n8n-workflow';
import { IFieldMapping, IFieldInfo } from './types';
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
	 * Map n8n workflow data to PDF fields based on field mappings
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

		// Process each field mapping
		for (const mapping of fieldMappings) {
			try {
				// Skip empty field names
				if (!mapping.pdfFieldName) {
					continue;
				}

				// Get field info for validation
				const fieldInfo = fieldInfoMap.get(mapping.pdfFieldName);
				if (!fieldInfo) {
					errors.push(`Field '${mapping.pdfFieldName}' not found in PDF`);
					continue;
				}

				// Get the raw value based on source type
				const rawValue = await this.getRawValue(mapping);

				// Convert and validate the value based on field type
				const convertedValue = this.convertValueForFieldType(rawValue, fieldInfo);

				// Validate the converted value
				const validationResult = this.validateFieldValue(convertedValue, fieldInfo);
				if (!validationResult.valid) {
					errors.push(`Field '${mapping.pdfFieldName}': ${validationResult.error}`);
					continue;
				}

				// Store the mapped value
				mappedValues[mapping.pdfFieldName] = convertedValue;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Field '${mapping.pdfFieldName}': ${errorMessage}`);
			}
		}

		// Throw error if there were validation issues
		if (errors.length > 0) {
			throw {
				message: `Field mapping validation failed:\n${errors.join('\n')}`,
				errorType: 'data' as const,
				details: { errors, mappedValues },
			};
		}

		return mappedValues;
	}

	/**
	 * Get raw value from mapping based on source type
	 */
	private async getRawValue(mapping: IFieldMapping): Promise<any> {
		switch (mapping.valueSource) {
			case 'static':
				return mapping.staticValue;

			case 'expression':
				if (!mapping.expression) {
					throw new Error('Expression is required for expression-based mapping');
				}
				return this.evaluateExpression(mapping.expression);

			default:
				throw new Error(`Unsupported value source: ${mapping.valueSource}`);
		}
	}

	/**
	 * Evaluate n8n expression and return the result
	 */
	private evaluateExpression(expression: string): any {
		try {
			// Use n8n's expression evaluation
			return this.context.evaluateExpression(expression, this.itemIndex);
		} catch (error) {
			throw new Error(
				`Expression evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
	 * Validate field value against field constraints
	 */
	private validateFieldValue(
		value: any,
		fieldInfo: IFieldInfo,
	): { valid: boolean; error?: string } {
		// Check required fields
		if (fieldInfo.required && (value === null || value === undefined || value === '')) {
			return {
				valid: false,
				error: 'This field is required and cannot be empty',
			};
		}

		// Type-specific validation
		switch (fieldInfo.type) {
			case 'text':
				return this.validateTextValue(value, fieldInfo);
			case 'checkbox':
				return this.validateCheckboxValue(value);
			case 'radio':
				return this.validateRadioValue(value, fieldInfo);
			case 'dropdown':
				return this.validateDropdownValue(value, fieldInfo);
			default:
				return { valid: true };
		}
	}

	/**
	 * Validate text field value
	 */
	private validateTextValue(value: any, fieldInfo: IFieldInfo): { valid: boolean; error?: string } {
		if (value === null || value === undefined || value === '') {
			return { valid: true }; // Empty values are handled by required check
		}

		if (typeof value !== 'string') {
			return {
				valid: false,
				error: 'Text field value must be a string',
			};
		}

		if (fieldInfo.maxLength && value.length > fieldInfo.maxLength) {
			return {
				valid: false,
				error: `Text exceeds maximum length of ${fieldInfo.maxLength} characters`,
			};
		}

		return { valid: true };
	}

	/**
	 * Validate checkbox field value
	 */
	private validateCheckboxValue(value: any): { valid: boolean; error?: string } {
		if (value === null || value === undefined) {
			return { valid: true };
		}

		// Checkbox values should be 'Yes' or 'Off' after conversion
		if (typeof value === 'string' && ['Yes', 'Off'].includes(value)) {
			return { valid: true };
		}

		return {
			valid: false,
			error: 'Checkbox value must be boolean or convertible to Yes/Off',
		};
	}

	/**
	 * Validate radio button field value
	 */
	private validateRadioValue(
		value: any,
		fieldInfo: IFieldInfo,
	): { valid: boolean; error?: string } {
		if (value === null || value === undefined || value === '') {
			return { valid: true }; // Empty values are handled by required check
		}

		if (typeof value !== 'string') {
			return {
				valid: false,
				error: 'Radio button value must be a string',
			};
		}

		// If options are defined, value must be one of them
		if (fieldInfo.options && fieldInfo.options.length > 0) {
			if (!fieldInfo.options.includes(value)) {
				return {
					valid: false,
					error: `Value must be one of: ${fieldInfo.options.join(', ')}`,
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Validate dropdown field value
	 */
	private validateDropdownValue(
		value: any,
		fieldInfo: IFieldInfo,
	): { valid: boolean; error?: string } {
		if (value === null || value === undefined || value === '') {
			return { valid: true }; // Empty values are handled by required check
		}

		if (typeof value !== 'string') {
			return {
				valid: false,
				error: 'Dropdown value must be a string',
			};
		}

		// If options are defined, value must be one of them
		if (fieldInfo.options && fieldInfo.options.length > 0) {
			if (!fieldInfo.options.includes(value)) {
				return {
					valid: false,
					error: `Value must be one of: ${fieldInfo.options.join(', ')}`,
				};
			}
		}

		return { valid: true };
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
}

/**
 * Utility function to create a configured field mapper instance
 */
export function createFieldMapper(context: IExecuteFunctions, itemIndex: number = 0): FieldMapper {
	return new FieldMapper(context, itemIndex);
}
