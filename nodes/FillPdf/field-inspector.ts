import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { PythonBridge } from './python-bridge';
import { IFieldInfo, IPythonInput } from './types';
import { FillPdfError, FillPdfRuntimeError, FillPdfConfigError } from './errors';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

/**
 * Field inspector for dynamic PDF field discovery
 * Handles PDF field detection and validation for UI updates
 */
export class FieldInspector {
	private pythonBridge: PythonBridge;

	constructor(pythonExecutable?: string) {
		this.pythonBridge = new PythonBridge(pythonExecutable);
	}

	/**
	 * Load PDF fields from various sources for dynamic UI updates
	 */
	async loadPdfFields(
		context: IExecuteFunctions | ILoadOptionsFunctions,
		pdfSource: 'upload' | 'url' | 'binary',
		sourceValue: string,
	): Promise<Array<{ name: string; value: string }>> {
		try {
			// Get PDF data based on source type
			const pdfData = await this.getPdfDataBySource(context, pdfSource, sourceValue);

			if (!pdfData) {
				return [];
			}

			// Inspect PDF fields using Python bridge
			const fields = await this.inspectPdfFields(pdfData);

			// Convert to n8n loadOptions format
			return this.convertFieldsToOptions(fields);
		} catch (error) {
			// Log error but don't throw to avoid breaking UI
			console.error('Field inspection error:', error);
			return [];
		}
	}

	/**
	 * Inspect PDF fields using Python script
	 */
	async inspectPdfFields(pdfData: string): Promise<IFieldInfo[]> {
		try {
			const input: IPythonInput = {
				action: 'inspect',
				pdfData,
				options: {
					flatten: false,
					outputFormat: 'binary',
				},
			};

			const result = await this.pythonBridge.executePythonScript(input);

			if (!result.success) {
				throw new Error(result.error || 'PDF inspection failed');
			}

			return result.fields || [];
		} catch (error) {
			if (error instanceof FillPdfError) {
				throw error;
			}
			const dummyNode = {
				id: 'field-inspector',
				name: 'Field Inspector',
				type: 'fillPdf',
				typeVersion: 1,
			};
			throw new FillPdfRuntimeError(
				dummyNode as any,
				`PDF field inspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{
					component: 'Field Inspector',
					operation: 'inspectPdfFields',
					originalError: error instanceof Error ? error : undefined,
				},
			);
		}
	}

	/**
	 * Get PDF data based on source type
	 */
	private async getPdfDataBySource(
		context: IExecuteFunctions | ILoadOptionsFunctions,
		pdfSource: 'upload' | 'url' | 'binary',
		sourceValue: string,
	): Promise<string | null> {
		switch (pdfSource) {
			case 'upload':
				return this.getPdfDataFromFile(sourceValue);

			case 'url':
				return this.getPdfDataFromUrl(sourceValue);

			case 'binary':
				return this.getPdfDataFromBinary(context, sourceValue);

			default:
				const dummyNode = {
					id: 'field-inspector',
					name: 'Field Inspector',
					type: 'fillPdf',
					typeVersion: 1,
				};
				throw new FillPdfConfigError(dummyNode as any, `Unsupported PDF source: ${pdfSource}`, {
					component: 'Field Inspector',
					operation: 'getPdfData',
				});
		}
	}

	/**
	 * Get PDF data from uploaded file
	 */
	async getPdfDataFromFile(filePath: string): Promise<string | null> {
		try {
			if (!filePath || !fs.existsSync(filePath)) {
				return null;
			}

			// Validate file size (50MB limit)
			const stats = fs.statSync(filePath);
			if (stats.size > 50 * 1024 * 1024) {
				throw {
					message: 'PDF file too large (>50MB). Please use a smaller file.',
					errorType: 'data' as const,
				};
			}

			// Read and encode file
			const fileBuffer = fs.readFileSync(filePath);
			return fileBuffer.toString('base64');
		} catch (error) {
			if (this.isFillPdfError(error)) {
				throw error;
			}
			throw {
				message: `Failed to read PDF file: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				errorType: 'runtime' as const,
				details: { filePath, originalError: error },
			};
		}
	}

