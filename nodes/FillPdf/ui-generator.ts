import { INodeProperties } from 'n8n-workflow';
import { IFieldInfo } from './types';

/**
 * Interface for dynamic field property generation
 */
export interface IDynamicProperty extends INodeProperties {
	sourceField: IFieldInfo;
	generatedAt: number;
	cacheKey: string;
}

/**
 * UI Generator for dynamic PDF field input system
 * Creates n8n property definitions based on extracted PDF fields
 */
export class UIGenerator {
	/**
	 * Generate dynamic field properties from extracted PDF fields
	 */
	generateFieldProperties(fields: IFieldInfo[]): INodeProperties[] {
		const properties: INodeProperties[] = [];

		// Add a section header for PDF fields
		if (fields.length > 0) {
			properties.push({
				displayName: 'PDF Fields',
				name: 'pdfFieldsSection',
				type: 'notice',
				default: `📋 Extracted PDF Fields\n\n${fields.length} fillable fields found in the PDF. Configure values below:`,
				displayOptions: {
					show: {
						pdfSource: ['url'],
					},
				},
				typeOptions: {
					theme: 'success',
				},
			});
		}

		// Generate individual field properties
		fields.forEach((field, index) => {
			const fieldProperty = this.createFieldInput(field, index);
			if (fieldProperty) {
				properties.push(fieldProperty);
			}
		});

		// Add summary notice if fields were generated
		if (fields.length > 0) {
			const requiredCount = fields.filter((f) => f.required).length;
			const optionalCount = fields.length - requiredCount;

			properties.push({
				displayName: 'Field Summary',
				name: 'fieldSummary',
				type: 'notice',
				default: `✅ Field Configuration Complete\n\nTotal fields: ${fields.length} (${requiredCount} required, ${optionalCount} optional)\n\n💡 All fields support n8n expressions like {{ $json.fieldName }}`,
				displayOptions: {
					show: {
						pdfSource: ['url'],
					},
				},
				typeOptions: {
					theme: 'info',
				},
			});
		}

		return properties;
	}

