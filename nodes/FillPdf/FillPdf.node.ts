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

import { FieldInspector } from './field-inspector';
import { PdfProcessor } from './pdf-processor';
import { OutputHandler } from './output-handler';
import { ValidationUtils } from './validation';
import { FillPdfError, ErrorUtils } from './errors';

export class FillPdf implements INodeType {
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
						description: 'Upload a PDF file directly',
					},
					{
						name: 'URL',
						value: 'url',
						description: 'Provide a URL to download the PDF',
					},
					{
						name: 'Binary Data',
						value: 'binary',
						description: 'Use PDF from previous node binary data',
					},
				],
				default: 'upload',
				required: true,
				description: 'How to provide the PDF file',
			},
			{
				displayName: 'Notice',
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						pdfSource: ['upload', 'url', 'binary'],
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
				description: 'The PDF file to fill',
				typeOptions: {
					loadOptionsMethod: 'loadPdfFields',
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
				description: 'URL to download the PDF file',
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
				description: 'Name of the binary property containing the PDF',
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
				displayName: 'Field Mappings',
				name: 'fieldMappings',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				default: { mapping: [] },
				placeholder: 'Add field mapping',
				options: [
					{
						name: 'mapping',
						displayName: 'Field Mapping',
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
								hint: 'Use n8n expressions to reference workflow data',
							},
							{
								displayName: 'Field Type',
								name: 'fieldType',
								type: 'options',
								options: [
									{
										name: 'Text Field	📝',
										value: 'text',
										description: 'Single or multi-line text input',
									},
									{
										name: 'Checkbox	☑',
										value: 'checkbox',
										description: 'Boolean checkbox field',
									},
									{
										name: 'Radio Button	◉',
										value: 'radio',
										description: 'Single selection from options',
									},
									{
										name: 'Dropdown	▼',
										value: 'dropdown',
										description: 'Selection from dropdown list',
									},
								],
								default: 'text',
								description: 'Type of the PDF field (auto-detected when field is selected)',
								hint: 'This is automatically set based on the selected PDF field',
							},
							{
								displayName: 'PDF Field Name',
								name: 'pdfFieldName',
								type: 'options',
								default: '',
								required: true,
								description: 'Name of the field in the PDF form',
								hint: 'Select from detected PDF fields. Field type and requirements are shown in the dropdown.',
							},
							{
								displayName: 'Static Value',
								name: 'staticValue',
								type: 'string',
								default: '',
								required: true,
								description: 'Static value to fill in the field',
								placeholder: 'Enter the text value',
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
					'Map workflow data to PDF form fields. Fields will be auto-detected when a PDF is selected.',
			},

			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{
						name: 'Binary Data',
						value: 'binary',
						description: 'Return filled PDF as binary data for use in workflow',
					},
					{
						name: 'Save to File',
						value: 'file',
						description: 'Save filled PDF to specified file path',
					},
					{
						name: 'Both',
						value: 'both',
						description: 'Return binary data and save to file',
					},
				],
				default: 'binary',
				required: true,
				description: 'How to output the filled PDF',
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
				description: 'Path where to save the filled PDF file',
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
						displayName: 'Flatten PDF',
						name: 'flattenPdf',
						type: 'boolean',
						default: true,
						description: 'Whether to flatten the PDF (make fields non-editable after filling)',
					},
					{
						displayName: 'Validate Fields',
						name: 'validateFields',
						type: 'boolean',
						default: true,
						description: 'Whether to validate that all mapped fields exist in the PDF',
					},
					{
						displayName: 'Skip Missing Fields',
						name: 'skipMissingFields',
						type: 'boolean',
						default: false,
						description:
							"Whether to skip fields that don't exist in the PDF instead of throwing an error",
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

					// Return empty array if no source value provided
					if (!sourceValue) {
						return [];
					}

					// Create field inspector and load fields
					const fieldInspector = new FieldInspector();
					const fields = await fieldInspector.loadPdfFields(this, pdfSource, sourceValue);

					return fields;
				} catch (error) {
					// Log error but return empty array to avoid breaking UI
					console.error('Error loading PDF fields:', error);
					return [];
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
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

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
			const fieldMappings = this.getNodeParameter('fieldMappings', 0) as { mapping: any[] };
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
				const pdfProcessor = new PdfProcessor(this, i);
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
					const pdfProcessor = new PdfProcessor(this, i);

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
