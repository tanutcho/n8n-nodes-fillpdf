import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import { FieldInspector, FieldExtractionErrorHandler } from './field-inspector';
import { PdfProcessor } from './pdf-processor';
import { OutputHandler } from './output-handler';
import { ValidationUtils } from './validation';
import { FillPdfError, ErrorUtils } from './errors';
import { UIGenerator } from './ui-generator';
import { BackwardCompatibilityManager } from './backward-compatibility';

export class FillPdf implements INodeType {
	// private uiGenerator = new UIGenerator(); // Commented out for now

	/**
	 * Process field mappings based on configuration mode
	 */
	// private processFieldMappings(context: IExecuteFunctions, itemIndex: number): { mapping: any[] } {
	// 	const pdfSource = context.getNodeParameter('pdfSource', itemIndex) as 'upload' | 'url' | 'binary';
	//
	// 	// For URL sources, check the configuration mode
	// 	if (pdfSource === 'url') {
	// 		const fieldConfigMode = context.getNodeParameter('fieldConfigMode', itemIndex, 'enhanced') as 'enhanced' | 'manual';
	//
	// 		if (fieldConfigMode === 'manual') {
	// 			// Use manual field mappings
	// 			const manualMappings = context.getNodeParameter('manualFieldMappings', itemIndex, { mapping: [] }) as { mapping: any[] };
	// 			return manualMappings;
	// 		}
	// 	}
	//
	// 	// Use enhanced field mappings (default for all sources and enhanced mode for URL)
	// 	const enhancedMappings = context.getNodeParameter('fieldMappings', itemIndex, { mapping: [] }) as { mapping: any[] };
	// 	return enhancedMappings;
	// }

	/**
	 * Validate field mapping configuration based on mode
	 */
	// private validateFieldMappingConfiguration(
	// 	context: IExecuteFunctions,
	// 	itemIndex: number,
	// 	fieldMappings: { mapping: any[] }
	// ): { valid: boolean; errors: string[]; warnings: string[] } {
	// 	const errors: string[] = [];
	// 	const warnings: string[] = [];
	// 	const pdfSource = context.getNodeParameter('pdfSource', itemIndex) as 'upload' | 'url' | 'binary';
	//
	// 	// Basic validation for all modes
	// 	if (!fieldMappings.mapping || fieldMappings.mapping.length === 0) {
	// 		warnings.push('No field mappings configured. The PDF will be processed without field values.');
	// 		return { valid: true, errors, warnings };
	// 	}

	// 	// Validate each mapping
	// 	fieldMappings.mapping.forEach((mapping, index) => {
	// 		if (!mapping.pdfFieldName) {
	// 			errors.push(`Field mapping ${index + 1}: PDF field name is required`);
	// 		}

	// 		if (!mapping.fieldType) {
	// 			errors.push(`Field mapping ${index + 1}: Field type is required`);
	// 		}

	// 		if (!mapping.valueSource) {
	// 			errors.push(`Field mapping ${index + 1}: Value source is required`);
	// 		}

	// 		// Validate value based on source
	// 		if (mapping.valueSource === 'static') {
	// 			if (mapping.fieldType === 'checkbox') {
	// 				if (mapping.staticValue === undefined || mapping.staticValue === null) {
	// 					errors.push(`Field mapping ${index + 1}: Checkbox value is required for static value source`);
	// 				}
	// 			} else {
	// 				if (!mapping.staticValue && mapping.staticValue !== false && mapping.staticValue !== 0) {
	// 					errors.push(`Field mapping ${index + 1}: Static value is required for static value source`);
	// 				}
	// 			}
	// 		} else if (mapping.valueSource === 'expression') {
	// 			if (!mapping.expression) {
	// 				errors.push(`Field mapping ${index + 1}: Expression is required for expression value source`);
	// 			} else {
	// 				// Basic expression validation
	// 				const expr = mapping.expression;
	// 				if (typeof expr === 'string' && expr.includes('{{')) {
	// 					const openBraces = (expr.match(/\{\{/g) || []).length;
	// 					const closeBraces = (expr.match(/\}\}/g) || []).length;
	// 					if (openBraces !== closeBraces) {
	// 						errors.push(`Field mapping ${index + 1}: Invalid expression syntax - mismatched braces`);
	// 					}
	// 				}
	// 			}
	// 		}
	// 	});

	// 	// Additional validation for manual mode
	// 	if (pdfSource === 'url') {
	// 		const fieldConfigMode = context.getNodeParameter('fieldConfigMode', itemIndex, 'enhanced') as 'enhanced' | 'manual';
	//
	// 		if (fieldConfigMode === 'manual') {
	// 			warnings.push('Using manual field configuration mode. Field names and types are not automatically validated against the PDF.');
	// 		}
	// 	}

	// 	return { valid: errors.length === 0, errors, warnings };
	// }

