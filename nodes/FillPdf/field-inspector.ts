import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { PythonBridge } from './python-bridge';
import { IFieldInfo, IPythonInput } from './types';
import {
	FillPdfError,
	FillPdfRuntimeError,
	FillPdfConfigError,
	ITroubleshootingHint,
} from './errors';
import { fieldCache } from './field-cache';
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
	 * Load PDF fields from various sources for dynamic UI updates with caching support
	 */
	async loadPdfFields(
		context: IExecuteFunctions | ILoadOptionsFunctions,
		pdfSource: 'upload' | 'url' | 'binary',
		sourceValue: string,
	): Promise<Array<{ name: string; value: string }>> {
		try {
			// Handle different PDF sources with proper context awareness
			switch (pdfSource) {
				case 'upload':
					// Upload files cannot be accessed in loadOptions context
					if (!('getInputData' in context)) {
						throw new Error(
							'Upload PDF field extraction not available in configuration context. Fields will be extracted during workflow execution.',
						);
					}
					break;

				case 'binary':
					// Binary data cannot be accessed in loadOptions context
					if (!('getInputData' in context)) {
						throw new Error(
							'Binary PDF field extraction not available in configuration context. Fields will be extracted during workflow execution.',
						);
					}
					break;

				case 'url':
					// URL source can be processed in loadOptions context
					return await this.loadUrlPdfFieldsWithCache(sourceValue);

				default:
					throw new Error(`Unsupported PDF source: ${pdfSource}`);
			}

			// Get PDF data based on source type (for non-URL sources)
			const pdfData = await this.getPdfDataBySource(context, pdfSource, sourceValue);

			if (!pdfData) {
				return [];
			}

			// Inspect PDF fields using Python bridge
			const fields = await this.inspectPdfFields(pdfData);

			// Convert to n8n loadOptions format
			return this.convertFieldsToOptions(fields);
		} catch (error) {
			// Log error for debugging
			console.error('Field inspection error:', error);

			// Re-throw specific context errors that should be handled by loadOptions
			if (
				error instanceof Error &&
				(error.message.includes('not available in configuration context') ||
					error.message.includes('Unsupported PDF source'))
			) {
				throw error;
			}

			// For other errors, provide graceful fallback
			if (error instanceof Error && error.name === 'FieldExtractionError') {
				throw error; // Let the enhanced error be handled by loadOptions
			}

			// Convert generic errors to enhanced field extraction errors
			const errorHandler = new FieldExtractionErrorHandler();
			const enhancedError = errorHandler.handleFieldExtractionError(error, pdfSource, sourceValue);
			throw enhancedError;
		}
	}

	/**
	 * Enhanced URL-based field extraction with caching, progress tracking, and debouncing
	 */
	private async loadUrlPdfFieldsWithCache(
		url: string,
	): Promise<Array<{ name: string; value: string }>> {
		if (!url || !this.isValidPdfUrl(url)) {
			throw new Error('Invalid PDF URL provided. Please enter a valid URL ending with .pdf');
		}

		const progressTracker = new FieldExtractionProgressTracker();

		try {
			// Check cache first
			const cachedFields = fieldCache.getCachedFields('url', url);
			if (cachedFields) {
				progressTracker.logProgress('cache_hit', 'Using cached field data', {
					fieldCount: cachedFields.length,
				});
				return this.convertFieldsToOptions(cachedFields);
			}

			// Use debounced extraction to avoid repeated calls for the same URL
			const cacheKey = `url:${url}`;
			const fields = await fieldCache.debouncedExtraction(cacheKey, async () => {
				// Start extraction with progress tracking
				progressTracker.startExtraction(url);

				// Phase 1: Download PDF
				progressTracker.logProgress('download_start', 'Downloading PDF from URL');
				const downloadStartTime = Date.now();

				const pdfData = await this.getPdfDataFromUrlWithProgress(url, progressTracker);
				if (!pdfData) {
					throw new Error('Failed to download PDF from URL. Please check the URL and try again.');
				}

				const downloadTime = Date.now() - downloadStartTime;
				progressTracker.logProgress('download_complete', 'PDF download completed', {
					downloadTime,
					sizeKB: Math.round(Buffer.from(pdfData, 'base64').length / 1024),
				});

				// Phase 2: Extract fields
				progressTracker.logProgress(
					'extraction_start',
					'Analyzing PDF structure and extracting fields',
				);
				const extractionStartTime = Date.now();

				const extractedFields = await this.inspectPdfFieldsWithProgress(pdfData, progressTracker);
				const extractionTime = Date.now() - extractionStartTime;

				progressTracker.logProgress('extraction_complete', 'Field extraction completed', {
					fieldCount: extractedFields.length,
					extractionTime,
				});

				// Phase 3: Cache results
				progressTracker.logProgress('cache_store', 'Caching results for future use');
				fieldCache.cacheFields('url', url, extractedFields);

				// Complete extraction
				const totalTime = Date.now() - progressTracker.startTime;
				progressTracker.logProgress('complete', 'Field extraction completed successfully', {
					totalTime,
					fieldCount: extractedFields.length,
					cached: true,
				});

				return extractedFields;
			});

			// Convert to n8n loadOptions format
			return this.convertFieldsToOptions(fields);
		} catch (error) {
			// Log extraction failure with progress context
			const totalTime = Date.now() - progressTracker.startTime;
			progressTracker.logProgress('error', 'Field extraction failed', {
				totalTime,
				error: error instanceof Error ? error.message : 'Unknown error',
			});

			// Enhanced error handling with specific error types and troubleshooting hints
			const errorHandler = new FieldExtractionErrorHandler();
			const enhancedError = errorHandler.handleFieldExtractionError(error, 'url', url);
			throw enhancedError;
		}
	}

	/**
	 * Inspect PDF fields with progress tracking
	 */
	private async inspectPdfFieldsWithProgress(
		pdfData: string,
		progressTracker: FieldExtractionProgressTracker,
	): Promise<IFieldInfo[]> {
		try {
			progressTracker.logProgress('inspection_prepare', 'Preparing PDF for field analysis');

			const input: IPythonInput = {
				action: 'inspect',
				pdfData,
				options: {
					flatten: false,
					outputFormat: 'binary',
				},
			};

			progressTracker.logProgress('inspection_execute', 'Executing PDF field analysis');

			// Add timeout handling for field inspection
			const inspectionTimeoutMs = 45000; // 45 seconds for field inspection
			const inspectionTimeoutHandler = progressTracker.createTimeoutHandler(
				inspectionTimeoutMs,
				'PDF field analysis',
			);

			let result;
			try {
				result = await Promise.race([
					this.pythonBridge.executePythonScript(input),
					new Promise<never>((_, reject) => {
						setTimeout(() => {
							reject(progressTracker.createTimeoutError('PDF field analysis', inspectionTimeoutMs));
						}, inspectionTimeoutMs);
					}),
				]);

				clearTimeout(inspectionTimeoutHandler);
			} catch (error) {
				clearTimeout(inspectionTimeoutHandler);
				throw error;
			}

			if (!result.success) {
				throw new Error(result.error || 'PDF inspection failed');
			}

			progressTracker.logProgress('inspection_process', 'Processing extracted field data');
			const rawFields = result.fields || [];

			// Enhance field information with better type detection
			const enhancedFields: IFieldInfo[] = rawFields
				.filter((field) => field && typeof field === 'object' && field.name) // Filter out invalid fields
				.map((field) => {
					// Use enhanced type detection
					const detectedType = this.detectFieldType(field);

					// Extract dropdown options if applicable
					const options =
						detectedType === 'dropdown' || detectedType === 'radio'
							? this.extractDropdownOptions(field)
							: undefined;

					// Detect if field is required
					const required = this.detectFieldRequirement(field);

					// Extract additional metadata
					const maxLength = field.maxLength || (field as any).maxLen || undefined;
					const defaultValue =
						field.defaultValue || (field as any).default || (field as any).value || undefined;

					return {
						name: field.name,
						type: detectedType,
						required,
						options,
						maxLength,
						defaultValue: defaultValue ? String(defaultValue) : undefined,
					};
				});

			progressTracker.logProgress('inspection_sort', 'Organizing extracted fields');

			// Sort fields by type and name for better UI organization
			enhancedFields.sort((a, b) => {
				// Sort by type first (required fields first, then by type)
				if (a.required !== b.required) {
					return a.required ? -1 : 1;
				}

				const typeOrder = { checkbox: 0, radio: 1, dropdown: 2, text: 3 };
				const aOrder = typeOrder[a.type] ?? 4;
				const bOrder = typeOrder[b.type] ?? 4;

				if (aOrder !== bOrder) {
					return aOrder - bOrder;
				}

				// Finally sort by name
				return a.name.localeCompare(b.name);
			});

			return enhancedFields;
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
	 * Inspect PDF fields using Python script with enhanced type detection (legacy method)
	 */
	async inspectPdfFields(pdfData: string): Promise<IFieldInfo[]> {
		const progressTracker = new FieldExtractionProgressTracker();
		return this.inspectPdfFieldsWithProgress(pdfData, progressTracker);
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
				throw new Error(
					'Binary data access not available in loadOptions context. Use during workflow execution instead.',
				);
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
			if (
				error instanceof Error &&
				error.message.includes('not available in loadOptions context')
			) {
				throw error;
			}
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
	 * Get PDF data from URL with progress tracking
	 */
	private async getPdfDataFromUrlWithProgress(
		url: string,
		progressTracker: FieldExtractionProgressTracker,
	): Promise<string | null> {
		try {
			const pdfBuffer = await this.downloadPdfFromUrlWithProgress(url, progressTracker);
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
	 * Download PDF from URL with enhanced progress tracking and timeout handling
	 */
	private downloadPdfFromUrlWithProgress(
		url: string,
		progressTracker: FieldExtractionProgressTracker,
	): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const isHttps = url.startsWith('https:');
			const client = isHttps ? https : http;
			const timeoutMs = 30000; // 30 second timeout

			// Create timeout handler with progress context
			const timeoutHandler = progressTracker.createTimeoutHandler(timeoutMs, 'PDF download');

			progressTracker.logProgress('download_request', 'Initiating PDF download request');

			const request = client.get(
				url,
				{
					timeout: timeoutMs,
					headers: {
						'User-Agent': 'n8n-fillpdf-node/1.0',
						Accept: 'application/pdf,*/*',
					},
				},
				(response) => {
					clearTimeout(timeoutHandler);

					// Check response status with detailed error messages
					if (response.statusCode !== 200) {
						const statusMessage = this.getHttpStatusMessage(response.statusCode || 0);
						progressTracker.logProgress('download_error', `HTTP error: ${response.statusCode}`, {
							statusMessage,
						});
						reject({
							message: `HTTP ${response.statusCode}: ${statusMessage}`,
							errorType: 'runtime' as const,
						});
						return;
					}

					progressTracker.logProgress(
						'download_response',
						'Received successful response from server',
					);

					// Check content type with more flexible validation
					const contentType = response.headers['content-type'];
					if (contentType && !this.isValidPdfContentType(contentType)) {
						progressTracker.logProgress('download_error', 'Invalid content type', { contentType });
						reject({
							message: `URL does not point to a PDF file. Content-Type: ${contentType}. Please ensure the URL points directly to a PDF file.`,
							errorType: 'data' as const,
						});
						return;
					}

					// Check content length and setup progress tracking
					const contentLength = response.headers['content-length'];
					const expectedSize = contentLength ? parseInt(contentLength) : 0;

					if (expectedSize > 50 * 1024 * 1024) {
						progressTracker.logProgress('download_error', 'File too large', {
							sizeMB: Math.round(expectedSize / 1024 / 1024),
						});
						reject({
							message: `PDF file too large (${Math.round(
								expectedSize / 1024 / 1024,
							)}MB). Maximum size is 50MB. Please use a smaller file.`,
							errorType: 'data' as const,
						});
						return;
					}

					if (expectedSize > 0) {
						progressTracker.logProgress('download_size', 'Starting download with known size', {
							sizeKB: Math.round(expectedSize / 1024),
						});
					} else {
						progressTracker.logProgress('download_size', 'Starting download with unknown size');
					}

					const chunks: Buffer[] = [];
					let totalSize = 0;
					let lastProgressUpdate = 0;
					const progressInterval = expectedSize > 1024 * 1024 ? 25 : 50; // Progress update interval

					response.on('data', (chunk: Buffer) => {
						totalSize += chunk.length;

						// Check size limit during download
						if (totalSize > 50 * 1024 * 1024) {
							request.destroy();
							progressTracker.logProgress('download_error', 'File size exceeded during download', {
								sizeMB: Math.round(totalSize / 1024 / 1024),
							});
							reject({
								message: `PDF file too large (${Math.round(
									totalSize / 1024 / 1024,
								)}MB). Maximum size is 50MB. Please use a smaller file.`,
								errorType: 'data' as const,
							});
							return;
						}

						// Log progress for files with known size
						if (expectedSize > 0) {
							const progress = Math.round((totalSize / expectedSize) * 100);
							if (progress - lastProgressUpdate >= progressInterval) {
								progressTracker.logProgress(
									'download_progress',
									`Download progress: ${progress}%`,
									{
										downloadedKB: Math.round(totalSize / 1024),
										totalKB: Math.round(expectedSize / 1024),
										progress,
									},
								);
								lastProgressUpdate = progress;
							}
						} else if (totalSize - lastProgressUpdate >= 1024 * 1024) {
							// Log every MB for unknown size
							progressTracker.logProgress('download_progress', 'Download in progress', {
								downloadedKB: Math.round(totalSize / 1024),
							});
							lastProgressUpdate = totalSize;
						}

						chunks.push(chunk);
					});

					response.on('end', () => {
						const buffer = Buffer.concat(chunks);

						progressTracker.logProgress('download_validation', 'Validating downloaded PDF');

						// Enhanced PDF validation
						if (!this.isValidPdfBuffer(buffer)) {
							progressTracker.logProgress('download_error', 'Downloaded file is not a valid PDF');
							reject({
								message:
									'Downloaded file is not a valid PDF. Please check the URL and ensure it points to a valid PDF file.',
								errorType: 'data' as const,
							});
							return;
						}

						resolve(buffer);
					});

					response.on('error', (error) => {
						clearTimeout(timeoutHandler);
						progressTracker.logProgress('download_error', 'Download stream error', {
							error: error.message,
						});
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
				clearTimeout(timeoutHandler);
				const timeoutError = progressTracker.createTimeoutError('PDF download', timeoutMs);
				reject(timeoutError);
			});

			request.on('error', (error) => {
				clearTimeout(timeoutHandler);
				const errorMessage = this.getNetworkErrorMessage(error);
				progressTracker.logProgress('download_error', 'Network error', { error: errorMessage });
				reject({
					message: errorMessage,
					errorType: 'runtime' as const,
					details: { originalError: error },
				});
			});
		});
	}

	/**
	 * Download PDF from URL with enhanced timeout, size limits, and progress tracking (legacy method)
	 */
	private downloadPdfFromUrl(url: string): Promise<Buffer> {
		const progressTracker = new FieldExtractionProgressTracker();
		return this.downloadPdfFromUrlWithProgress(url, progressTracker);
	}

	/**
	 * Get user-friendly HTTP status message
	 */
	private getHttpStatusMessage(statusCode: number): string {
		switch (statusCode) {
			case 400:
				return 'Bad Request - The URL is malformed';
			case 401:
				return 'Unauthorized - Authentication required';
			case 403:
				return 'Forbidden - Access denied to this resource';
			case 404:
				return 'Not Found - PDF file not found at this URL';
			case 429:
				return 'Too Many Requests - Rate limit exceeded, please try again later';
			case 500:
				return 'Internal Server Error - Server error, please try again later';
			case 502:
				return 'Bad Gateway - Server is temporarily unavailable';
			case 503:
				return 'Service Unavailable - Server is temporarily unavailable';
			case 504:
				return 'Gateway Timeout - Server took too long to respond';
			default:
				return `HTTP Error ${statusCode}`;
		}
	}

	/**
	 * Check if content type indicates a PDF file
	 */
	private isValidPdfContentType(contentType: string): boolean {
		const validTypes = [
			'application/pdf',
			'application/x-pdf',
			'application/acrobat',
			'applications/vnd.pdf',
			'text/pdf',
			'text/x-pdf',
		];

		const lowerContentType = contentType.toLowerCase();
		return (
			validTypes.some((type) => lowerContentType.includes(type)) || lowerContentType.includes('pdf')
		);
	}

	/**
	 * Enhanced PDF buffer validation
	 */
	private isValidPdfBuffer(buffer: Buffer): boolean {
		if (buffer.length < 4) {
			return false;
		}

		// Check PDF signature
		const pdfSignature = buffer.subarray(0, 4);
		if (!pdfSignature.equals(Buffer.from('%PDF'))) {
			return false;
		}

		// Additional validation: check for PDF version
		if (buffer.length >= 8) {
			const versionPart = buffer.subarray(4, 8).toString();
			if (!/^-\d\.\d/.test(versionPart)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Get user-friendly network error message
	 */
	private getNetworkErrorMessage(error: any): string {
		if (!error || typeof error !== 'object') {
			return 'Unknown network error occurred';
		}

		const code = error.code || '';
		const message = error.message || '';

		switch (code) {
			case 'ENOTFOUND':
				return 'DNS lookup failed - Cannot resolve the domain name. Please check the URL.';
			case 'ECONNREFUSED':
				return 'Connection refused - The server is not accepting connections. Please check the URL.';
			case 'ECONNRESET':
				return 'Connection reset - The server closed the connection unexpectedly. Please try again.';
			case 'ETIMEDOUT':
				return 'Connection timeout - The server took too long to respond. Please try again.';
			case 'ECONNABORTED':
				return 'Connection aborted - The download was interrupted. Please try again.';
			case 'EHOSTUNREACH':
				return 'Host unreachable - Cannot reach the server. Please check your internet connection.';
			case 'EPROTO':
				return 'Protocol error - There was an issue with the HTTPS/HTTP protocol. Please check the URL.';
			default:
				return `Network error: ${message || code || 'Unknown error'}`;
		}
	}

	/**
	 * Enhanced PDF URL validation with better format checking
	 */
	private isValidPdfUrl(url: string): boolean {
		try {
			if (!url || typeof url !== 'string' || url.trim().length === 0) {
				return false;
			}

			const trimmedUrl = url.trim();
			const urlObj = new URL(trimmedUrl);

			// Check protocol
			if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
				return false;
			}

			// Check if URL looks like it points to a PDF
			const lowerUrl = trimmedUrl.toLowerCase();
			const pathname = urlObj.pathname.toLowerCase();

			// Direct PDF file extension
			if (pathname.endsWith('.pdf')) {
				return true;
			}

			// PDF in query parameters or fragment
			if (lowerUrl.includes('.pdf')) {
				return true;
			}

			// Common PDF serving patterns
			const pdfPatterns = [
				'/pdf/',
				'type=pdf',
				'format=pdf',
				'output=pdf',
				'export=pdf',
				'download=pdf',
			];

			return pdfPatterns.some((pattern) => lowerUrl.includes(pattern));
		} catch (error) {
			return false;
		}
	}

	/**
	 * Convert field info to n8n loadOptions format with enhanced type detection
	 */
	private convertFieldsToOptions(
		fields: IFieldInfo[],
	): Array<{ name: string; value: string; description?: string }> {
		return fields.map((field) => ({
			name: this.formatFieldDisplayName(field),
			value: field.name,
			description: this.generateFieldDescription(field),
		}));
	}

	/**
	 * Generate detailed field description for UI
	 */
	private generateFieldDescription(field: IFieldInfo): string {
		const parts: string[] = [];

		// Field type description
		const typeDescriptions = {
			text: 'Text input field',
			checkbox: 'Boolean checkbox field',
			radio: 'Single selection radio button',
			dropdown: 'Dropdown selection field',
		};
		parts.push(typeDescriptions[field.type] || 'Unknown field type');

		// Required status
		if (field.required) {
			parts.push('Required field');
		} else {
			parts.push('Optional field');
		}

		// Additional constraints
		if (field.maxLength && field.type === 'text') {
			parts.push(`Maximum ${field.maxLength} characters`);
		}

		// Options for dropdown/radio
		if (field.options && field.options.length > 0) {
			if (field.options.length <= 3) {
				parts.push(`Options: ${field.options.join(', ')}`);
			} else {
				parts.push(
					`${field.options.length} available options: ${field.options.slice(0, 2).join(', ')}, ...`,
				);
			}
		}

		// Default value
		if (field.defaultValue) {
			parts.push(`Default: "${field.defaultValue}"`);
		}

		return parts.join(' • ');
	}

	/**
	 * Format field name for display in UI with enhanced type detection
	 */
	private formatFieldDisplayName(field: IFieldInfo): string {
		let displayName = field.name;

		// Add type indicator with enhanced icons
		const typeIndicator = this.getFieldTypeIndicator(field.type);
		if (typeIndicator) {
			displayName = `${typeIndicator} ${displayName}`;
		}

		// Add required indicator with visual emphasis
		if (field.required) {
			displayName += ' ⚠️';
		}

		// Add constraint indicators
		const constraints: string[] = [];

		// Options info for dropdown/radio with better formatting
		if (field.options && field.options.length > 0) {
			if (field.options.length <= 2) {
				constraints.push(`[${field.options.join('|')}]`);
			} else {
				constraints.push(`[${field.options.length} options]`);
			}
		}

		// Max length info for text fields
		if (field.type === 'text' && field.maxLength) {
			constraints.push(`max:${field.maxLength}`);
		}

		// Default value indicator
		if (field.defaultValue) {
			const truncatedDefault =
				field.defaultValue.length > 10
					? `${field.defaultValue.substring(0, 10)}...`
					: field.defaultValue;
			constraints.push(`def:"${truncatedDefault}"`);
		}

		// Add constraints to display name
		if (constraints.length > 0) {
			displayName += ` (${constraints.join(', ')})`;
		}

		return displayName;
	}

	/**
	 * Get enhanced field type indicator for UI with better visual distinction
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
			case 'multiline':
				return '📄';
			case 'number':
				return '🔢';
			case 'date':
				return '📅';
			case 'signature':
				return '✍️';
			default:
				return '❓';
		}
	}

	/**
	 * Enhanced field type detection with automatic mapping
	 */
	private detectFieldType(field: any): 'text' | 'checkbox' | 'radio' | 'dropdown' {
		// This method would be called during PDF inspection to improve type detection
		// For now, we'll enhance the existing type detection logic

		if (!field || typeof field !== 'object') {
			return 'text';
		}

		// Check field type from PDF metadata
		const fieldType = field.type || field.fieldType || '';
		const fieldName = (field.name || '').toLowerCase();
		const fieldFlags = field.flags || 0;

		// Checkbox detection
		if (
			fieldType.includes('checkbox') ||
			fieldType.includes('check') ||
			fieldName.includes('check') ||
			fieldName.includes('agree') ||
			fieldName.includes('accept') ||
			fieldName.includes('confirm')
		) {
			return 'checkbox';
		}

		// Radio button detection
		if (
			fieldType.includes('radio') ||
			fieldType.includes('button') ||
			(field.options && field.options.length > 0 && fieldFlags & 0x8000)
		) {
			// Radio flag
			return 'radio';
		}

		// Dropdown detection
		if (
			fieldType.includes('choice') ||
			fieldType.includes('combo') ||
			fieldType.includes('dropdown') ||
			fieldType.includes('select') ||
			(field.options && field.options.length > 0 && !(fieldFlags & 0x8000))
		) {
			return 'dropdown';
		}

		// Default to text for everything else
		return 'text';
	}

	/**
	 * Extract dropdown options from PDF field
	 */
	private extractDropdownOptions(field: any): string[] {
		if (!field || typeof field !== 'object') {
			return [];
		}

		// Try different property names for options
		const optionSources = [
			field.options,
			field.choices,
			field.values,
			field.items,
			field.exportValues,
		];

		for (const source of optionSources) {
			if (Array.isArray(source) && source.length > 0) {
				// Convert all options to strings and filter out empty ones
				return source
					.map((option) => {
						if (typeof option === 'string') return option;
						if (typeof option === 'object' && option.value) return String(option.value);
						if (typeof option === 'object' && option.label) return String(option.label);
						return String(option);
					})
					.filter((option) => option && option.trim().length > 0);
			}
		}

		return [];
	}

	/**
	 * Detect if field is required based on PDF metadata
	 */
	private detectFieldRequirement(field: any): boolean {
		if (!field || typeof field !== 'object') {
			return false;
		}

		// Check various indicators of required fields
		const flags = field.flags || 0;
		const fieldName = (field.name || '').toLowerCase();

		// PDF field flags for required fields
		if (flags & 0x2) {
			// Required flag
			return true;
		}

		// Check field name patterns that suggest required fields
		const requiredPatterns = ['required', 'mandatory', 'must', '*', '_req', '_required'];

		return requiredPatterns.some((pattern) => fieldName.includes(pattern));
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

	/**
	 * Get cache status for a URL
	 */
	getCacheStatus(url: string): { cached: boolean; age?: number } | null {
		try {
			if (fieldCache.isCacheValid('url', url)) {
				// Get cache entry to determine age
				const cachedFields = fieldCache.getCachedFields('url', url);
				if (cachedFields) {
					// We can't get exact age from current cache implementation
					// This is a placeholder for cache status
					return { cached: true, age: 0 };
				}
			}
			return { cached: false };
		} catch (error) {
			return null;
		}
	}

	/**
	 * Clear field cache for URL sources
	 */
	clearFieldCache(pdfSource?: string): void {
		fieldCache.clearCache(pdfSource);
	}

	/**
	 * Get field cache statistics
	 */
	getCacheStats() {
		return fieldCache.getCacheStats();
	}

	/**
	 * Check if manual mode should be suggested based on error patterns
	 */
	shouldSuggestManualMode(error: any): boolean {
		if (!error) return false;

		const errorMessage =
			error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

		// Suggest manual mode for these error types
		const manualModeTriggers = [
			'field extraction failed',
			'no fillable fields',
			'pdf inspection failed',
			'unsupported field types',
			'password-protected',
			'corrupted',
			'invalid pdf',
			'access denied',
			'timeout',
			'too large',
		];

		return manualModeTriggers.some((trigger) => errorMessage.includes(trigger));
	}

	/**
	 * Create fallback configuration suggestions for failed field extraction
	 */
	createFallbackSuggestions(
		pdfSource: 'upload' | 'url' | 'binary',
		error: any,
	): {
		suggestManualMode: boolean;
		alternativeSources: string[];
		troubleshootingSteps: string[];
	} {
		const errorMessage =
			error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
		const suggestions = {
			suggestManualMode: this.shouldSuggestManualMode(error),
			alternativeSources: [] as string[],
			troubleshootingSteps: [] as string[],
		};

		// Source-specific suggestions
		if (pdfSource === 'url') {
			if (errorMessage.includes('timeout') || errorMessage.includes('too large')) {
				suggestions.alternativeSources.push('Try downloading the PDF and using Upload File source');
			}
			if (errorMessage.includes('access denied') || errorMessage.includes('403')) {
				suggestions.alternativeSources.push('Download the PDF manually and use Upload File source');
			}
			if (errorMessage.includes('not found') || errorMessage.includes('404')) {
				suggestions.troubleshootingSteps.push('Verify the PDF URL is correct and accessible');
			}
		}

		if (pdfSource === 'upload') {
			if (errorMessage.includes('too large')) {
				suggestions.troubleshootingSteps.push(
					'Try using a smaller PDF file (under 10MB recommended)',
				);
			}
			if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
				suggestions.troubleshootingSteps.push(
					'Verify the PDF file opens correctly in a PDF viewer',
				);
			}
		}

		// Generic troubleshooting steps
		if (errorMessage.includes('no fillable fields')) {
			suggestions.troubleshootingSteps.push('Verify the PDF contains interactive form fields');
			suggestions.troubleshootingSteps.push(
				'Test the PDF in a PDF editor to confirm it has fillable fields',
			);
		}

		if (errorMessage.includes('password-protected')) {
			suggestions.troubleshootingSteps.push('Remove password protection from the PDF');
			suggestions.troubleshootingSteps.push('Use an unprotected version of the PDF');
		}

		return suggestions;
	}

	/**
	 * Extract and log PDF fields during runtime execution
	 * This is used for upload and binary sources where fields cannot be extracted during configuration
	 */
	async extractAndLogFields(
		context: IExecuteFunctions,
		itemIndex: number,
		pdfData: string,
	): Promise<IFieldInfo[]> {
		try {
			const startTime = Date.now();

			// Extract fields from PDF
			const fields = await this.inspectPdfFields(pdfData);
			const extractionTime = Date.now() - startTime;

			// Log extraction results with clear formatting
			this.logFieldExtractionResults(fields, extractionTime, context, itemIndex);

			return fields;
		} catch (error) {
			// Enhanced error logging with troubleshooting guidance
			const errorHandler = new FieldExtractionErrorHandler();
			const enhancedError = errorHandler.handleFieldExtractionError(error, 'upload', '');

			if (enhancedError instanceof FieldExtractionError) {
				console.error(`\n❌ PDF Field Extraction Failed:`);
				console.error(`   ${enhancedError.title}: ${enhancedError.details.message}`);

				// Log troubleshooting hints
				if (enhancedError.details.troubleshootingHints.length > 0) {
					console.error(`\n   🔧 Troubleshooting:`);
					enhancedError.details.troubleshootingHints
						.filter((hint: ITroubleshootingHint) => hint.priority === 'high')
						.slice(0, 2)
						.forEach((hint: ITroubleshootingHint, index: number) => {
							console.error(`   ${index + 1}. ${hint.issue}: ${hint.solution}`);
						});
				}

				// Log fallback options
				if (
					enhancedError.details.fallbackOptions &&
					enhancedError.details.fallbackOptions.length > 0
				) {
					console.error(`\n   💡 Alternative options:`);
					enhancedError.details.fallbackOptions
						.slice(0, 2)
						.forEach((option: string, index: number) => {
							console.error(`   ${index + 1}. ${option}`);
						});
				}
			} else {
				console.error(`\n❌ PDF Field Extraction Failed:`);
				console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}

			console.error(`\n   ⚙️ You can still use manual field mapping to fill the PDF\n`);

			return [];
		}
	}

	/**
	 * Log field extraction results with enhanced formatting and user guidance
	 */
	private logFieldExtractionResults(
		fields: IFieldInfo[],
		extractionTime: number,
		_context: IExecuteFunctions,
		_itemIndex: number,
	): void {
		const pdfSource = _context.getNodeParameter('pdfSource', _itemIndex) as string;

		if (fields.length === 0) {
			console.log(`\n📄 PDF Field Extraction Complete (${extractionTime}ms)`);
			console.log('='.repeat(60));
			console.log('⚠️  No fillable fields found in this PDF');
			console.log('💡 This PDF may not contain form fields, or they may not be detectable');
			console.log('   You can still use manual field mapping if needed');
			console.log(`${'='.repeat(60)}\n`);
			return;
		}

		// Header with extraction summary
		console.log(`\n📋 PDF Field Extraction Complete (${extractionTime}ms)`);
		console.log('='.repeat(60));
		console.log(
			`✅ Found ${fields.length} fillable field${
				fields.length === 1 ? '' : 's'
			} in ${pdfSource} PDF`,
		);
		console.log('');

		// Group fields by type for better organization
		const fieldsByType = this.groupFieldsByType(fields);

		// Display fields organized by type
		Object.entries(fieldsByType).forEach(([type, typeFields]) => {
			const typeIcon = this.getFieldTypeIndicator(type as any);
			const typeName = this.getFieldTypeName(type as any);

			console.log(`${typeIcon} ${typeName} Fields (${typeFields.length}):`);

			typeFields.forEach((field, index) => {
				const requiredText = field.required ? ' ⚠️ Required' : '';
				const optionsText =
					field.options && field.options.length > 0
						? ` [${field.options.length} options: ${field.options.slice(0, 3).join(', ')}${
								field.options.length > 3 ? '...' : ''
						  }]`
						: '';
				const maxLengthText = field.maxLength ? ` (max: ${field.maxLength} chars)` : '';
				const defaultText = field.defaultValue ? ` (default: "${field.defaultValue}")` : '';

				console.log(
					`   ${index + 1}. ${
						field.name
					}${requiredText}${optionsText}${maxLengthText}${defaultText}`,
				);
			});
			console.log('');
		});

		// Field validation summary
		this.logFieldValidationSummary(fields, _context, _itemIndex);

		console.log(`${'='.repeat(60)}\n`);
	}

	/**
	 * Group fields by type for organized display
	 */
	private groupFieldsByType(fields: IFieldInfo[]): Record<string, IFieldInfo[]> {
		const grouped: Record<string, IFieldInfo[]> = {};

		fields.forEach((field) => {
			if (!grouped[field.type]) {
				grouped[field.type] = [];
			}
			grouped[field.type].push(field);
		});

		// Sort groups by priority (required fields first, then by type)
		const typeOrder = ['checkbox', 'radio', 'dropdown', 'text'];
		const sortedGrouped: Record<string, IFieldInfo[]> = {};

		typeOrder.forEach((type) => {
			if (grouped[type]) {
				// Sort fields within type (required first, then alphabetically)
				sortedGrouped[type] = grouped[type].sort((a, b) => {
					if (a.required !== b.required) {
						return a.required ? -1 : 1;
					}
					return a.name.localeCompare(b.name);
				});
			}
		});

		// Add any remaining types not in the order
		Object.keys(grouped).forEach((type) => {
			if (!sortedGrouped[type]) {
				sortedGrouped[type] = grouped[type];
			}
		});

		return sortedGrouped;
	}

	/**
	 * Get human-readable field type name
	 */
	private getFieldTypeName(type: string): string {
		switch (type) {
			case 'checkbox':
				return 'Checkbox';
			case 'radio':
				return 'Radio Button';
			case 'dropdown':
				return 'Dropdown';
			case 'text':
				return 'Text';
			default:
				return 'Other';
		}
	}

	/**
	 * Log field validation summary against configured mappings
	 */
	private logFieldValidationSummary(
		fields: IFieldInfo[],
		_context: IExecuteFunctions,
		_itemIndex: number,
	): void {
		try {
			const fieldMappings = _context.getNodeParameter('fieldMappings', _itemIndex) as {
				mapping: any[];
			};
			const mappings = fieldMappings.mapping || [];

			if (mappings.length === 0) {
				console.log('💡 Field Mapping Guidance:');
				console.log('   No field mappings configured yet. Use the field names above in your');
				console.log('   field mapping configuration to fill these PDF fields with data.');
				return;
			}

			// Validate mappings against extracted fields
			const fieldNames = new Set(fields.map((f) => f.name));
			const validMappings: string[] = [];
			const invalidMappings: string[] = [];
			const missingRequiredFields: string[] = [];

			mappings.forEach((mapping) => {
				if (mapping.pdfFieldName && fieldNames.has(mapping.pdfFieldName)) {
					validMappings.push(mapping.pdfFieldName);
				} else if (mapping.pdfFieldName) {
					invalidMappings.push(mapping.pdfFieldName);
				}
			});

			// Check for required fields without mappings
			fields.forEach((field) => {
				if (field.required && !validMappings.includes(field.name)) {
					missingRequiredFields.push(field.name);
				}
			});

			// Display validation results
			console.log('🔍 Field Mapping Validation:');

			if (validMappings.length > 0) {
				console.log(
					`   ✅ ${validMappings.length} valid mapping${
						validMappings.length === 1 ? '' : 's'
					}: ${validMappings.join(', ')}`,
				);
			}

			if (invalidMappings.length > 0) {
				console.log(
					`   ❌ ${invalidMappings.length} invalid mapping${
						invalidMappings.length === 1 ? '' : 's'
					}: ${invalidMappings.join(', ')}`,
				);
				console.log('      These fields do not exist in the PDF and will be skipped');
			}

			if (missingRequiredFields.length > 0) {
				console.log(
					`   ⚠️  ${missingRequiredFields.length} required field${
						missingRequiredFields.length === 1 ? '' : 's'
					} without mapping${
						missingRequiredFields.length === 1 ? '' : 's'
					}: ${missingRequiredFields.join(', ')}`,
				);
				console.log('      Consider adding mappings for these required fields');
			}

			// Summary statistics
			const mappingCoverage = Math.round((validMappings.length / fields.length) * 100);
			console.log(
				`   📊 Mapping coverage: ${mappingCoverage}% (${validMappings.length}/${fields.length} fields)`,
			);
		} catch (error) {
			// Don't fail if validation summary fails
			console.log('💡 Use the extracted field names above in your field mapping configuration');
		}
	}

	/**
	 * Validate field mappings against extracted fields during runtime
	 */
	async validateFieldMappingsAtRuntime(
		fields: IFieldInfo[],
		fieldMappings: any[],
		_context: IExecuteFunctions,
		_itemIndex: number,
	): Promise<{
		validMappings: string[];
		invalidMappings: string[];
		missingRequiredFields: string[];
		validationSummary: string;
	}> {
		const fieldNames = new Set(fields.map((f) => f.name));
		const validMappings: string[] = [];
		const invalidMappings: string[] = [];
		const missingRequiredFields: string[] = [];

		// Validate each mapping
		fieldMappings.forEach((mapping) => {
			if (mapping.pdfFieldName && fieldNames.has(mapping.pdfFieldName)) {
				validMappings.push(mapping.pdfFieldName);
			} else if (mapping.pdfFieldName) {
				invalidMappings.push(mapping.pdfFieldName);
			}
		});

		// Check for required fields without mappings
		fields.forEach((field) => {
			if (field.required && !validMappings.includes(field.name)) {
				missingRequiredFields.push(field.name);
			}
		});

		// Generate validation summary
		const totalFields = fields.length;
		const mappingCoverage =
			totalFields > 0 ? Math.round((validMappings.length / totalFields) * 100) : 0;

		let validationSummary = `Field validation complete: ${validMappings.length}/${totalFields} fields mapped (${mappingCoverage}%)`;

		if (invalidMappings.length > 0) {
			validationSummary += `, ${invalidMappings.length} invalid mapping${
				invalidMappings.length === 1 ? '' : 's'
			}`;
		}

		if (missingRequiredFields.length > 0) {
			validationSummary += `, ${missingRequiredFields.length} required field${
				missingRequiredFields.length === 1 ? '' : 's'
			} unmapped`;
		}

		// Log validation warnings if needed
		if (invalidMappings.length > 0 || missingRequiredFields.length > 0) {
			console.log('\n⚠️  Field Mapping Issues Detected:');

			if (invalidMappings.length > 0) {
				console.log(`   Invalid mappings (will be skipped): ${invalidMappings.join(', ')}`);
			}

			if (missingRequiredFields.length > 0) {
				console.log(`   Required fields without mappings: ${missingRequiredFields.join(', ')}`);
			}

			console.log('');
		}

		return {
			validMappings,
			invalidMappings,
			missingRequiredFields,
			validationSummary,
		};
	}

	/**
	 * Get cache performance statistics for debugging
	 */
	getCachePerformanceStats() {
		return fieldCache.getPerformanceStats();
	}

	/**
	 * Reset cache performance statistics
	 */
	resetCacheStats(): void {
		fieldCache.resetStats();
	}
}

/**
 * Enhanced error handler for field extraction operations
 * Provides specific error messages and troubleshooting hints for different failure scenarios
 */
export class FieldExtractionErrorHandler {
	/**
	 * Handle field extraction errors with enhanced user feedback and troubleshooting hints
	 */
	handleFieldExtractionError(
		error: any,
		pdfSource: 'upload' | 'url' | 'binary',
		_sourceValue: string,
	): Error {
		if (!error) {
			return new Error('Unknown field extraction error occurred');
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		const lowerMessage = errorMessage.toLowerCase();

		// Network and download errors for URL sources
		if (pdfSource === 'url') {
			// Timeout errors
			if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
				return new FieldExtractionError('PDF download timed out', 'timeout', {
					message:
						'The PDF download took too long to complete. This may be due to a large file size, slow server response, or network issues.',
					troubleshootingHints: [
						{
							issue: 'Large PDF file',
							solution: 'Try using a smaller PDF file (under 10MB for better performance)',
							priority: 'high',
						},
						{
							issue: 'Slow server response',
							solution: 'Wait a moment and try again, or use a different PDF URL',
							priority: 'medium',
						},
						{
							issue: 'Network connectivity',
							solution: 'Check your internet connection and try again',
							priority: 'medium',
						},
					],
					fallbackOptions: [
						'Switch to Upload File source if you have the PDF locally',
						'Use Manual Configuration mode to configure fields without automatic detection',
						'Try a different PDF URL with a smaller file',
					],
				});
			}

			// HTTP status errors
			if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
				return new FieldExtractionError('PDF not found at URL', 'not_found', {
					message:
						'The PDF file could not be found at the provided URL. The file may have been moved, deleted, or the URL may be incorrect.',
					troubleshootingHints: [
						{
							issue: 'Incorrect URL',
							solution: 'Double-check the PDF URL for typos or formatting errors',
							priority: 'high',
						},
						{
							issue: 'File moved or deleted',
							solution: 'Verify the PDF still exists at the URL by opening it in a browser',
							priority: 'high',
						},
						{
							issue: 'URL requires authentication',
							solution: 'Ensure the PDF URL is publicly accessible without login',
							priority: 'medium',
						},
					],
					fallbackOptions: [
						'Download the PDF and use Upload File source instead',
						'Use Manual Configuration mode if you know the field structure',
						'Contact the PDF provider to verify the correct URL',
					],
				});
			}

			if (
				lowerMessage.includes('403') ||
				lowerMessage.includes('forbidden') ||
				lowerMessage.includes('access denied')
			) {
				return new FieldExtractionError('Access denied to PDF URL', 'access_denied', {
					message:
						'Access to the PDF URL is restricted. The file may require authentication, have access controls, or be behind a firewall.',
					troubleshootingHints: [
						{
							issue: 'Authentication required',
							solution: 'Ensure the PDF URL is publicly accessible without login credentials',
							priority: 'high',
						},
						{
							issue: 'Access restrictions',
							solution:
								'Contact the PDF provider to request public access or get a direct download link',
							priority: 'high',
						},
						{
							issue: 'Corporate firewall',
							solution: 'Check if your network firewall is blocking access to the URL',
							priority: 'medium',
						},
					],
					fallbackOptions: [
						'Download the PDF manually and use Upload File source',
						'Use Manual Configuration mode to configure fields without automatic detection',
						'Request a publicly accessible PDF URL from the provider',
					],
				});
			}

			// Network connectivity errors
			if (
				lowerMessage.includes('enotfound') ||
				lowerMessage.includes('econnrefused') ||
				lowerMessage.includes('dns lookup failed')
			) {
				return new FieldExtractionError('Cannot connect to PDF URL', 'network_error', {
					message:
						'Unable to establish a connection to the PDF URL. This may be due to network issues, DNS problems, or server unavailability.',
					troubleshootingHints: [
						{
							issue: 'DNS resolution failure',
							solution: 'Check if the domain name in the URL is correct and accessible',
							priority: 'high',
						},
						{
							issue: 'Network connectivity',
							solution: 'Verify your internet connection and try again',
							priority: 'high',
						},
						{
							issue: 'Server unavailable',
							solution: 'The server may be temporarily down - try again later',
							priority: 'medium',
						},
					],
					fallbackOptions: [
						'Test the URL in a web browser to verify it works',
						'Use Upload File source if you can download the PDF manually',
						'Use Manual Configuration mode as a workaround',
					],
				});
			}
		}

		// File size errors (all sources)
		if (
			lowerMessage.includes('too large') ||
			lowerMessage.includes('50mb') ||
			lowerMessage.includes('file size')
		) {
			return new FieldExtractionError('PDF file too large', 'file_too_large', {
				message:
					'The PDF file exceeds the maximum size limit of 50MB. Large files can cause memory issues and slow processing.',
				troubleshootingHints: [
					{
						issue: 'File size exceeds limit',
						solution: 'Use a PDF file smaller than 50MB for optimal performance',
						priority: 'high',
					},
					{
						issue: 'Complex PDF with many pages',
						solution:
							'Consider splitting the PDF into smaller sections or removing unnecessary pages',
						priority: 'medium',
					},
					{
						issue: 'High-resolution images in PDF',
						solution: 'Optimize the PDF by reducing image quality or removing images',
						priority: 'low',
					},
				],
				fallbackOptions: [
					'Use a smaller PDF file (under 10MB recommended)',
					'Use Manual Configuration mode to work with the large PDF',
					'Split the PDF into smaller files and process them separately',
				],
			});
		}

		// PDF validation errors
		if (
			lowerMessage.includes('not a valid pdf') ||
			lowerMessage.includes('invalid pdf') ||
			lowerMessage.includes('corrupted')
		) {
			return new FieldExtractionError('Invalid or corrupted PDF', 'invalid_pdf', {
				message:
					'The file is not a valid PDF or may be corrupted. This can happen with damaged files, non-PDF files with .pdf extension, or password-protected PDFs.',
				troubleshootingHints: [
					{
						issue: 'File is not actually a PDF',
						solution: 'Verify the file is a genuine PDF by opening it in a PDF viewer',
						priority: 'high',
					},
					{
						issue: 'PDF is password-protected',
						solution: 'Use an unprotected PDF or remove password protection first',
						priority: 'high',
					},
					{
						issue: 'PDF is corrupted',
						solution: 'Try re-downloading or re-creating the PDF file',
						priority: 'medium',
					},
				],
				fallbackOptions: [
					'Use a different PDF file that opens correctly in PDF viewers',
					'Remove password protection from the PDF if applicable',
					'Use Manual Configuration mode if you know the field structure',
				],
			});
		}

		// Field extraction specific errors
		if (
			lowerMessage.includes('pdf inspection failed') ||
			lowerMessage.includes('field extraction') ||
			lowerMessage.includes('no fillable fields')
		) {
			return new FieldExtractionError('PDF field extraction failed', 'extraction_failed', {
				message:
					'Unable to extract fillable fields from the PDF. The PDF may not contain form fields, or the fields may be in an unsupported format.',
				troubleshootingHints: [
					{
						issue: 'PDF has no fillable fields',
						solution:
							'Verify the PDF contains interactive form fields (not just text that looks like forms)',
						priority: 'high',
					},
					{
						issue: 'Unsupported field types',
						solution:
							'The PDF may use advanced field types not supported by the extraction process',
						priority: 'medium',
					},
					{
						issue: 'PDF created with unsupported software',
						solution: 'Try recreating the PDF with standard PDF creation tools',
						priority: 'low',
					},
				],
				fallbackOptions: [
					'Use Manual Configuration mode to define fields manually',
					'Verify the PDF has fillable fields by testing in a PDF editor',
					'Create a new PDF with properly defined form fields',
				],
			});
		}

		// Python/system errors
		if (
			lowerMessage.includes('python') ||
			lowerMessage.includes('script') ||
			lowerMessage.includes('execution')
		) {
			return new FieldExtractionError('System processing error', 'system_error', {
				message:
					'An error occurred in the PDF processing system. This may be due to system resource limitations or processing environment issues.',
				troubleshootingHints: [
					{
						issue: 'System resource limitations',
						solution:
							'Try processing a smaller PDF or wait for system resources to become available',
						priority: 'high',
					},
					{
						issue: 'Processing environment issue',
						solution: 'The PDF processing system may be temporarily unavailable',
						priority: 'medium',
					},
					{
						issue: 'PDF complexity',
						solution: 'The PDF may be too complex for automatic processing',
						priority: 'low',
					},
				],
				fallbackOptions: [
					'Use Manual Configuration mode as an alternative',
					'Try again with a simpler PDF file',
					'Contact support if the issue persists',
				],
			});
		}

		// Generic fallback error
		return new FieldExtractionError('Field extraction failed', 'generic_error', {
			message: `An unexpected error occurred during field extraction: ${errorMessage}`,
			troubleshootingHints: [
				{
					issue: 'Unexpected error',
					solution: 'Try the operation again, as some errors are temporary',
					priority: 'medium',
				},
				{
					issue: 'PDF compatibility',
					solution: 'The PDF may have compatibility issues with the extraction process',
					priority: 'medium',
				},
			],
			fallbackOptions: [
				'Use Manual Configuration mode to configure fields manually',
				'Try a different PDF file',
				'Contact support if the issue persists',
			],
		});
	}

	/**
	 * Create user-friendly error message for loadOptions context
	 */
	createLoadOptionsErrorMessage(
		error: FieldExtractionError,
	): Array<{ name: string; value: string; description?: string }> {
		const errorOptions = [
			{
				name: `❌ ${error.title}`,
				value: '__extraction_error__',
				description: error.details.message,
			},
		];

		// Add top troubleshooting hints
		const topHints = error.details.troubleshootingHints
			.filter((hint) => hint.priority === 'high')
			.slice(0, 2);

		topHints.forEach((hint, index) => {
			errorOptions.push({
				name: `💡 ${hint.issue}`,
				value: `__hint_${index}__`,
				description: hint.solution,
			});
		});

		// Add fallback options
		if (error.details.fallbackOptions && error.details.fallbackOptions.length > 0) {
			errorOptions.push({
				name: '🔄 Alternative Options',
				value: '__fallback_options__',
				description: error.details.fallbackOptions.join(' • '),
			});
		}

		// Add manual mode suggestion
		errorOptions.push({
			name: '⚙️ Switch to Manual Configuration',
			value: '__manual_mode__',
			description: 'Configure field mappings manually without automatic field detection',
		});

		return errorOptions;
	}
}

/**
 * Specialized error class for field extraction failures
 */
export class FieldExtractionError extends Error {
	public readonly title: string;
	public readonly errorType: string;
	public readonly details: {
		message: string;
		troubleshootingHints: ITroubleshootingHint[];
		fallbackOptions?: string[];
	};

	constructor(
		title: string,
		errorType: string,
		details: {
			message: string;
			troubleshootingHints: ITroubleshootingHint[];
			fallbackOptions?: string[];
		},
	) {
		super(details.message);
		this.title = title;
		this.errorType = errorType;
		this.details = details;
		this.name = 'FieldExtractionError';
	}

	/**
	 * Get formatted error message for display
	 */
	getFormattedMessage(): string {
		let message = `${this.title}: ${this.details.message}`;

		if (this.details.troubleshootingHints.length > 0) {
			message += '\n\nTroubleshooting:';
			this.details.troubleshootingHints.forEach((hint, index) => {
				message += `\n${index + 1}. ${hint.issue}: ${hint.solution}`;
			});
		}

		if (this.details.fallbackOptions && this.details.fallbackOptions.length > 0) {
			message += '\n\nAlternative options:';
			this.details.fallbackOptions.forEach((option, index) => {
				message += `\n${index + 1}. ${option}`;
			});
		}

		return message;
	}
}

/**
 * Progress tracker for field extraction operations
 * Provides loading indicators and status updates during extraction
 */
export class FieldExtractionProgressTracker {
	public readonly startTime: number;
	private phases: Array<{
		phase: string;
		message: string;
		timestamp: number;
		data?: any;
	}> = [];

	constructor() {
		this.startTime = Date.now();
	}

	/**
	 * Start extraction process
	 */
	startExtraction(source: string): void {
		this.logProgress('start', 'Starting PDF field extraction', { source });
	}

	/**
	 * Log progress with timestamp and optional data
	 */
	logProgress(phase: string, message: string, data?: any): void {
		const timestamp = Date.now();
		const elapsed = timestamp - this.startTime;

		this.phases.push({
			phase,
			message,
			timestamp,
			data,
		});

		// Format progress message with timing
		const timeStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
		const dataStr = data ? ` (${this.formatProgressData(data)})` : '';

		console.log(`🔄 [${timeStr}] ${message}${dataStr}`);
	}

	/**
	 * Format progress data for display
	 */
	private formatProgressData(data: any): string {
		if (!data || typeof data !== 'object') {
			return String(data);
		}

		const parts: string[] = [];

		if (data.fieldCount !== undefined) {
			parts.push(`${data.fieldCount} fields`);
		}
		if (data.sizeKB !== undefined) {
			parts.push(`${data.sizeKB}KB`);
		}
		if (data.downloadTime !== undefined) {
			parts.push(`download: ${data.downloadTime}ms`);
		}
		if (data.extractionTime !== undefined) {
			parts.push(`extraction: ${data.extractionTime}ms`);
		}
		if (data.totalTime !== undefined) {
			parts.push(`total: ${data.totalTime}ms`);
		}
		if (data.cached !== undefined && data.cached) {
			parts.push('cached');
		}
		if (data.error) {
			parts.push(`error: ${data.error}`);
		}

		return parts.join(', ');
	}

	/**
	 * Get progress summary
	 */
	getProgressSummary(): {
		totalTime: number;
		phases: number;
		lastPhase: string;
		success: boolean;
	} {
		const totalTime = Date.now() - this.startTime;
		const lastPhase = this.phases[this.phases.length - 1];

		return {
			totalTime,
			phases: this.phases.length,
			lastPhase: lastPhase?.phase || 'none',
			success: lastPhase?.phase === 'complete',
		};
	}

	/**
	 * Create timeout handler with progress context and user-friendly feedback
	 */
	createTimeoutHandler(timeoutMs: number, operation: string): NodeJS.Timeout {
		return setTimeout(() => {
			const timeoutSeconds = Math.round(timeoutMs / 1000);

			this.logProgress('timeout', `⏱️ ${operation} timed out after ${timeoutSeconds}s`, {
				timeoutMs,
				operation,
			});

			// Log user-friendly timeout guidance
			console.log(`\n💡 Timeout Guidance:`);
			console.log(
				`   • The ${operation.toLowerCase()} took longer than expected (>${timeoutSeconds}s)`,
			);
			console.log(`   • This may be due to a large file, slow network, or server issues`);
			console.log(`   • Consider using a smaller PDF file or trying again later`);
			console.log(`   • You can switch to Manual Configuration mode as an alternative\n`);
		}, timeoutMs);
	}

	/**
	 * Create timeout error with enhanced user feedback
	 */
	createTimeoutError(operation: string, timeoutMs: number): FieldExtractionError {
		const timeoutSeconds = Math.round(timeoutMs / 1000);

		return new FieldExtractionError(`${operation} timed out`, 'timeout', {
			message: `The ${operation.toLowerCase()} operation took longer than the ${timeoutSeconds}-second timeout limit. This may be due to a large file, slow network connection, or server performance issues.`,
			troubleshootingHints: [
				{
					issue: 'Large file size',
					solution: 'Try using a smaller PDF file (under 10MB recommended for faster processing)',
					priority: 'high',
				},
				{
					issue: 'Slow network connection',
					solution:
						'Check your internet connection speed and try again when the connection is more stable',
					priority: 'high',
				},
				{
					issue: 'Server performance',
					solution: 'The PDF server may be slow or overloaded - try again in a few minutes',
					priority: 'medium',
				},
				{
					issue: 'Complex PDF structure',
					solution: 'The PDF may have a complex structure that takes longer to process',
					priority: 'low',
				},
			],
			fallbackOptions: [
				'Switch to Upload File source if you can download the PDF locally',
				'Use Manual Configuration mode to configure fields without automatic detection',
				'Try again later when network conditions may be better',
				'Use a simpler PDF with fewer pages or form fields',
			],
		});
	}
}

/**
 * Utility function to create a configured field inspector instance
 */
export function createFieldInspector(pythonExecutable?: string): FieldInspector {
	return new FieldInspector(pythonExecutable);
}