	/**
	 * Get PDF data from URL
	 */
	async getPdfDataFromUrl(url: string): Promise<string | null> {
		try {
			if (!url || !this.isValidPdfUrl(url)) {
				return null;
			}

			const pdfBuffer = await this.downloadPdfFromUrl(url);
			return pdfBuffer.toString('base64');
		} catch (error) {
			if (this.isFillPdfError(error)) {
				throw error;
			}
			throw {
				message: `Failed to download PDF from URL: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				errorType: 'runtime' as const,
				details: { url, originalError: error },
			};
		}
	}

	/**
	 * Get PDF data from binary property
	 */
	async getPdfDataFromBinary(
		context: IExecuteFunctions | ILoadOptionsFunctions,
		propertyName: string,
	): Promise<string | null> {
		try {
			if (!propertyName) {
				return null;
			}

			// Get binary data from context - only available in IExecuteFunctions
			if (!('getInputData' in context)) {
				throw {
					message: 'Binary data access not available in current context',
					errorType: 'runtime' as const,
				};
			}

			const inputData = context.getInputData();
			const binaryData = inputData[0]?.binary?.[propertyName];

			if (!binaryData) {
				return null;
			}

			// Validate MIME type
			if (binaryData.mimeType && !binaryData.mimeType.includes('pdf')) {
				throw {
					message: `Binary data is not a PDF file. MIME type: ${binaryData.mimeType}`,
					errorType: 'data' as const,
				};
			}

			return binaryData.data;
		} catch (error) {
			if (this.isFillPdfError(error)) {
				throw error;
			}
			throw {
				message: `Failed to get PDF from binary data: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				errorType: 'runtime' as const,
				details: { propertyName, originalError: error },
			};
		}
	}

	/**
	 * Download PDF from URL with timeout and size limits
	 */
	private downloadPdfFromUrl(url: string): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const isHttps = url.startsWith('https:');
			const client = isHttps ? https : http;

			const request = client.get(
				url,
				{
					timeout: 30000, // 30 second timeout
					headers: {
						'User-Agent': 'n8n-fillpdf-node/1.0',
					},
				},
				(response) => {
					// Check response status
					if (response.statusCode !== 200) {
						reject({
							message: `HTTP ${response.statusCode}: ${response.statusMessage}`,
							errorType: 'runtime' as const,
						});
						return;
					}

					// Check content type
					const contentType = response.headers['content-type'];
					if (contentType && !contentType.includes('pdf')) {
						reject({
							message: `URL does not point to a PDF file. Content-Type: ${contentType}`,
							errorType: 'data' as const,
						});
						return;
					}

					// Check content length
					const contentLength = response.headers['content-length'];
					if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
						reject({
							message: 'PDF file too large (>50MB). Please use a smaller file.',
							errorType: 'data' as const,
						});
						return;
					}

					const chunks: Buffer[] = [];
					let totalSize = 0;

					response.on('data', (chunk: Buffer) => {
						totalSize += chunk.length;

						// Check size limit during download
						if (totalSize > 50 * 1024 * 1024) {
							request.destroy();
							reject({
								message: 'PDF file too large (>50MB). Please use a smaller file.',
								errorType: 'data' as const,
							});
							return;
						}

						chunks.push(chunk);
					});

					response.on('end', () => {
						const buffer = Buffer.concat(chunks);

						// Validate PDF signature
						if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
							reject({
								message: 'Downloaded file is not a valid PDF',
								errorType: 'data' as const,
							});
							return;
						}

						resolve(buffer);
					});

