import { NodeOperationError, INode } from 'n8n-workflow';

/**
 * Error categories for FillPdf operations
 */
export type FillPdfErrorType = 'config' | 'runtime' | 'data' | 'python' | 'validation';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error context interface for detailed error information
 */
export interface IErrorContext {
	component?: string;
	operation?: string;
	itemIndex?: number;
	fieldName?: string;
	fileName?: string;
	url?: string;
	pythonExecutable?: string;
	exitCode?: number;
	stderr?: string;
	stdout?: string;
	originalError?: Error;
	timestamp?: string;
	nodeParameters?: Record<string, any>;
	inputData?: any;
	stackTrace?: string;
}

/**
 * Troubleshooting hint interface
 */
export interface ITroubleshootingHint {
	issue: string;
	solution: string;
	documentation?: string;
	priority: 'high' | 'medium' | 'low';
}

/**
 * Base custom error class for FillPdf operations
 * Extends n8n's NodeOperationError for compatibility
 */
export class FillPdfError extends NodeOperationError {
	public readonly errorType: FillPdfErrorType;
	public readonly severity: ErrorSeverity;
	public readonly errorContext: IErrorContext;
	public readonly troubleshootingHints: ITroubleshootingHint[];
	public readonly isRecoverable: boolean;
	public readonly errorCode: string;

	constructor(
		node: INode,
		message: string,
		errorType: FillPdfErrorType,
		options: {
			severity?: ErrorSeverity;
			context?: IErrorContext;
			troubleshootingHints?: ITroubleshootingHint[];
			isRecoverable?: boolean;
			errorCode?: string;
			description?: string;
		} = {},
	) {
		// Format message for n8n compatibility
		const formattedMessage = FillPdfError.formatErrorMessage(message, errorType, options.context);

		super(node, formattedMessage, {
			description: options.description || FillPdfError.getDefaultDescription(errorType),
			runIndex: options.context?.itemIndex,
		});

		this.errorType = errorType;
		this.severity = options.severity || FillPdfError.getDefaultSeverity(errorType);
		this.errorContext = {
			timestamp: new Date().toISOString(),
			...options.context,
		};
		this.troubleshootingHints =
			options.troubleshootingHints || FillPdfError.getDefaultHints(errorType);
		this.isRecoverable = options.isRecoverable ?? FillPdfError.getDefaultRecoverability(errorType);
		this.errorCode = options.errorCode || FillPdfError.generateErrorCode(errorType);

		// Preserve original error stack if available
		if (options.context?.originalError) {
			this.stack = options.context.originalError.stack;
		}
	}

	/**
	 * Format error message for n8n display
	 */
	private static formatErrorMessage(
		message: string,
		errorType: FillPdfErrorType,
		context?: IErrorContext,
	): string {
		const prefix = FillPdfError.getErrorPrefix(errorType);
		let formattedMessage = `${prefix}: ${message}`;

		// Add context information if available
		if (context?.component) {
			formattedMessage += ` (Component: ${context.component})`;
		}
		if (context?.operation) {
			formattedMessage += ` (Operation: ${context.operation})`;
		}
		if (context?.fieldName) {
			formattedMessage += ` (Field: ${context.fieldName})`;
		}

		return formattedMessage;
	}

	/**
	 * Get error type prefix for display
	 */
	private static getErrorPrefix(errorType: FillPdfErrorType): string {
		const prefixes: Record<FillPdfErrorType, string> = {
			config: 'Configuration Error',
			runtime: 'Runtime Error',
			data: 'Data Error',
			python: 'Python Environment Error',
			validation: 'Validation Error',
		};
		return prefixes[errorType];
	}

	/**
	 * Get default severity for error type
	 */
	private static getDefaultSeverity(errorType: FillPdfErrorType): ErrorSeverity {
		const severities: Record<FillPdfErrorType, ErrorSeverity> = {
			config: 'high',
			runtime: 'critical',
			data: 'medium',
			python: 'critical',
			validation: 'medium',
		};
		return severities[errorType];
	}

	/**
	 * Get default description for error type
	 */
	private static getDefaultDescription(errorType: FillPdfErrorType): string {
		const descriptions: Record<FillPdfErrorType, string> = {
			config: 'Check your node configuration and parameter values',
			runtime: 'Check your system environment and dependencies',
			data: 'Check your input data format and content',
			python: 'Check your Python installation and fillpdf library',
			validation: 'Check your field mappings and PDF structure',
		};
		return descriptions[errorType];
	}