	/**
	 * Create individual field input property based on field type
	 */
	createFieldInput(field: IFieldInfo, _index: number): INodeProperties | null {
		const baseProperty = {
			displayName: this.formatFieldDisplayName(field),
			name: `pdfField_${field.name}`,
			description: this.generateFieldDescription(field),
			displayOptions: {
				show: {
					pdfSource: ['url'],
				},
			},
			default: field.defaultValue || this.getDefaultValueForType(field.type),
			required: field.required,
		};

		// Generate field-specific properties based on type
		switch (field.type) {
			case 'text':
				return {
					...baseProperty,
					type: 'string',
					placeholder: field.defaultValue || 'Enter text value or use expression {{ $json.field }}',
					hint: `Text field${
						field.maxLength ? ` (max ${field.maxLength} chars)` : ''
					}. Use static text or n8n expressions. ${
						field.required ? 'This field is required.' : 'This field is optional.'
					}`,
					typeOptions: {
						...(field.maxLength && { maxLength: field.maxLength }),
						validation: field.required
							? [
									{
										type: 'required',
										properties: {
											errorMessage: `${field.name} is a required field`,
										},
									},
							  ]
							: undefined,
					},
				} as INodeProperties;

			case 'checkbox':
				return {
					...baseProperty,
					type: 'boolean',
					description: `${baseProperty.description} • Use expressions like {{ $json.agree }} for dynamic values`,
					hint: `Checkbox field. Use true/false values or expressions that evaluate to boolean. ${
						field.required ? 'This field is required.' : 'This field is optional.'
					}`,
				} as INodeProperties;

			case 'dropdown':
				if (!field.options || field.options.length === 0) {
					// Fallback to text input if no options available
					return {
						...baseProperty,
						type: 'string',
						placeholder: 'Enter dropdown value or use expression',
						description: `${baseProperty.description} • No options detected - enter value manually`,
						hint: `Dropdown field with no detected options. Enter the exact value expected by the PDF or use an expression. ${
							field.required ? 'This field is required.' : 'This field is optional.'
						}`,
					} as INodeProperties;
				}

				return {
					...baseProperty,
					type: 'options',
					hint: `Dropdown field with ${
						field.options.length
					} detected options. Select from the list or use custom value for expressions. ${
						field.required ? 'This field is required.' : 'This field is optional.'
					}`,
					options: [
						// Add empty option for optional fields
						...(!field.required
							? [
									{
										name: '(Leave Empty)',
										value: '',
										description: 'Leave this field empty',
									},
							  ]
							: []),
						// Add detected options
						...field.options.map((option) => ({
							name: option,
							value: option,
							description: `Select "${option}" - this value will be filled in the PDF`,
						})),
						// Add custom value option
						{
							name: '🔧 Custom Value / Expression',
							value: '__custom__',
							description: 'Enter a custom value or n8n expression like {{ $JSON.fieldName }}',
						},
					],
				} as INodeProperties;

			case 'radio':
				if (!field.options || field.options.length === 0) {
					// Fallback to text input if no options available
					return {
						...baseProperty,
						type: 'string',
						placeholder: 'Enter radio button value or use expression',
						description: `${baseProperty.description} • No options detected - enter value manually`,
						hint: `Radio button field with no detected options. Enter the exact option value expected by the PDF or use an expression. ${
							field.required ? 'This field is required.' : 'This field is optional.'
						}`,
					} as INodeProperties;
				}

				return {
					...baseProperty,
					type: 'options',
					hint: `Radio button field with ${
						field.options.length
					} detected options. Select one option or use custom value for expressions. ${
						field.required ? 'This field is required.' : 'This field is optional.'
					}`,
					options: [
						// Add empty option for optional fields
						...(!field.required
							? [
									{
										name: '(No Selection)',
										value: '',
										description: 'Leave this radio button unselected',
									},
							  ]
							: []),
						// Add detected options
						...field.options.map((option) => ({
							name: option,
							value: option,
							description: `Select "${option}" - this option will be selected in the PDF`,
						})),
						// Add custom value option
						{
							name: '🔧 Custom Value / Expression',
							value: '__custom__',
							description: 'Enter a custom value or n8n expression like {{ $JSON.selectedOption }}',
						},
					],
				} as INodeProperties;

			default:
				// Fallback to text input for unknown types
				return {
					...baseProperty,
					type: 'string',
					placeholder: 'Enter value or use expression',
					description: `${baseProperty.description} • Unknown field type - using text input`,
					hint: `Unknown field type detected. Using text input as fallback. Enter the value expected by the PDF field or use an expression. ${
						field.required ? 'This field is required.' : 'This field is optional.'
					}`,
				} as INodeProperties;
		}
	}

	/**
	 * Add custom value input for dropdown/radio fields when custom option is selected
	 */
	createCustomValueInput(field: IFieldInfo): INodeProperties {
		return {
			displayName: `Custom Value for ${field.name}`,
			name: `pdfField_${field.name}_custom`,
			type: 'string',
			displayOptions: {
				show: {
					pdfSource: ['url'],
					[`pdfField_${field.name}`]: ['__custom__'],
				},
			},
			default: '',
			required: field.required,
			placeholder: 'Enter custom value or n8n expression like {{ $json.field }}',
			description: `Enter a custom value for the ${field.type} field "${field.name}". Supports n8n expressions for dynamic values.`,
			hint: `This field appears when you select "Custom Value / Expression" above. Enter either a static value or use n8n expressions like {{ $json.fieldName }} to reference workflow data. ${
				field.required ? 'This field is required.' : 'This field is optional.'
			}`,
		};
	}

