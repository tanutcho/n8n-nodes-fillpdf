import { IExecuteFunctions, IBinaryData, NodeOperationError } from 'n8n-workflow';
import { readFileSync } from 'fs';
import * as axios from 'axios';

/**
 * PDF input handler for different source types
 */
export class PdfInputHandler {
	private context: IExecuteFunctions;
	private itemIndex: number;

	constructor(context: IExecuteFunctions, itemIndex: number) {
		this.context = context;
		this.itemIndex = itemIndex;
	}

	/**
	 * Get PDF data based on the configured source type
	 */
	async getPdfData(): Promise<string> {
		const pdfSource = this.context.getNodeParameter('pdfSource', this.itemIndex) as
			| 'upload'
			| 'url'
			| 'binary';

		switch (pdfSource) {
			case 'upload':
				return this.getPdfFromFile();
			case 'url':
				return this.getPdfFromUrl();
			case 'binary':
				return this.getPdfFromBinary();
			default:
				throw new NodeOperationError(
					this.context.getNode(),
					`Unsupported PDF source type: ${pdfSource}`,
				);
		}
	}

	/**
	 * Handle PDF from uploaded file
	 */
	private async getPdfFromFile(): Promise<string> {
		const pdfFile = this.context.getNodeParameter('pdfFile', this.itemIndex) as string;

		if (!pdfFile) {
			throw new NodeOperationError(
				this.context.getNode(),
				'PDF file path is required when using upload source',
			);
		}

		try {
			// Validate file path
			this.validateFilePath(pdfFile);

			// Read file and convert to base64
			const fileBuffer = readFileSync(pdfFile);
			this.validatePdfBuffer(fileBuffer, 'uploaded file');

			return fileBuffer.toString('base64');
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.context.getNode(),
				`Failed to read PDF file: ${errorMessage}`,
				{ description: 'Check that the file path is correct and the file is accessible' },
			);
		}
	}

	/**
	 * Handle PDF from URL
	 */
	private async getPdfFromUrl(): Promise<string> {
		const pdfUrl = this.context.getNodeParameter('pdfUrl', this.itemIndex) as string;

		if (!pdfUrl) {
			throw new NodeOperationError(
				this.context.getNode(),
				'PDF URL is required when using URL source',
			);
		}

		try {
			// Validate URL format
			this.validateUrl(pdfUrl);

			// Download PDF with timeout and size limits
			const response = await axios.get(pdfUrl, {
				responseType: 'arraybuffer',
				timeout: 30000, // 30 second timeout
				headers: {
					'User-Agent': 'n8n-fillpdf-node/1.0',
				},
			});

			// Validate response
			if (response.status !== 200) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const pdfBuffer = Buffer.from(response.data as ArrayBuffer);
			this.validatePdfBuffer(pdfBuffer, 'downloaded PDF');

			return pdfBuffer.toString('base64');
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}

			let errorMessage = 'Unknown error';
			if (error instanceof Error) {
				errorMessage = error.message;
				// Check for common axios error patterns
				if (errorMessage.includes('timeout')) {
					errorMessage = 'Request timeout - the PDF download took too long';
				} else if (errorMessage.includes('Network Error')) {
					errorMessage = 'Network error - could not reach the URL';
				}
			}

			throw new NodeOperationError(
				this.context.getNode(),
				`Failed to download PDF from URL: ${errorMessage}`,
				{ description: 'Check that the URL is correct and accessible' },
			);
		}
	}

	/**
	 * Handle PDF from binary data
	 */
	private async getPdfFromBinary(): Promise<string> {
		const binaryPropertyName = this.context.getNodeParameter(
			'binaryPropertyName',
			this.itemIndex,
		) as string;

		if (!binaryPropertyName) {
			throw new NodeOperationError(
				this.context.getNode(),
				'Binary property name is required when using binary source',
			);
		}

		try {
			// Get binary data from input
			const inputData = this.context.getInputData();
			const binaryData = inputData[this.itemIndex]?.binary?.[binaryPropertyName];

			if (!binaryData) {
				throw new NodeOperationError(
					this.context.getNode(),
					`No binary data found for property '${binaryPropertyName}'`,
					{
						description:
							'Make sure the previous node outputs binary data with the specified property name',
					},
				);
			}

			// Validate binary data structure
			this.validateBinaryData(binaryData, binaryPropertyName);

			// Convert binary data to buffer for validation
			const pdfBuffer = Buffer.from(binaryData.data, 'base64');
			this.validatePdfBuffer(pdfBuffer, 'binary data');

			return binaryData.data;
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.context.getNode(),
				`Failed to process binary PDF data: ${errorMessage}`,
			);
		}
	}

	/**
	 * Validate file path
	 */
	private validateFilePath(filePath: string): void {
		if (!filePath.toLowerCase().endsWith('.pdf')) {
			throw new NodeOperationError(this.context.getNode(), 'File must have a .pdf extension');
		}

		// Check for path traversal attempts
		if (filePath.includes('..') || filePath.includes('~')) {
			throw new NodeOperationError(
				this.context.getNode(),
				'Invalid file path - path traversal not allowed',
			);
		}
	}

	/**
	 * Validate URL format
	 */
	private validateUrl(url: string): void {
		try {
			const urlObj = new URL(url);

			// Only allow HTTP/HTTPS
			if (!['http:', 'https:'].includes(urlObj.protocol)) {
				throw new Error('Only HTTP and HTTPS URLs are supported');
			}

			// Check for PDF extension in path
			if (!urlObj.pathname.toLowerCase().endsWith('.pdf')) {
				// Allow URLs without .pdf extension but warn
				console.warn('URL does not end with .pdf extension, but will attempt to download');
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Invalid URL format';
			throw new NodeOperationError(this.context.getNode(), `Invalid PDF URL: ${errorMessage}`);
		}
	}

	/**
	 * Validate binary data structure
	 */
	private validateBinaryData(binaryData: IBinaryData, propertyName: string): void {
		if (!binaryData.data) {
			throw new NodeOperationError(
				this.context.getNode(),
				`Binary property '${propertyName}' has no data`,
			);
		}

		// Check MIME type if available
		if (binaryData.mimeType && !binaryData.mimeType.includes('pdf')) {
			console.warn(`Binary data MIME type is '${binaryData.mimeType}', expected PDF`);
		}
	}

	/**
	 * Validate PDF buffer content
	 */
	private validatePdfBuffer(buffer: Buffer, source: string): void {
		// Check minimum size (PDF files are typically at least a few hundred bytes)
		if (buffer.length < 100) {
			throw new NodeOperationError(
				this.context.getNode(),
				`PDF from ${source} is too small (${buffer.length} bytes) - may be corrupted`,
			);
		}

		// Check maximum size (50MB limit)
		const maxSize = 50 * 1024 * 1024;
		if (buffer.length > maxSize) {
			throw new NodeOperationError(
				this.context.getNode(),
				`PDF from ${source} is too large (${Math.round(
					buffer.length / 1024 / 1024,
				)}MB) - maximum size is 50MB`,
			);
		}

		// Check PDF magic bytes
		const pdfHeader = buffer.subarray(0, 4).toString();
		if (!pdfHeader.startsWith('%PDF')) {
			throw new NodeOperationError(
				this.context.getNode(),
				`File from ${source} does not appear to be a valid PDF (missing PDF header)`,
			);
		}

		// Basic PDF structure validation
		const pdfContent = buffer.toString('binary');
		if (!pdfContent.includes('%%EOF')) {
			console.warn(`PDF from ${source} may be incomplete (missing EOF marker)`);
		}
	}

	/**
	 * Get PDF metadata for logging/debugging
	 */
	async getPdfMetadata(): Promise<{ size: number; source: string; filename?: string }> {
		const pdfSource = this.context.getNodeParameter('pdfSource', this.itemIndex) as string;
		let filename: string | undefined;
		let size = 0;

		try {
			const pdfData = await this.getPdfData();
			size = Buffer.from(pdfData, 'base64').length;

			switch (pdfSource) {
				case 'upload':
					const pdfFile = this.context.getNodeParameter('pdfFile', this.itemIndex) as string;
					filename = pdfFile.split('/').pop() || pdfFile;
					break;
				case 'url':
					const pdfUrl = this.context.getNodeParameter('pdfUrl', this.itemIndex) as string;
					filename = pdfUrl.split('/').pop() || 'downloaded.pdf';
					break;
				case 'binary':
					const binaryPropertyName = this.context.getNodeParameter(
						'binaryPropertyName',
						this.itemIndex,
					) as string;
					const inputData = this.context.getInputData();
					const binaryData = inputData[this.itemIndex]?.binary?.[binaryPropertyName];
					filename = binaryData?.fileName || `${binaryPropertyName}.pdf`;
					break;
			}
		} catch (error) {
			// Return partial metadata even if PDF loading fails
		}

		return {
			size,
			source: pdfSource,
			filename,
		};
	}
}

/**
 * Utility function to create PDF input handler
 */
export function createPdfInputHandler(
	context: IExecuteFunctions,
	itemIndex: number,
): PdfInputHandler {
	return new PdfInputHandler(context, itemIndex);
}