	/**
	 * Get default recoverability for error type
	 */
	private static getDefaultRecoverability(errorType: FillPdfErrorType): boolean {
		const recoverability: Record<FillPdfErrorType, boolean> = {
			config: true,
			runtime: false,
			data: true,
			python: false,
			validation: true,
		};
		return recoverability[errorType];
	}

	/**
	 * Generate error code for tracking
	 */
	private static generateErrorCode(errorType: FillPdfErrorType): string {
		const timestamp = Date.now().toString(36);
		const typeCode = errorType.toUpperCase().substring(0, 3);
		return `FILLPDF_${typeCode}_${timestamp}`;
	}

	/**
	 * Get default troubleshooting hints for error type
	 */
	private static getDefaultHints(errorType: FillPdfErrorType): ITroubleshootingHint[] {
		const hints: Record<FillPdfErrorType, ITroubleshootingHint[]> = {
			config: [
				{
					issue: 'Invalid parameter configuration',
					solution: 'Review all node parameters and ensure required fields are filled',
					priority: 'high',
				},
				{
					issue: 'Missing PDF source',
					solution: 'Ensure you have selected a valid PDF source (upload, URL, or binary)',
					priority: 'high',
				},
			],
			runtime: [
				{
					issue: 'System environment issues',
					solution: 'Check system permissions and available resources',
					priority: 'high',
				},
				{
					issue: 'Process execution failure',
					solution: 'Restart the workflow and check system logs',
					priority: 'medium',
				},
			],
			data: [
				{
					issue: 'Invalid or corrupted PDF',
					solution: 'Verify the PDF file is valid and contains fillable fields',
					priority: 'high',
				},
				{
					issue: 'Incompatible field data',
					solution: 'Check that field values match the expected field types',
					priority: 'medium',
				},
			],
			python: [
				{
					issue: 'Python not found',
					solution: "Install Python 3.7+ and ensure it's in your system PATH",
					documentation: 'https://www.python.org/downloads/',
					priority: 'high',
				},
				{
					issue: 'fillpdf library missing',
					solution: 'Install fillpdf library: pip install fillpdf',
					priority: 'high',
				},
			],
			validation: [
				{
					issue: 'Field mapping validation failed',
					solution: 'Check that all mapped fields exist in the PDF',
					priority: 'medium',
				},
				{
					issue: 'Required fields missing',
					solution: 'Ensure all required PDF fields have been mapped',
					priority: 'high',
				},
			],
		};
		return hints[errorType] || [];
	}

	/**
	 * Get formatted error details for logging
	 */
	getErrorDetails(): string {
		const details = [
			`Error Code: ${this.errorCode}`,
			`Type: ${this.errorType}`,
			`Severity: ${this.severity}`,
			`Recoverable: ${this.isRecoverable}`,
			`Timestamp: ${this.errorContext.timestamp}`,
		];

		if (this.errorContext.component) {
			details.push(`Component: ${this.errorContext.component}`);
		}
		if (this.errorContext.operation) {
			details.push(`Operation: ${this.errorContext.operation}`);
		}
		if (this.errorContext.itemIndex !== undefined) {
			details.push(`Item Index: ${this.errorContext.itemIndex}`);
		}

		return details.join('\n');
	}

	/**
	 * Get troubleshooting guide as formatted string
	 */
	getTroubleshootingGuide(): string {
		if (this.troubleshootingHints.length === 0) {
			return 'No specific troubleshooting hints available.';
		}

		const sortedHints = this.troubleshootingHints.sort((a, b) => {
			const priority = { high: 3, medium: 2, low: 1 };
			return priority[b.priority] - priority[a.priority];
		});

		return sortedHints
			.map((hint, index) => {
				let guide = `${index + 1}. ${hint.issue}\n   Solution: ${hint.solution}`;
				if (hint.documentation) {
					guide += `\n   Documentation: ${hint.documentation}`;
				}
				return guide;
			})
			.join('\n\n');
	}
}
/*
 *
 * Configuration error class for invalid node parameters
 */
export class FillPdfConfigError extends FillPdfError {
	constructor(
		node: INode,
		message: string,
		context?: IErrorContext,
		options: {
			parameterName?: string;
			parameterValue?: any;
			expectedType?: string;
			troubleshootingHints?: ITroubleshootingHint[];
		} = {},
	) {
		const enhancedContext: IErrorContext = {
			...context,
			component: 'Configuration',
			operation: 'Parameter Validation',
		};

		const hints: ITroubleshootingHint[] = options.troubleshootingHints || [
			{
				issue: `Invalid parameter: ${options.parameterName || 'unknown'}`,
				solution: options.expectedType
					? `Ensure the parameter is of type: ${options.expectedType}`
					: 'Check the parameter value and format',
				priority: 'high',
			},
		];

		super(node, message, 'config', {
			severity: 'high',
			context: enhancedContext,
			troubleshootingHints: hints,
			isRecoverable: true,
			errorCode: `FILLPDF_CONFIG_${Date.now().toString(36)}`,
			description: 'Configuration error - check your node parameters',
		});
	}
}