	/**
	 * Format field display name with enhanced visual indicators
	 */
	private formatFieldDisplayName(field: IFieldInfo): string {
		let displayName = field.name;

		// Add type indicator
		const typeIndicator = this.getFieldTypeIndicator(field.type);
		if (typeIndicator) {
			displayName = `${typeIndicator} ${displayName}`;
		}

		// Add required indicator
		if (field.required) {
			displayName += ' *';
		}

		// Add constraint info for better UX
		const constraints: string[] = [];

		if (field.options && field.options.length > 0) {
			if (field.options.length <= 3) {
				constraints.push(`[${field.options.join('|')}]`);
			} else {
				constraints.push(`[${field.options.length} options]`);
			}
		}

		if (field.type === 'text' && field.maxLength) {
			constraints.push(`max:${field.maxLength}`);
		}

		if (constraints.length > 0) {
			displayName += ` (${constraints.join(', ')})`;
		}

		return displayName;
	}

	/**
	 * Generate comprehensive field description for UI
	 */
	private generateFieldDescription(field: IFieldInfo): string {
		const parts: string[] = [];

		// Field type and requirement status
		const typeDescriptions = {
			text: 'Text input field',
			checkbox: 'Boolean checkbox field',
			radio: 'Single selection radio button',
			dropdown: 'Dropdown selection field',
		};

		const typeDesc = typeDescriptions[field.type] || 'Unknown field type';
		const reqStatus = field.required ? 'Required' : 'Optional';
		parts.push(`${typeDesc} (${reqStatus})`);

		// Additional constraints
		if (field.maxLength && field.type === 'text') {
			parts.push(`Maximum ${field.maxLength} characters`);
		}

		// Options info with better formatting
		if (field.options && field.options.length > 0) {
			if (field.options.length <= 3) {
				parts.push(`Options: ${field.options.join(', ')}`);
			} else if (field.options.length <= 5) {
				parts.push(`${field.options.length} options: ${field.options.slice(0, 3).join(', ')}, ...`);
			} else {
				parts.push(`${field.options.length} available options (see dropdown for full list)`);
			}
		}

		// Default value
		if (field.defaultValue) {
			const truncatedDefault =
				field.defaultValue.length > 20
					? `${field.defaultValue.substring(0, 20)}...`
					: field.defaultValue;
			parts.push(`Default: "${truncatedDefault}"`);
		}

		// Expression support note with examples
		if (field.type === 'checkbox') {
			parts.push('Supports expressions like {{ $json.isActive }} (boolean values)');
		} else if (field.type === 'dropdown' || field.type === 'radio') {
			parts.push(
				'Supports expressions like {{ $json.selectedOption }} (must match available options)',
			);
		} else {
			parts.push('Supports expressions like {{ $json.fieldName }} or static values');
		}

		return parts.join(' • ');
	}

