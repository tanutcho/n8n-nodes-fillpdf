// TypeScript interfaces for the FillPdf node

/**
 * Node parameter configuration interface
 */
export interface IFillPdfNodeParams {
	pdfSource: 'upload' | 'url' | 'binary';
	pdfFile?: string;
	pdfUrl?: string;
	binaryPropertyName?: string;
	fieldMappings: { mapping: IFieldMapping[] };
	outputFormat: 'binary' | 'file' | 'both';
	outputPath?: string;
	options: {
		flattenPdf?: boolean;
		validateFields?: boolean;
		skipMissingFields?: boolean;
	};
}

/**
 * Field mapping configuration
 */
export interface IFieldMapping {
	pdfFieldName: string;
	valueSource: 'static' | 'expression';
	staticValue?: string;
	expression?: string;
}

/**
 * PDF field information from inspection
 */
export interface IFieldInfo {
	name: string;
	type: 'text' | 'checkbox' | 'radio' | 'dropdown';
	required: boolean;
	options?: string[]; // For dropdown/radio fields
	maxLength?: number; // For text fields
	defaultValue?: string;
}

/**
 * Python bridge input data structure
 */
export interface IPythonInput {
	action: 'fill' | 'inspect';
	pdfData: string; // base64 encoded PDF
	fieldMappings?: Record<string, any>;
	options: {
		flatten: boolean;
		outputFormat: string;
	};
}

/**
 * Python bridge output data structure
 */
export interface IPythonOutput {
	success: boolean;
	data?: string; // base64 encoded result PDF
	fields?: IFieldInfo[];
	error?: string;
	metadata?: {
		fieldCount: number;
		processingTime: number;
	};
}

/**
 * Node execution input data
 */
export interface INodeInputData {
	json: {
		pdfData?: string;
		fieldValues?: Record<string, any>;
		[key: string]: any;
	};
	binary?: {
		[key: string]: {
			data: string;
			mimeType: string;
			fileName?: string;
			fileExtension?: string;
		};
	};
}

/**
 * Node execution output data
 */
export interface INodeOutputData {
	json: {
		success: boolean;
		fieldsProcessed: number;
		outputPath?: string;
		error?: string;
		metadata: {
			originalFieldCount: number;
			filledFieldCount: number;
			processingTime: number;
			outputFormat?: string;
			pdfSource?: string;
			timestamp?: string;

			// Enhanced metadata fields
			options?: {
				flattened?: boolean;
				fieldsValidated?: boolean;
				missingFieldsSkipped?: boolean;
			};

			processing?: {
				startTime?: string;
				endTime?: string;
				durationMs?: number;
				durationFormatted?: string;
				performanceCategory?: string;
			};

			fieldMapping?: {
				totalMappings?: number;
				successfulMappings?: number;
				failedMappings?: number;
				successRate?: number;
				mappingDetails?: Array<{
					fieldName: string;
					valueSource: string;
					hasStaticValue: boolean;
					hasExpression: boolean;
				}>;
			};

			output?: {
				format?: string;
				binaryDataIncluded?: boolean;
				fileOutputIncluded?: boolean;
				outputPath?: string;
				capabilities?: {
					supportsBatch?: boolean;
					supportsMultipleFormats?: boolean;
					supportsMetadata?: boolean;
				};
			};

			system?: {
				nodeVersion?: string;
				executionId?: string;
				platform?: string;
				nodeEnv?: string;
			};

			quality?: {
				dataIntegrity?: boolean;
				processingEfficiency?: number;
				errorRate?: number;
			};

			source?: {
				type?: string;
				file?: string;
				fileName?: string;
				fileExtension?: string;
				url?: string;
				domain?: string;
				protocol?: string;
				propertyName?: string;
				fromPreviousNode?: boolean;
			};

			fileOutput?: {
				fullPath?: string;
				fileName?: string;
				directory?: string;
				fileSize?: number;
				success?: boolean;
			};

			batch?: {
				batchId?: string;
				itemIndex?: number;
				totalItems?: number;
				itemProcessingTime?: number;
				error?: string;
			};

			batchSummary?: {
				batchId?: string;
				totalItems?: number;
				successfulItems?: number;
				failedItems?: number;
				startTime?: string;
				endTime?: string;
				totalProcessingTime?: number;
				outputPaths?: string[];
			};
		};
	};
	binary?: {
		pdf: {
			data: string;
			mimeType: string;
			fileName?: string;
			fileExtension?: string;
		};
	};
}

// Error types are now defined in errors.ts