/**
 * Runtime error class for system and execution issues
 */
export class FillPdfRuntimeError extends FillPdfError {
	constructor(
		node: INode,
		message: string,
		context?: IErrorContext,
		options: {
			systemError?: Error;
			exitCode?: number;
			troubleshootingHints?: ITroubleshootingHint[];
		} = {},
	) {
		const enhancedContext: IErrorContext = {
			...context,
			component: 'Runtime',
			operation: 'System Execution',
			originalError: options.systemError,
			exitCode: options.exitCode,
		};

		const hints: ITroubleshootingHint[] = options.troubleshootingHints || [
			{
				issue: 'System execution failure',
				solution: 'Check system resources and permissions',
				priority: 'high',
			},
			{
				issue: 'Process crashed or terminated',
				solution: 'Restart the workflow and check system logs',
				priority: 'medium',
			},
		];

		super(node, message, 'runtime', {
			severity: 'critical',
			context: enhancedContext,
			troubleshootingHints: hints,
			isRecoverable: false,
			errorCode: `FILLPDF_RUNTIME_${Date.now().toString(36)}`,
			description: 'Runtime error - check your system environment',
		});
	}
}

/**
 * Data error class for invalid input data
 */
export class FillPdfDataError extends FillPdfError {
	constructor(
		node: INode,
		message: string,
		context?: IErrorContext,
		options: {
			dataType?: string;
			expectedFormat?: string;
			actualFormat?: string;
			troubleshootingHints?: ITroubleshootingHint[];
		} = {},
	) {
		const enhancedContext: IErrorContext = {
			...context,
			component: 'Data Processing',
			operation: 'Data Validation',
		};

		const hints: ITroubleshootingHint[] = options.troubleshootingHints || [
			{
				issue: `Invalid ${options.dataType || 'data'} format`,
				solution: options.expectedFormat
					? `Expected format: ${options.expectedFormat}, received: ${
							options.actualFormat || 'unknown'
					  }`
					: 'Check the input data format and structure',
				priority: 'high',
			},
			{
				issue: 'Data corruption or incompatibility',
				solution: 'Verify the source data is valid and properly formatted',
				priority: 'medium',
			},
		];

		super(node, message, 'data', {
			severity: 'medium',
			context: enhancedContext,
			troubleshootingHints: hints,
			isRecoverable: true,
			errorCode: `FILLPDF_DATA_${Date.now().toString(36)}`,
			description: 'Data error - check your input data format',
		});
	}
}

/**
 * Python environment error class for Python-related issues
 */
export class FillPdfPythonError extends FillPdfError {
	constructor(
		node: INode,
		message: string,
		context?: IErrorContext,
		options: {
			pythonExecutable?: string;
			missingLibrary?: string;
			pythonVersion?: string;
			troubleshootingHints?: ITroubleshootingHint[];
		} = {},
	) {
		const enhancedContext: IErrorContext = {
			...context,
			component: 'Python Bridge',
			operation: 'Python Execution',
			pythonExecutable: options.pythonExecutable,
		};

		const hints: ITroubleshootingHint[] = options.troubleshootingHints || [];

		// Add specific hints based on the error type
		if (options.missingLibrary) {
			hints.push({
				issue: `Missing Python library: ${options.missingLibrary}`,
				solution: `Install the library: pip install ${options.missingLibrary}`,
				priority: 'high',
			});
		}

		if (options.pythonExecutable) {
			hints.push({
				issue: `Python executable not found: ${options.pythonExecutable}`,
				solution: 'Ensure Python is installed and accessible in your system PATH',
				documentation: 'https://www.python.org/downloads/',
				priority: 'high',
			});
		}

		if (options.pythonVersion) {
			hints.push({
				issue: `Incompatible Python version: ${options.pythonVersion}`,
				solution: 'Install Python 3.7 or higher',
				priority: 'high',
			});
		}

		// Default hints if none provided
		if (hints.length === 0) {
			hints.push(
				{
					issue: 'Python environment not properly configured',
					solution: "Install Python 3.7+ and ensure it's in your system PATH",
					documentation: 'https://www.python.org/downloads/',
					priority: 'high',
				},
				{
					issue: 'fillpdf library not installed',
					solution: 'Install fillpdf library: pip install fillpdf',
					priority: 'high',
				},
			);
		}

		super(node, message, 'python', {
			severity: 'critical',
			context: enhancedContext,
			troubleshootingHints: hints,
			isRecoverable: false,
			errorCode: `FILLPDF_PYTHON_${Date.now().toString(36)}`,
			description: 'Python environment error - check your Python installation',
		});
	}
}