	/**
	 * Get field type indicator icon
	 */
	private getFieldTypeIndicator(type: string): string {
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
	 * Get default value for field type
	 */
	private getDefaultValueForType(type: string): any {
		switch (type) {
			case 'checkbox':
				return false;
			case 'text':
			case 'dropdown':
			case 'radio':
			default:
				return '';
		}
	}

	/**
	 * Generate field validation rules based on field info
	 */
	generateFieldValidation(field: IFieldInfo): any[] {
		const validationRules: any[] = [];

		// Required field validation
		if (field.required) {
			validationRules.push({
				type: 'required',
				properties: {
					errorMessage: `${field.name} is a required field`,
				},
			});
		}

		// Text field length validation
		if (field.type === 'text' && field.maxLength) {
			validationRules.push({
				type: 'maxLength',
				properties: {
					maxLength: field.maxLength,
					errorMessage: `${field.name} must not exceed ${field.maxLength} characters`,
				},
			});
		}

		// Dropdown/radio option validation
		if (
			(field.type === 'dropdown' || field.type === 'radio') &&
			field.options &&
			field.options.length > 0
		) {
			validationRules.push({
				type: 'options',
				properties: {
					validOptions: [...field.options, '__custom__', ''],
					errorMessage: `${field.name} must be one of the available options or a custom value`,
				},
			});
		}

		return validationRules;
	}

	/**
	 * Create field mapping from dynamic field values
	 * Converts dynamic field inputs back to the standard field mapping format
	 */
	createFieldMappingFromDynamicFields(
		dynamicFieldValues: Record<string, any>,
		fields: IFieldInfo[],
	): Array<{
		pdfFieldName: string;
		valueSource: 'static' | 'expression';
		staticValue?: any;
		expression?: string;
		fieldType: string;
	}> {
		const mappings: Array<{
			pdfFieldName: string;
			valueSource: 'static' | 'expression';
			staticValue?: any;
			expression?: string;
			fieldType: string;
		}> = [];

		fields.forEach((field) => {
			const fieldKey = `pdfField_${field.name}`;
			const customFieldKey = `pdfField_${field.name}_custom`;

			let value = dynamicFieldValues[fieldKey];
			const customValue = dynamicFieldValues[customFieldKey];

			// Handle custom values for dropdown/radio fields
			if (value === '__custom__' && customValue !== undefined) {
				value = customValue;
			}

			// Skip empty optional fields
			if (!field.required && (value === '' || value === null || value === undefined)) {
				return;
			}

			// Determine if value is an expression or static
			const isExpression =
				typeof value === 'string' &&
				(value.includes('{{') || value.includes('$json') || value.includes('$node'));

			mappings.push({
				pdfFieldName: field.name,
				valueSource: isExpression ? 'expression' : 'static',
				staticValue: isExpression ? undefined : value,
				expression: isExpression ? value : undefined,
				fieldType: field.type,
			});
		});

		return mappings;
	}

	/**
	 * Validate dynamic field configuration
	 */
	validateDynamicFieldConfiguration(
		dynamicFieldValues: Record<string, any>,
		fields: IFieldInfo[],
	): { valid: boolean; errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		fields.forEach((field) => {
			const fieldKey = `pdfField_${field.name}`;
			const customFieldKey = `pdfField_${field.name}_custom`;

			let value = dynamicFieldValues[fieldKey];
			const customValue = dynamicFieldValues[customFieldKey];

			// Handle custom values
			if (value === '__custom__') {
				if (customValue === undefined || customValue === '') {
					if (field.required) {
						errors.push(`Custom value required for field "${field.name}"`);
					}
					return;
				}
				value = customValue;
			}

			// Check required fields
			if (field.required && (value === '' || value === null || value === undefined)) {
				errors.push(`Required field "${field.name}" cannot be empty`);
			}

			// Validate text field length
			if (field.type === 'text' && field.maxLength && typeof value === 'string') {
				if (value.length > field.maxLength) {
					errors.push(
						`Field "${field.name}" exceeds maximum length of ${field.maxLength} characters`,
					);
				}
			}

			// Validate dropdown/radio options
			if (
				(field.type === 'dropdown' || field.type === 'radio') &&
				field.options &&
				field.options.length > 0 &&
				value !== '' &&
				value !== '__custom__'
			) {
				const isExpression =
					typeof value === 'string' &&
					(value.includes('{{') || value.includes('$json') || value.includes('$node'));

				if (!isExpression && !field.options.includes(value)) {
					warnings.push(
						`Field "${field.name}" value "${value}" is not in the detected options. This may still work if the PDF accepts custom values.`,
					);
				}
			}

			// Validate expressions
			if (typeof value === 'string' && value.includes('{{')) {
				// Basic expression validation
				const openBraces = (value.match(/\{\{/g) || []).length;
				const closeBraces = (value.match(/\}\}/g) || []).length;

				if (openBraces !== closeBraces) {
					errors.push(`Invalid expression syntax in field "${field.name}": mismatched braces`);
				}
			}
		});

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}
}