	description: INodeTypeDescription = {
		displayName: 'Fill PDF',
		name: 'fillPdf',
		icon: 'file:fillpdf.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Fill PDF forms with data from your workflow',
		defaults: {
			name: 'Fill PDF',
		},
		requestDefaults: {
			baseURL: '',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'PDF Source',
				name: 'pdfSource',
				type: 'options',
				options: [
					{
						name: 'Upload File',
						value: 'upload',
						description:
							'Upload a PDF file directly - fields extracted at runtime and logged during execution',
					},
					{
						name: 'URL',
						value: 'url',
						description:
							'Provide a URL to download the PDF - fields extracted immediately with real-time interface updates',
					},
					{
						name: 'Binary Data',
						value: 'binary',
						description:
							'Use PDF from previous node binary data - fields extracted at runtime and logged during execution',
					},
				],
				default: 'upload',
				required: true,
				description:
					'Choose how to provide the PDF file. URL sources support real-time field extraction, while Upload and Binary sources extract fields during workflow execution.',
				hint: 'For the best experience with automatic field detection, use URL sources when possible. Upload and Binary sources will show extracted fields in execution logs.',
			},
			{
				displayName: 'Upload PDF Field Extraction',
				name: 'uploadNotice',
				type: 'notice',
				default:
					'📁 Upload PDF Field Extraction\n\nPDF fields cannot be extracted during configuration for uploaded files due to n8n limitations. When your workflow runs, the node will:\n\n✅ Extract all fillable fields from your PDF\n✅ Display field names, types, and requirements in execution logs\n✅ Use your configured field mappings to fill the PDF\n✅ Validate field names against the actual PDF structure\n\n💡 Pro Tips:\n• Use manual field mapping below to configure field values\n• Check execution logs after running to see all available fields\n• Switch to URL source for real-time field detection during configuration\n• Field names are case-sensitive and must match exactly',
				displayOptions: {
					show: {
						pdfSource: ['upload'],
					},
				},
				typeOptions: {
					theme: 'info',
				},
			},
			{
				displayName: 'URL PDF Field Extraction',
				name: 'urlNotice',
				type: 'notice',
				default:
					'🌐 URL PDF Field Extraction (Recommended)\n\nPDF fields will be automatically extracted when you enter a valid PDF URL. The enhanced extraction system will:\n\n✨ Download and analyze your PDF in real-time\n✨ Show all fillable fields with type indicators (📝 text, ☑️ checkbox, 📋 dropdown)\n✨ Display field requirements and constraints\n✨ Extract dropdown options automatically\n✨ Update the interface dynamically as you type\n✨ Cache results for better performance\n\n🚀 Best Experience: This source provides the most intuitive field configuration experience with immediate visual feedback and automatic validation.',
				displayOptions: {
					show: {
						pdfSource: ['url'],
					},
				},
				typeOptions: {
					theme: 'success',
				},
			},
			{
				displayName: 'Binary PDF Field Extraction',
				name: 'binaryNotice',
				type: 'notice',
				default:
					'📊 Binary PDF Field Extraction\n\nPDF fields cannot be extracted during configuration for binary data from previous nodes due to n8n limitations. When your workflow runs, the node will:\n\n✅ Extract all fillable fields from the binary PDF data\n✅ Display comprehensive field information in execution logs\n✅ Show field names, types, requirements, and available options\n✅ Use your configured field mappings to fill the PDF\n✅ Validate field mappings against the actual PDF structure\n\n💡 Configuration Tips:\n• Use manual field mapping below to configure values\n• Binary property name must match the output from previous node\n• Check execution logs after running to see extracted field details\n• Consider using URL source for PDFs available via HTTP for better UX',
				displayOptions: {
					show: {
						pdfSource: ['binary'],
					},
				},
				typeOptions: {
					theme: 'info',
				},
			},
			{
				displayName: 'PDF File',
				name: 'pdfFile',
				type: 'string',
				displayOptions: {
					show: {
						pdfSource: ['upload'],
					},
				},
				default: '',
				required: true,
				placeholder: 'Select PDF file...',
				description:
					'Upload the PDF file to fill. The file should contain fillable form fields for automatic field extraction.',
				hint: 'Supported formats: PDF files with fillable form fields. Maximum recommended size: 50MB for optimal performance. Fields will be extracted and logged during workflow execution.',
				typeOptions: {
					loadOptionsMethod: 'getPdfFields',
				},
			},
			{
				displayName: 'PDF URL',
				name: 'pdfUrl',
				type: 'string',
				displayOptions: {
					show: {
						pdfSource: ['url'],
					},
				},
				default: '',
				required: true,
				placeholder: 'https://example.com/form.pdf',
				description:
					'URL to download the PDF file. Fields will be extracted automatically when you enter a valid URL.',
				hint: 'Enter a direct URL to a PDF file. The PDF will be downloaded and analyzed for fillable fields. Results are cached for 5 minutes for better performance. Supports HTTP and HTTPS URLs.',
				typeOptions: {
					validation: [
						{
							type: 'regex',
							properties: {
								regex: '^https?://.*\\.pdf$',
								errorMessage: 'Please enter a valid PDF URL',
							},
						},
					],
				},
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				displayOptions: {
					show: {
						pdfSource: ['binary'],
					},
				},
				default: 'data',
				required: true,
				description: 'Name of the binary property containing the PDF data from the previous node',
				hint: 'This should match the binary property name from the previous node output. Common names: "data", "file", "pdf". Check the previous node\'s output to confirm the correct property name.',
				typeOptions: {
					validation: [
						{
							type: 'regex',
							properties: {
								regex: '^[a-zA-Z_][a-zA-Z0-9_]*$',
								errorMessage: 'Property name must be a valid identifier',
							},
						},
					],
				},
			},
			{
				displayName: 'Field Configuration Mode',
				name: 'fieldConfigMode',
				type: 'options',
				options: [
					{
						name: 'Enhanced Automatic (Recommended)',
						value: 'enhanced',
						description:
							'Automatic field detection with smart UI generation, type indicators, and validation - best user experience',
					},
					{
						name: 'Manual Configuration',
						value: 'manual',
						description:
							'Traditional manual field mapping without automatic detection - full control but requires more setup',
					},
				],
				default: 'enhanced',
				displayOptions: {
					show: {
						pdfSource: ['url'],
					},
				},
				description:
					'Choose how to configure PDF field values. Enhanced mode provides automatic field detection and smart UI generation.',
				hint: 'Enhanced mode is recommended for most users as it automatically detects fields, shows types and requirements, and provides better validation. Use manual mode only if you need full control over field configuration.',
			},
			{
				displayName: 'Enhanced Field Configuration',
				name: 'enhancedFieldNotice',
				type: 'notice',
				default:
					'🚀 Enhanced Field Configuration\n\nThe field mapping interface below is enhanced with automatic field detection:\n\n✨ Features:\n• Automatic field type detection and icons\n• Required field indicators\n• Dropdown options extraction\n• Field descriptions and constraints\n• Smart default values\n• Expression validation hints\n\n💡 Fields are automatically detected from your PDF URL.',
				displayOptions: {
					show: {
						pdfSource: ['url'],
						fieldConfigMode: ['enhanced'],
					},
				},
				typeOptions: {
					theme: 'success',
				},
			},
			{
				displayName: 'Manual Configuration Mode',
				name: 'manualFieldNotice',
				type: 'notice',
				default:
					'⚙️ Manual Field Configuration\n\nYou are using manual field configuration mode. This provides full control but requires more setup:\n\n📝 Manual Setup:\n• Field names must be entered exactly as they appear in the PDF\n• Field types must be selected manually\n• No automatic validation or dropdown options\n• Requires knowledge of PDF field structure\n\n💡 Switch to "Enhanced Automatic" mode for easier configuration.',
				displayOptions: {
					show: {
						pdfSource: ['url'],
						fieldConfigMode: ['manual'],
					},
				},
				typeOptions: {
					theme: 'info',
				},
			},
			{
				displayName: 'Enhanced Field Mappings',
				name: 'fieldMappings',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				default: { mapping: [] },
				placeholder: 'Add enhanced field mapping',
				displayOptions: {
					show: {
						pdfSource: ['upload', 'binary'],
					},
					hide: {
						pdfSource: ['url'],
						fieldConfigMode: ['manual'],
					},
				},
				options: [
					{
						name: 'mapping',
						displayName: 'Enhanced Field Mapping',
						values: [
							{
								displayName: 'Checkbox Value',
								name: 'staticValue',
								type: 'boolean',
								default: false,
								required: true,
								description: 'Whether to check or uncheck the checkbox field',
							},
							{
								displayName: 'Expression',
								name: 'expression',
								type: 'string',
								default: '',
								required: true,
								placeholder: "={{$json['fieldName' ]}}",
								description: 'Expression to evaluate for the field value',
								hint: 'Use n8n expressions to reference workflow data. Field constraints are shown in field selection.',
							},
							{
								displayName: 'Field Type',
								name: 'fieldType',
								type: 'options',
								options: [
									{
										name: 'Text Field\t📝',
										value: 'text',
										description: 'Single or multi-line text input',
									},
									{
										name: 'Checkbox\t☑',
										value: 'checkbox',
										description: 'Boolean checkbox field',
									},
									{
										name: 'Radio Button\t◉',
										value: 'radio',
										description: 'Single selection from options',
									},
									{
										name: 'Dropdown\t▼',
										value: 'dropdown',
										description: 'Selection from dropdown list',
									},
								],
								default: 'text',
								description: 'Type of the PDF field (automatically detected from PDF)',
								hint: 'This is automatically set when you select a PDF field above',
							},
							{
								displayName: 'PDF Field Name',
								name: 'pdfFieldName',
								type: 'options',
								default: '',
								required: true,
								description: 'Select from automatically detected PDF fields',
								hint: 'Field type, requirements, and options are automatically detected and shown in the dropdown.',
							},
							{
								displayName: 'Static Value',
								name: 'staticValue',
								type: 'string',
								default: '',
								required: true,
								description: 'Static value to fill in the field',
								placeholder: 'Enter the text value (dropdown options shown in field selection)',
							},
							{
								displayName: 'Value Source',
								name: 'valueSource',
								type: 'options',
								options: [
									{
										name: 'Static Value',
										value: 'static',
										description: 'Use a fixed value',
									},
									{
										name: 'Expression',
										value: 'expression',
										description: 'Use an n8n expression',
									},
								],
								default: 'static',
								required: true,
								description: 'How to determine the field value',
							},
						],
					},
				],
				description:
					'Map workflow data to PDF form fields. For URL sources, fields are automatically detected with type information and validation. For Upload/Binary sources, use manual mapping and check execution logs for available fields.',
				hint: 'Each field mapping connects a PDF form field to a value from your workflow. Use static values for fixed text or expressions like {{ $json.fieldName }} for dynamic data. Field types and requirements are shown when available.',
			},
			{
				displayName: 'Manual Field Mappings',
				name: 'manualFieldMappings',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				default: { mapping: [] },
				placeholder: 'Add manual field mapping',
				displayOptions: {
					show: {
						pdfSource: ['url'],
						fieldConfigMode: ['manual'],
					},
				},
				options: [
					{
						name: 'mapping',
						displayName: 'Manual Field Mapping',
						values: [
							{
								displayName: 'Checkbox Value',
								name: 'staticValue',
								type: 'boolean',
								default: false,
								required: true,
								description: 'Whether to check or uncheck the checkbox field',
							},
							{
								displayName: 'Expression',
								name: 'expression',
								type: 'string',
								default: '',
								required: true,
								placeholder: "={{$json['fieldName' ]}}",
								description: 'Expression to evaluate for the field value',
								hint: 'Use n8n expressions to reference workflow data. Ensure the result matches the expected field format.',
							},
							{
								displayName: 'Field Type',
								name: 'fieldType',
								type: 'options',
								options: [
									{
										name: 'Text Field\t📝',
										value: 'text',
										description: 'Single or multi-line text input',
									},
									{
										name: 'Checkbox\t☑',
										value: 'checkbox',
										description: 'Boolean checkbox field',
									},
									{
										name: 'Radio Button\t◉',
										value: 'radio',
										description: 'Single selection from options',
									},
									{
										name: 'Dropdown\t▼',
										value: 'dropdown',
										description: 'Selection from dropdown list',
									},
								],
								default: 'text',
								required: true,
								description: 'Type of the PDF field (must be selected manually)',
								hint: 'Choose the correct field type based on your knowledge of the PDF structure',
							},
							{
								displayName: 'PDF Field Name',
								name: 'pdfFieldName',
								type: 'string',
								default: '',
								required: true,
								description: 'Exact name of the field in the PDF form',
								placeholder: 'Enter exact field name (case-sensitive)',
								hint: 'Field names must match exactly as they appear in the PDF. No automatic detection in manual mode.',
							},
							{
								displayName: 'Static Value',
								name: 'staticValue',
								type: 'string',
								default: '',
								required: true,
								description: 'Static value to fill in the field',
								placeholder: 'Enter the exact value expected by the PDF field',
								hint: 'For dropdown/radio fields, enter the exact option value as it appears in the PDF',
							},
							{
								displayName: 'Value Source',
								name: 'valueSource',
								type: 'options',
								options: [
									{
										name: 'Static Value',
										value: 'static',
										description: 'Use a fixed value',
									},
									{
										name: 'Expression',
										value: 'expression',
										description: 'Use an n8n expression',
									},
								],
								default: 'static',
								required: true,
								description: 'How to determine the field value',
							},
						],
					},
				],
				description:
					'Manually configure field mappings without automatic detection. Requires exact field names and types. Use this mode when you need full control or when automatic detection is not available.',
				hint: 'Manual mode requires you to know the exact field names and types from your PDF. Field names are case-sensitive and must match exactly. No automatic validation is performed.',
			},

			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Binary Data',
						value: 'binary',
						description:
							'Return filled PDF as binary data - ideal for email attachments, further processing, or API responses',
					},
					{
						name: 'Save to File',
						value: 'file',
						description:
							'Save filled PDF to specified file path - useful for archival, batch processing, or file system storage',
					},
					{
						name: 'Both',
						value: 'both',
						description:
							'Return binary data AND save to file - maximum flexibility for workflows that need both options',
					},
				],
				default: 'binary',
				required: true,
				description: 'Choose how to output the filled PDF based on your workflow needs',
				hint: 'Binary data is most common for email attachments and API responses. File output is better for archival and batch processing. Both option provides maximum flexibility.',
			},
			{
				displayName: 'Output Path',
				name: 'outputPath',
				type: 'string',
				displayOptions: {
					show: {
						outputFormat: ['file', 'both'],
					},
				},
				default: '',
				required: true,
				placeholder: '/path/to/output/filled-form.pdf',
				description:
					'Full file path where the filled PDF will be saved. Supports n8n expressions for dynamic file names.',
				hint: 'Use absolute paths for reliability. Supports expressions like "/output/{{ $json.customerName }}_contract.pdf" for dynamic naming. Ensure the directory exists and is writable.',
				typeOptions: {
					validation: [
						{
							type: 'regex',
							properties: {
								regex: '.*\\.pdf$',
								errorMessage: 'Output path must end with .pdf extension',
							},
						},
					],
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Enable Field Caching',
						name: 'enableFieldCaching',
						type: 'boolean',
						default: true,
						description:
							'Whether to cache field extraction results for better performance (URL sources only)',
						hint: 'Caching improves performance by storing field extraction results for 5 minutes. Disable if you need fresh extraction every time.',
					},
					{
						displayName: 'Field Extraction Timeout',
						name: 'extractionTimeout',
						type: 'number',
						default: 30,
						description: 'Timeout in seconds for PDF field extraction (URL sources only)',
						hint: 'Increase for large PDFs or slow network connections. Decrease for faster failure detection. Only applies to URL-based field extraction.',
						typeOptions: {
							minValue: 5,
							maxValue: 120,
						},
					},
					{
						displayName: 'Flatten PDF',
						name: 'flattenPdf',
						type: 'boolean',
						default: true,
						description:
							'Whether to flatten the PDF after filling (makes fields non-editable and improves compatibility)',
						hint: 'Flattening removes form fields and makes the PDF read-only. Recommended for final documents. Disable if you need to edit the PDF later.',
					},
					{
						displayName: 'Skip Missing Fields',
						name: 'skipMissingFields',
						type: 'boolean',
						default: false,
						description:
							"Whether to skip fields that don't exist in the PDF instead of throwing an error",
						hint: 'Enable this for fault-tolerant processing when field names might not match exactly. Useful for batch processing with varying PDF structures.',
					},
					{
						displayName: 'Validate Fields',
						name: 'validateFields',
						type: 'boolean',
						default: true,
						description:
							'Whether to validate that all mapped fields exist in the PDF before processing',
						hint: 'Field validation prevents errors by checking field names against the PDF structure. Disable only if you need to work with dynamic field names.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			// Method to load PDF fields dynamically when a PDF is selected
			async getPdfFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					// Get current node parameters
					const pdfSource = this.getNodeParameter('pdfSource', 0) as 'upload' | 'url' | 'binary';
					let sourceValue = '';

					// Get source value based on PDF source type
					switch (pdfSource) {
						case 'upload':
							sourceValue = (this.getNodeParameter('pdfFile', 0) as string) || '';
							break;
						case 'url':
							sourceValue = (this.getNodeParameter('pdfUrl', 0) as string) || '';
							break;
						case 'binary':
							sourceValue = (this.getNodeParameter('binaryPropertyName', 0) as string) || 'data';
							break;
					}

					// Handle different PDF sources with appropriate error handling
					switch (pdfSource) {
						case 'upload':
							// Upload files cannot be accessed in loadOptions context
							return [
								{
									name: '⚠️ PDF Fields Will Be Extracted when Workflow Runs',
									value: '__upload_notice__',
									description:
										'Upload files cannot be accessed during configuration. Fields will be extracted and logged during workflow execution.',
								},
								{
									name: '💡 Use Manual Field Mapping for Now',
									value: '__manual_notice__',
									description:
										'You can configure field mappings manually, or switch to URL source for automatic field detection',
								},
							];

						case 'binary':
							// Binary data cannot be accessed in loadOptions context
							return [
								{
									name: '⚠️ PDF Fields Will Be Extracted when Workflow Runs',
									value: '__binary_notice__',
									description:
										'Binary data cannot be accessed during configuration. Fields will be extracted and logged during workflow execution.',
								},
								{
									name: '💡 Use Manual Field Mapping for Now',
									value: '__manual_notice__',
									description:
										'You can configure field mappings manually, or switch to URL source for automatic field detection',
								},
							];

						case 'url':
							// URL source can be processed in loadOptions context with enhanced caching
							if (!sourceValue) {
								return [
									{
										name: '📝 Enter PDF URL to See Available Fields',
										value: '__url_empty__',
										description:
											'PDF fields will appear here after you enter a valid PDF URL. Fields are cached for better performance.',
									},
								];
							}

							// Create field inspector and load fields from URL with caching
							const fieldInspector = new FieldInspector();
							const fieldOptions = await fieldInspector.loadPdfFields(this, pdfSource, sourceValue);

							// If no fields found, provide helpful message
							if (fieldOptions.length === 0) {
								return [
									{
										name: '❌ No Fillable Fields Found in PDF',
										value: '__no_fields__',
										description:
											'This PDF does not contain fillable form fields, or field extraction failed',
									},
									{
										name: '💡 You Can Still Use Manual Field Mapping',
										value: '__manual_fallback__',
										description: 'Switch to manual field mapping if you need to work with this PDF',
									},
								];
							}

							// Filter out system messages and enhance field options for better UI
							const validFields = fieldOptions.filter((option) => !option.value.startsWith('__'));

							if (validFields.length === 0) {
								return fieldOptions; // Return original options if no valid fields
							}

							// Add cache info and field count to first field for user awareness
							if (validFields.length > 0) {
								const cacheStatus = fieldInspector.getCacheStatus
									? fieldInspector.getCacheStatus(sourceValue)
									: null;
								const cacheInfo = cacheStatus?.cached ? ' (Cached result)' : ' (Fresh extraction)';

								// Add summary as first option
								validFields.unshift({
									name: `📊 ${validFields.length} PDF fields detected${cacheInfo}`,
									value: '__field_summary__',
								});
							}

							return validFields;

						default:
							return [
								{
									name: '❌ Unsupported PDF Source Type',
									value: '__error__',
									description: 'Please select a valid PDF source type',
								},
							];
					}
				} catch (error) {
					// Log error for debugging but provide user-friendly message
					console.error('Error loading PDF fields:', error);

					// Use enhanced error handling for better user feedback
					if (error instanceof Error && error.name === 'FieldExtractionError') {
						const fieldError = error as any; // FieldExtractionError
						const errorHandler = new FieldExtractionErrorHandler();
						return errorHandler.createLoadOptionsErrorMessage(fieldError);
					}

					// Fallback for other error types
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					return [
						{
							name: '❌ Error Extracting PDF Fields',
							value: '__extraction_error__',
							description: `Field extraction failed: ${
								errorMessage.length > 100 ? `${errorMessage.substring(0, 100)}...` : errorMessage
							}`,
						},
						{
							name: '💡 Switch to Manual Field Mapping',
							value: '__manual_fallback__',
							description: 'Configure field mappings manually to work with this PDF',
						},
						{
							name: '🔄 Try Again',
							value: '__retry__',
							description:
								'Some errors are temporary. You can try refreshing the node configuration.',
						},
					];
				}
			},

			// Method to get field type for selected PDF field
			async getFieldType(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					// Get current parameters
					const pdfSource = this.getNodeParameter('pdfSource', 0) as 'upload' | 'url' | 'binary';
					const selectedFieldName = (this.getNodeParameter('pdfFieldName', 0) as string) || '';

					if (!selectedFieldName) {
						return [{ name: 'Text Field 📝', value: 'text' }];
					}

					let sourceValue = '';
					switch (pdfSource) {
						case 'upload':
							sourceValue = (this.getNodeParameter('pdfFile', 0) as string) || '';
							break;
						case 'url':
							sourceValue = (this.getNodeParameter('pdfUrl', 0) as string) || '';
							break;
						case 'binary':
							sourceValue = (this.getNodeParameter('binaryPropertyName', 0) as string) || 'data';
							break;
					}

					if (!sourceValue) {
						return [{ name: 'Text Field 📝', value: 'text' }];
					}

					// Get PDF data and inspect fields
					const fieldInspector = new FieldInspector();
					let pdfData: string | null = null;
					switch (pdfSource) {
						case 'upload':
							pdfData = await fieldInspector.getPdfDataFromFile(sourceValue);
							break;
						case 'url':
							pdfData = await fieldInspector.getPdfDataFromUrl(sourceValue);
							break;
						case 'binary':
							pdfData = await fieldInspector.getPdfDataFromBinary(this, sourceValue);
							break;
					}

					if (!pdfData) {
						return [{ name: 'Text Field 📝', value: 'text' }];
					}

					const fields = await fieldInspector.inspectPdfFields(pdfData);
					const selectedField = fields.find((f) => f.name === selectedFieldName);

					if (!selectedField) {
						return [{ name: 'Text Field 📝', value: 'text' }];
					}

					// Return the detected field type
					const typeMap: Record<string, string> = {
						text: 'Text Field 📝',
						checkbox: 'Checkbox ☑',
						radio: 'Radio Button ◉',
						dropdown: 'Dropdown ▼',
					};

					const typeName = typeMap[selectedField.type] || 'Text Field 📝';
					return [{ name: typeName, value: selectedField.type }];
				} catch (error) {
					console.error('Error getting field type:', error);
					return [{ name: 'Text Field 📝', value: 'text' }];
				}
			},

			// Method to generate dynamic field properties for URL sources
			async getDynamicFieldProperties(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				try {
					const pdfSource = this.getNodeParameter('pdfSource', 0) as 'upload' | 'url' | 'binary';

					// Only generate dynamic properties for URL sources
					if (pdfSource !== 'url') {
						return [];
					}

					const pdfUrl = (this.getNodeParameter('pdfUrl', 0) as string) || '';

					if (!pdfUrl) {
						return [];
					}

					// Extract fields using field inspector
					const fieldInspector = new FieldInspector();
					const fieldOptions = await fieldInspector.loadPdfFields(this, pdfSource, pdfUrl);

					// Convert field options back to field info for UI generation
					const fields = fieldOptions
						.filter((option) => !option.value.startsWith('__'))
						.map((option) => {
							// Parse field info from the option name (since description doesn't exist)
							const description = option.name || '';

							// Extract field type from description
							let type: 'text' | 'checkbox' | 'radio' | 'dropdown' = 'text';
							if (description.includes('checkbox')) type = 'checkbox';
							else if (description.includes('radio')) type = 'radio';
							else if (description.includes('dropdown')) type = 'dropdown';

							// Extract required status
							const required = description.includes('Required');

							// Extract options if present
							let options: string[] | undefined;
							const optionsMatch = description.match(/Options: ([^•]+)/);
							if (optionsMatch) {
								options = optionsMatch[1].split(', ').map((opt: string) => opt.trim());
							}

							// Extract max length
							let maxLength: number | undefined;
							const maxLengthMatch = description.match(/Maximum (\d+) characters/);
							if (maxLengthMatch) {
								maxLength = parseInt(maxLengthMatch[1]);
							}

							// Extract default value
							let defaultValue: string | undefined;
							const defaultMatch = description.match(/Default: "([^"]+)"/);
							if (defaultMatch) {
								defaultValue = defaultMatch[1];
							}

							return {
								name: option.value,
								type,
								required,
								options,
								maxLength,
								defaultValue,
							};
						});

					// Generate UI properties using UI generator
					const uiGenerator = new UIGenerator();
					const dynamicProperties = uiGenerator.generateFieldProperties(fields);

					// Convert properties to options format for n8n
					return dynamicProperties.map((prop, index) => ({
						name: prop.displayName || prop.name,
						value: `dynamic_property_${index}`,
						description: prop.description || 'Dynamic PDF field property',
					}));
				} catch (error) {
					console.error('Error generating dynamic field properties:', error);
					return [
						{
							name: '❌ Error Generating Dynamic Fields',
							value: '__error__',
							description: `Failed to generate dynamic field properties: ${
								error instanceof Error ? error.message : 'Unknown error'
							}`,
						},
					];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Initialize backward compatibility manager
		const compatibilityManager = new BackwardCompatibilityManager(this);

		// Log compatibility status
		compatibilityManager.logCompatibilityStatus(0);

		// Log migration information if applicable
		compatibilityManager.logMigrationInformation(0);

		// Ensure parameter compatibility
		compatibilityManager.ensureParameterCompatibility(0);

		// Perform comprehensive validation before processing
		try {
			const validator = new ValidationUtils(this, 0);

			// Validate node parameters
			const paramValidation = await validator.validateNodeParameters();
			if (!paramValidation.isValid) {
				throw new NodeOperationError(
					this.getNode(),
					`Parameter validation failed: ${paramValidation.errors.join(', ')}`,
				);
			}

			// Log warnings if any
			if (paramValidation.warnings.length > 0) {
				console.warn('Parameter validation warnings:', paramValidation.warnings);
			}

			// Validate field mappings with backward compatibility
			const compatibilityValidation =
				compatibilityManager.validateFieldMappingsWithCompatibility(0);
			if (!compatibilityValidation.valid) {
				throw new NodeOperationError(
					this.getNode(),
					`Field mapping validation failed: ${compatibilityValidation.errors.join(', ')}`,
				);
			}

			// Log compatibility warnings
			if (compatibilityValidation.warnings.length > 0) {
				console.warn('Backward compatibility warnings:', compatibilityValidation.warnings);
			}

			// Validate input data
			const inputValidation = validator.validateInputData();
			if (!inputValidation.isValid) {
				throw new NodeOperationError(
					this.getNode(),
					`Input data validation failed: ${inputValidation.errors.join(', ')}`,
				);
			}

			// Perform safety checks
			const safetyCheck = await validator.performSafetyChecks();
			if (!safetyCheck.isSafe) {
				console.warn('Safety check warnings:', safetyCheck.risks);
				console.warn('Safety recommendations:', safetyCheck.recommendations);
			}

			// Validate field mapping configuration
			// const fieldMappings = this.processFieldMappings(this, 0);
			// const mappingValidation = this.validateFieldMappingConfiguration(this, 0, fieldMappings);

			// if (!mappingValidation.valid) {
			// 	throw new NodeOperationError(
			// 		this.getNode(),
			// 		`Field mapping validation failed: ${mappingValidation.errors.join(', ')}`,
			// 	);
			// }

			// // Log field mapping warnings
			// if (mappingValidation.warnings.length > 0) {
			// 	console.warn('Field mapping warnings:', mappingValidation.warnings);
			// }
		} catch (error) {
			if (error instanceof FillPdfError) {
				throw error;
			}
			throw ErrorUtils.wrapError(
				this.getNode(),
				error instanceof Error ? error : new Error('Unknown validation error'),
				'config',
				{ component: 'Parameter Validation', operation: 'execute' },
			);
		}

		// Helper function to determine if batch processing should be used
		const shouldUseBatchProcessing = (): boolean => {
			try {
				const outputFormat = this.getNodeParameter('outputFormat', 0) as string;
				return items.length > 1 && (outputFormat === 'file' || outputFormat === 'both');
			} catch {
				return false;
			}
		};

		// Helper function to get batch parameters
		const getBatchParameters = () => {
			const pdfSource = this.getNodeParameter('pdfSource', 0) as 'upload' | 'url' | 'binary';
			const fieldMappings = compatibilityManager.getCompatibleFieldMappings(0);
			const outputFormat = this.getNodeParameter('outputFormat', 0) as 'binary' | 'file' | 'both';
			const options = this.getNodeParameter('options', 0, {}) as any;

			let pdfFile: string | undefined;
			let pdfUrl: string | undefined;
			let binaryPropertyName: string | undefined;
			let outputPath: string | undefined;

			switch (pdfSource) {
				case 'upload':
					pdfFile = this.getNodeParameter('pdfFile', 0) as string;
					break;
				case 'url':
					pdfUrl = this.getNodeParameter('pdfUrl', 0) as string;
					break;
				case 'binary':
					binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
					break;
			}

			if (outputFormat === 'file' || outputFormat === 'both') {
				outputPath = this.getNodeParameter('outputPath', 0) as string;
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
		};

		// Helper function to process batch
		const processBatch = async (items: any[]): Promise<INodeExecutionData[]> => {
			const startTime = Date.now();
			const pdfDataArray: string[] = [];
			const params = getBatchParameters();

			// Collect PDF data from all items
			for (let i = 0; i < items.length; i++) {
				const pdfProcessor = new PdfProcessor(this, i, compatibilityManager);
				const pdfData = await pdfProcessor.getPdfData();
				pdfDataArray.push(pdfData);
			}

			// Create output handler and process batch
			const outputHandler = new OutputHandler(this, 0);
			const metadata = {
				originalFieldCount: params.fieldMappings.mapping?.length || 0,
				filledFieldCount: params.fieldMappings.mapping?.length || 0,
				processingTime: Date.now() - startTime,
			};

			// Process all PDFs in batch
			const batchResults = await outputHandler.processBatch(pdfDataArray, params, metadata);

			return batchResults.map((result: any) => ({
				json: result.json,
				binary: result.binary,
			}));
		};

		// Check if we should use batch processing
		if (shouldUseBatchProcessing()) {
			// Use batch processing for multiple items
			try {
				const batchResults = await processBatch(items);
				returnData.push(...batchResults);
			} catch (error) {
				const wrappedError =
					error instanceof FillPdfError
						? error
						: ErrorUtils.wrapError(
								this.getNode(),
								error instanceof Error ? error : new Error('Unknown batch processing error'),
								'runtime',
								{ component: 'Batch Processing', operation: 'processBatch' },
						  );

				if (this.continueOnFail()) {
					// Add error results for all items with detailed error information
					for (let i = 0; i < items.length; i++) {
						returnData.push({
							json: {
								success: false,
								error: wrappedError.message,
								errorType: wrappedError.errorType,
								errorCode: wrappedError.errorCode,
								troubleshooting: wrappedError.getTroubleshootingGuide(),
								fieldsProcessed: 0,
								metadata: {
									originalFieldCount: 0,
									filledFieldCount: 0,
									processingTime: 0,
									outputFormat: 'binary',
									pdfSource: 'unknown',
									timestamp: new Date().toISOString(),
								},
							},
						});
					}
				} else {
					throw wrappedError;
				}
			}
		} else {
			// Process items individually
			for (let i = 0; i < items.length; i++) {
				try {
					// Create PDF processor for this item
					const pdfProcessor = new PdfProcessor(this, i, compatibilityManager);

					// Process PDF with integrated workflow
					const outputData = await pdfProcessor.processPdf();

					returnData.push({
						json: outputData.json,
						binary: outputData.binary,
					});
				} catch (error) {
					const wrappedError =
						error instanceof FillPdfError
							? error
							: ErrorUtils.wrapError(
									this.getNode(),
									error instanceof Error ? error : new Error('Unknown processing error'),
									'runtime',
									{ component: 'PDF Processing', operation: 'processPdf', itemIndex: i },
							  );

					if (this.continueOnFail()) {
						returnData.push({
							json: {
								success: false,
								error: wrappedError.message,
								errorType: wrappedError.errorType,
								errorCode: wrappedError.errorCode,
								troubleshooting: wrappedError.getTroubleshootingGuide(),
								fieldsProcessed: 0,
								metadata: {
									originalFieldCount: 0,
									filledFieldCount: 0,
									processingTime: 0,
									outputFormat: 'binary',
									pdfSource: 'unknown',
									timestamp: new Date().toISOString(),
								},
							},
						});
						continue;
					}
					throw wrappedError;
				}
			}
		}

		return [returnData];
	}
}