/**
 * Validation error class for field mapping and PDF validation issues
 */
export class FillPdfValidationError extends FillPdfError {
	constructor(
		node: INode,
		message: string,
		context?: IErrorContext,
		options: {
			fieldName?: string;
			expectedType?: string;
			actualType?: string;
			missingFields?: string[];
			invalidFields?: string[];
			troubleshootingHints?: ITroubleshootingHint[];
		} = {},
	) {
		const enhancedContext: IErrorContext = {
			...context,
			component: 'Field Validation',
			operation: 'Field Mapping',
			fieldName: options.fieldName,
		};

		const hints: ITroubleshootingHint[] = options.troubleshootingHints || [];

		// Add specific hints based on validation issues
		if (options.missingFields && options.missingFields.length > 0) {
			hints.push({
				issue: `Missing required fields: ${options.missingFields.join(', ')}`,
				solution: 'Add mappings for all required fields or enable "Skip Missing Fields" option',
				priority: 'high',
			});
		}

		if (options.invalidFields && options.invalidFields.length > 0) {
			hints.push({
				issue: `Invalid field mappings: ${options.invalidFields.join(', ')}`,
				solution: 'Check that field names match exactly with PDF field names',
				priority: 'high',
			});
		}

		if (options.fieldName && options.expectedType && options.actualType) {
			hints.push({
				issue: `Field type mismatch for "${options.fieldName}"`,
				solution: `Expected ${options.expectedType}, but received ${options.actualType}`,
				priority: 'medium',
			});
		}

		// Default hints if none provided
		if (hints.length === 0) {
			hints.push(
				{
					issue: 'Field validation failed',
					solution: 'Check that all field mappings are correct and complete',
					priority: 'medium',
				},
				{
					issue: 'PDF structure mismatch',
					solution: 'Verify that the PDF contains the expected fillable fields',
					priority: 'medium',
				},
			);
		}

		super(node, message, 'validation', {
			severity: 'medium',
			context: enhancedContext,
			troubleshootingHints: hints,
			isRecoverable: true,
			errorCode: `FILLPDF_VALIDATION_${Date.now().toString(36)}`,
			description: 'Validation error - check your field mappings',
		});
	}
}

/**
 * Utility functions for error handling
 */
export class ErrorUtils {
	/**
	 * Create appropriate error based on error type and context
	 */
	static createError(
		node: INode,
		message: string,
		errorType: FillPdfErrorType,
		context?: IErrorContext,
		options?: any,
	): FillPdfError {
		switch (errorType) {
			case 'config':
				return new FillPdfConfigError(node, message, context, options);
			case 'runtime':
				return new FillPdfRuntimeError(node, message, context, options);
			case 'data':
				return new FillPdfDataError(node, message, context, options);
			case 'python':
				return new FillPdfPythonError(node, message, context, options);
			case 'validation':
				return new FillPdfValidationError(node, message, context, options);
			default:
				return new FillPdfError(node, message, errorType, { context, ...options });
		}
	}

	/**
	 * Wrap existing error with FillPdf context
	 */
	static wrapError(
		node: INode,
		originalError: Error,
		errorType: FillPdfErrorType,
		context?: IErrorContext,
	): FillPdfError {
		const enhancedContext: IErrorContext = {
			...context,
			originalError,
			stackTrace: originalError.stack,
		};

		return ErrorUtils.createError(node, originalError.message, errorType, enhancedContext);
	}

	/**
	 * Check if error is recoverable
	 */
	static isRecoverable(error: Error): boolean {
		if (error instanceof FillPdfError) {
			return error.isRecoverable;
		}
		return false;
	}

	/**
	 * Get error severity
	 */
	static getErrorSeverity(error: Error): ErrorSeverity {
		if (error instanceof FillPdfError) {
			return error.severity;
		}
		return 'medium';
	}

	/**
	 * Format error for logging
	 */
	static formatErrorForLogging(error: Error): string {
		if (error instanceof FillPdfError) {
			return `${error.getErrorDetails()}\n\nTroubleshooting:\n${error.getTroubleshootingGuide()}`;
		}
		return `${error.name}: ${error.message}\n${error.stack || 'No stack trace available'}`;
	}
}
