import { IExecuteFunctions } from 'n8n-workflow';
import {
	IFillPdfNodeParams,
	IFieldMapping,
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

	constructor(context: IExecuteFunctions, itemIndex: number) {
		this.context = context;
		this.itemIndex = itemIndex;
		this.pythonBridge = new PythonBridge();
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

			// Step 6: Handle output formatting
			const outputData = await this.formatOutput(filledPdfData, params, startTime);

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
		const fieldMappings = this.context.getNodeParameter('fieldMappings', this.itemIndex) as {
			mapping: IFieldMapping[];
		};
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
	 * Inspect PDF fields if validation is enabled
	 */
	private async inspectPdfFields(pdfData: string, params: IFillPdfNodeParams) {
		if (!params.options.validateFields) {
			// Return empty array if validation is disabled
			return [];
		}

		try {
			const fieldInspector = new FieldInspector();
			const fields = await fieldInspector.inspectPdfFields(pdfData);

			console.log(`Detected ${fields.length} PDF fields for validation`);
			return fields;
		} catch (error) {
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
	 * Map workflow data to PDF field values
	 */
	private async mapFieldValues(fieldMappings: { mapping: IFieldMapping[] }, pdfFields: any[]) {
		if (!fieldMappings.mapping || fieldMappings.mapping.length === 0) {
			console.log('No field mappings configured, returning empty values');
			return {};
		}

		try {
			const fieldMapper = new FieldMapper(this.context, this.itemIndex);
			const mappedValues = await fieldMapper.mapFieldsToValues(fieldMappings.mapping, pdfFields);

			console.log(`Mapped ${Object.keys(mappedValues).length} field values`);
			return mappedValues;
		} catch (error) {
			throw new FillPdfValidationError(
				this.context.getNode(),
				`Field mapping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{
					component: 'PDF Processor',
					operation: 'mapFieldValues',
					itemIndex: this.itemIndex,
					originalError: error instanceof Error ? error : undefined,
				},
				{
					troubleshootingHints: [
						{
							issue: 'Field mapping validation failed',
							solution: 'Check your field mappings and ensure input data matches expected types',
							priority: 'high',
						},
					],
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
	): Promise<INodeOutputData> {
		const processingTime = Date.now() - startTime;
		const fieldsProcessed = Object.keys(params.fieldMappings.mapping || []).length;

		// Create metadata for output
		const metadata = {
			originalFieldCount: fieldsProcessed, // Will be updated with actual count in future tasks
			filledFieldCount: fieldsProcessed,
			processingTime,
		};

		// Use OutputHandler to format the output
		const outputHandler = new OutputHandler(this.context, this.itemIndex);
		return await outputHandler.formatOutput(filledPdfData, params, metadata);
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