					response.on('error', (error) => {
						reject({
							message: `Download error: ${error.message}`,
							errorType: 'runtime' as const,
							details: { originalError: error },
						});
					});
				},
			);

			request.on('timeout', () => {
				request.destroy();
				reject({
					message: 'Download timeout (30 seconds). Please try again or use a different URL.',
					errorType: 'runtime' as const,
				});
			});

			request.on('error', (error) => {
				reject({
					message: `Request error: ${error.message}`,
					errorType: 'runtime' as const,
					details: { originalError: error },
				});
			});
		});
	}

	/**
	 * Validate PDF URL format
	 */
	private isValidPdfUrl(url: string): boolean {
		try {
			const urlObj = new URL(url);
			return (
				(urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
				(url.toLowerCase().endsWith('.pdf') || url.includes('.pdf'))
			);
		} catch {
			return false;
		}
	}

	/**
	 * Convert field info to n8n loadOptions format
	 */
	private convertFieldsToOptions(fields: IFieldInfo[]): Array<{ name: string; value: string }> {
		return fields.map((field) => ({
			name: this.formatFieldDisplayName(field),
			value: field.name,
		}));
	}

	/**
	 * Format field name for display in UI
	 */
	private formatFieldDisplayName(field: IFieldInfo): string {
		let displayName = field.name;

		// Add type indicator
		const typeIndicator = this.getFieldTypeIndicator(field.type);
		if (typeIndicator) {
			displayName += ` ${typeIndicator}`;
		}

		// Add required indicator
		if (field.required) {
			displayName += ' *';
		}

		// Add options info for dropdown/radio
		if (field.options && field.options.length > 0) {
			const optionsPreview = field.options.slice(0, 3).join(', ');
			const moreCount = field.options.length - 3;
			displayName += ` (${optionsPreview}${moreCount > 0 ? `, +${moreCount} more` : ''})`;
		}

		// Add max length info for text fields
		if (field.type === 'text' && field.maxLength) {
			displayName += ` (max: ${field.maxLength})`;
		}

		return displayName;
	}

	/**
	 * Get field type indicator for UI
	 */
	private getFieldTypeIndicator(type: string): string {
		switch (type) {
			case 'checkbox':
				return '☑';
			case 'radio':
				return '◉';
			case 'dropdown':
				return '▼';
			case 'text':
			default:
				return '📝';
		}
	}

	/**
	 * Type guard for FillPdfError
	 */
	private isFillPdfError(error: any): error is FillPdfError {
		return error instanceof FillPdfError;
	}

	/**
	 * Validate field mappings against detected fields
	 */
	async validateFieldMappings(
		pdfData: string,
		fieldMappings: Array<{
			pdfFieldName: string;
			valueSource: string;
			staticValue?: string;
			expression?: string;
		}>,
	): Promise<{ valid: boolean; errors: string[] }> {
		try {
			const fields = await this.inspectPdfFields(pdfData);
			const fieldNames = new Set(fields.map((f) => f.name));
			const errors: string[] = [];

			// Check if all mapped fields exist
			for (const mapping of fieldMappings) {
				if (!fieldNames.has(mapping.pdfFieldName)) {
					errors.push(`Field '${mapping.pdfFieldName}' not found in PDF`);
				}

				// Validate mapping configuration
				if (mapping.valueSource === 'static' && !mapping.staticValue) {
					errors.push(`Static value required for field '${mapping.pdfFieldName}'`);
				}

				if (mapping.valueSource === 'expression' && !mapping.expression) {
					errors.push(`Expression required for field '${mapping.pdfFieldName}'`);
				}
			}

			return {
				valid: errors.length === 0,
				errors,
			};
		} catch (error) {
			return {
				valid: false,
				errors: [
					`Field validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				],
			};
		}
	}

	/**
	 * Get Python bridge instance for external use
	 */
	getPythonBridge(): PythonBridge {
		return this.pythonBridge;
	}

	/**
	 * Set custom Python executable
	 */
	setPythonExecutable(executable: string): void {
		this.pythonBridge.setPythonExecutable(executable);
	}
}

/**
 * Utility function to create a configured field inspector instance
 */
export function createFieldInspector(pythonExecutable?: string): FieldInspector {
	return new FieldInspector(pythonExecutable);
}
