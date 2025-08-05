import { IExecuteFunctions, NodeOperationError, IBinaryData } from 'n8n-workflow';
import { IFillPdfNodeParams, INodeOutputData } from './types';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Handles output formatting and delivery for filled PDFs
 * Supports binary data output and file saving capabilities
 */
export class OutputHandler {
	private context: IExecuteFunctions;

	constructor(context: IExecuteFunctions, _itemIndex: number) {
		this.context = context;
	}

	/**
	 * Create binary data output for n8n workflow
	 * Requirements: 5.1, 5.4
	 */
	createBinaryOutput(pdfData: string, params: IFillPdfNodeParams): IBinaryData {
		try {
			// Generate appropriate filename
			const fileName = this.generateOutputFilename(params);

			// Create binary data object with proper MIME type and metadata
			const binaryData: IBinaryData = {
				data: pdfData,
				mimeType: 'application/pdf',
				fileName,
				fileExtension: 'pdf',
			};

			console.log(
				`Created binary output: ${fileName} (${Math.round(pdfData.length * 0.75)} bytes)`,
			);

			return binaryData;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.context.getNode(),
				`Failed to create binary output: ${errorMessage}`,
				{ description: 'Error occurred while preparing PDF binary data' },
			);
		}
	}

	/**
	 * Generate appropriate filename based on PDF source and current timestamp
	 */
	private generateOutputFilename(params: IFillPdfNodeParams): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
		const timeOnly = new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').split('.')[0];

		let baseName = 'document';

		switch (params.pdfSource) {
			case 'upload':
				if (params.pdfFile) {
					// Extract filename from path and remove extension
					baseName =
						params.pdfFile
							.split('/')
							.pop()
							?.replace(/\.pdf$/i, '') || 'document';
				}
				break;
			case 'url':
				if (params.pdfUrl) {
					// Extract filename from URL and remove extension
					baseName =
						params.pdfUrl
							.split('/')
							.pop()
							?.replace(/\.pdf$/i, '') || 'document';
				}
				break;
			case 'binary':
				baseName = params.binaryPropertyName || 'document';
				break;
		}

		// Clean filename to remove invalid characters
		baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');

		return `${baseName}_filled_${timestamp}_${timeOnly}.pdf`;
	}

	/**
	 * Create comprehensive output metadata
	 * Requirements: 5.4
	 */
	createOutputMetadata(
		params: IFillPdfNodeParams,
		metadata: {
			originalFieldCount: number;
			filledFieldCount: number;
			processingTime: number;
		},
		outputPath?: string,
	): any {
		const currentTime = new Date();
		const startTime = new Date(currentTime.getTime() - metadata.processingTime);

		const outputMetadata = {
			success: true,
			fieldsProcessed: metadata.filledFieldCount,
			outputPath: outputPath,
			metadata: {
				// Core processing information
				originalFieldCount: metadata.originalFieldCount,
				filledFieldCount: metadata.filledFieldCount,
				processingTime: metadata.processingTime,
				outputFormat: params.outputFormat,
				pdfSource: params.pdfSource,
				timestamp: currentTime.toISOString(),

				// Processing options
				options: {
					flattened: params.options.flattenPdf ?? true,
					fieldsValidated: params.options.validateFields ?? true,
					missingFieldsSkipped: params.options.skipMissingFields ?? false,
				},

				// Detailed processing timeline
				processing: {
					startTime: startTime.toISOString(),
					endTime: currentTime.toISOString(),
					durationMs: metadata.processingTime,
					durationFormatted: this.formatDuration(metadata.processingTime),
					performanceCategory: this.categorizePerformance(metadata.processingTime),
				},

				// Field mapping analysis
				fieldMapping: {
					totalMappings: params.fieldMappings.mapping?.length || 0,
					successfulMappings: metadata.filledFieldCount,
					failedMappings: (params.fieldMappings.mapping?.length || 0) - metadata.filledFieldCount,
					successRate: params.fieldMappings.mapping?.length
						? Math.round((metadata.filledFieldCount / params.fieldMappings.mapping.length) * 100)
						: 0,
					mappingDetails:
						params.fieldMappings.mapping?.map((mapping) => ({
							fieldName: mapping.pdfFieldName,
							valueSource: mapping.valueSource,
							hasStaticValue: !!mapping.staticValue,
							hasExpression: !!mapping.expression,
						})) || [],
				},

				// Output configuration
				output: {
					format: params.outputFormat,
					binaryDataIncluded: params.outputFormat === 'binary' || params.outputFormat === 'both',
					fileOutputIncluded: params.outputFormat === 'file' || params.outputFormat === 'both',
					outputPath: outputPath,
					capabilities: {
						supportsBatch: true,
						supportsMultipleFormats: true,
						supportsMetadata: true,
					},
				},

				// System information
				system: {
					nodeVersion: '1.0.0',
					executionId: this.generateExecutionId(),
					platform: process.platform,
					nodeEnv: process.env.NODE_ENV || 'production',
				},

				// Quality metrics
				quality: {
					dataIntegrity: metadata.filledFieldCount === (params.fieldMappings.mapping?.length || 0),
					processingEfficiency: this.calculateEfficiency(
						metadata.processingTime,
						metadata.filledFieldCount,
					),
					errorRate: 0, // Will be updated if errors occur
				},
			},
		};

		// Add source-specific metadata with enhanced details
		switch (params.pdfSource) {
			case 'upload':
				if (params.pdfFile) {
					(outputMetadata.metadata as any).source = {
						type: 'upload',
						file: params.pdfFile,
						fileName: params.pdfFile.split('/').pop() || 'unknown',
						fileExtension: params.pdfFile.split('.').pop()?.toLowerCase() || 'pdf',
					};
				}
				break;
			case 'url':
				if (params.pdfUrl) {
					(outputMetadata.metadata as any).source = {
						type: 'url',
						url: params.pdfUrl,
						domain: this.extractDomain(params.pdfUrl),
						protocol: params.pdfUrl.split(':')[0],
					};
				}
				break;
			case 'binary':
				if (params.binaryPropertyName) {
					(outputMetadata.metadata as any).source = {
						type: 'binary',
						propertyName: params.binaryPropertyName,
						fromPreviousNode: true,
					};
				}
				break;
		}

		return outputMetadata;
	}

	/**
	 * Format duration in human-readable format
	 */
	private formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	}

	/**
	 * Categorize performance based on processing time
	 */
	private categorizePerformance(ms: number): string {
		if (ms < 1000) return 'excellent';
		if (ms < 5000) return 'good';
		if (ms < 15000) return 'acceptable';
		return 'slow';
	}

	/**
	 * Calculate processing efficiency
	 */
	private calculateEfficiency(processingTime: number, fieldsProcessed: number): number {
		if (fieldsProcessed === 0) return 0;
		// Fields per second
		return Math.round((fieldsProcessed / (processingTime / 1000)) * 100) / 100;
	}

	/**
	 * Generate unique execution ID
	 */
	private generateExecutionId(): string {
		return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
	}

	/**
	 * Extract domain from URL
	 */
	private extractDomain(url: string): string {
		try {
			return new URL(url).hostname;
		} catch {
			return 'unknown';
		}
	}

	/**
	 * Save filled PDF to specified file path with enhanced capabilities
	 * Requirements: 5.2, 5.3, 5.4
	 */
	async saveToFile(
		pdfData: string,
		outputPath: string,
	): Promise<{
		fullPath: string;
		fileSize: number;
		directory: string;
		fileName: string;
		success: boolean;
	}> {
		try {
			// Resolve the full path
			const fullPath = resolve(outputPath);
			const directory = dirname(fullPath);
			const fileName = fullPath.split(/[/\\]/).pop() || 'output.pdf';

			// Validate output path
			if (!outputPath.toLowerCase().endsWith('.pdf')) {
				throw new Error('Output path must end with .pdf extension');
			}

			// Create directory if it doesn't exist
			mkdirSync(directory, { recursive: true });

			// Convert base64 to buffer
			const pdfBuffer = Buffer.from(pdfData, 'base64');

			// Validate PDF data
			if (pdfBuffer.length === 0) {
				throw new Error('PDF data is empty');
			}

			// Write file with error handling
			writeFileSync(fullPath, pdfBuffer);

			// Verify file was written successfully
			const { statSync } = require('fs');
			const stats = statSync(fullPath);

			if (stats.size !== pdfBuffer.length) {
				throw new Error('File size mismatch after writing');
			}

			const result = {
				fullPath,
				fileSize: pdfBuffer.length,
				directory,
				fileName,
				success: true,
			};

			console.log(`PDF saved successfully: ${fullPath} (${pdfBuffer.length} bytes)`);
			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.context.getNode(),
				`Failed to save PDF to file: ${errorMessage}`,
				{
					description:
						'Check the output path, file permissions, and available disk space. Ensure the directory can be created and is writable.',
				},
			);
		}
	}

	/**
	 * Process multiple PDFs for batch operations
	 * Requirements: 5.3
	 */
	async processBatch(
		pdfDataArray: string[],
		params: IFillPdfNodeParams,
		metadata: {
			originalFieldCount: number;
			filledFieldCount: number;
			processingTime: number;
		},
	): Promise<INodeOutputData[]> {
		const results: INodeOutputData[] = [];
		const batchStartTime = Date.now();
		const batchId = this.generateBatchId();

		console.log(`Starting batch processing of ${pdfDataArray.length} PDFs (Batch ID: ${batchId})`);

		// Create batch summary for comprehensive metadata
		const batchSummary = {
			batchId,
			totalItems: pdfDataArray.length,
			successfulItems: 0,
			failedItems: 0,
			startTime: new Date(batchStartTime).toISOString(),
			endTime: '',
			totalProcessingTime: 0,
			outputPaths: [] as string[],
		};

		for (let i = 0; i < pdfDataArray.length; i++) {
			const itemStartTime = Date.now();

			try {
				const pdfData = pdfDataArray[i];

				// Generate unique output path for batch processing
				let batchOutputPath: string | undefined;
				if (
					params.outputPath &&
					(params.outputFormat === 'file' || params.outputFormat === 'both')
				) {
					batchOutputPath = this.generateBatchOutputPath(params.outputPath, i, batchId);
					batchSummary.outputPaths.push(batchOutputPath);
				}

				// Create batch-specific parameters with enhanced metadata
				const batchParams: IFillPdfNodeParams = {
					...params,
					outputPath: batchOutputPath,
				};

				// Create item-specific metadata
				const itemMetadata = {
					...metadata,
					processingTime: Date.now() - itemStartTime,
				};

				// Process individual PDF
				const result = await this.formatOutput(pdfData, batchParams, itemMetadata);

				// Enhance result with batch information
				result.json.metadata = {
					...result.json.metadata,
					batch: {
						batchId,
						itemIndex: i + 1,
						totalItems: pdfDataArray.length,
						itemProcessingTime: Date.now() - itemStartTime,
					},
				};

				results.push(result);
				batchSummary.successfulItems++;

				console.log(`✓ Batch item ${i + 1}/${pdfDataArray.length} processed successfully`);
			} catch (error) {
				batchSummary.failedItems++;
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';

				console.error(`✗ Batch item ${i + 1}/${pdfDataArray.length} failed: ${errorMessage}`);

				// Add comprehensive error result for failed batch item
				results.push({
					json: {
						success: false,
						fieldsProcessed: 0,
						error: errorMessage,
						metadata: {
							originalFieldCount: 0,
							filledFieldCount: 0,
							processingTime: Date.now() - itemStartTime,
							outputFormat: params.outputFormat,
							pdfSource: params.pdfSource,
							timestamp: new Date().toISOString(),
							batch: {
								batchId,
								itemIndex: i + 1,
								totalItems: pdfDataArray.length,
								itemProcessingTime: Date.now() - itemStartTime,
								error: errorMessage,
							},
						},
					},
				});
			}
		}

		// Add batch summary to all results
		const batchProcessingTime = Date.now() - batchStartTime;
		batchSummary.endTime = new Date().toISOString();
		batchSummary.totalProcessingTime = batchProcessingTime;

		// Enhance all results with final batch summary
		results.forEach((result) => {
			if (result.json.metadata) {
				result.json.metadata.batchSummary = batchSummary;
			}
		});

		console.log(
			`Batch processing completed (${batchProcessingTime}ms): ${batchSummary.successfulItems} successful, ${batchSummary.failedItems} failed`,
		);

		return results;
	}

	/**
	 * Generate unique output path for batch processing
	 */
	private generateBatchOutputPath(basePath: string, index: number, batchId?: string): string {
		const pathParts = basePath.split('.');
		const extension = pathParts.pop() || 'pdf';
		const basePathWithoutExt = pathParts.join('.');

		const batchSuffix = batchId ? `_${batchId}_${index + 1}` : `_batch_${index + 1}`;
		return `${basePathWithoutExt}${batchSuffix}.${extension}`;
	}

	/**
	 * Generate unique batch ID for tracking
	 */
	private generateBatchId(): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		return `batch_${timestamp}_${randomSuffix}`;
	}

	/**
	 * Format complete output data based on configuration
	 * Requirements: 5.1, 5.4
	 */
	async formatOutput(
		filledPdfData: string,
		params: IFillPdfNodeParams,
		metadata: {
			originalFieldCount: number;
			filledFieldCount: number;
			processingTime: number;
		},
	): Promise<INodeOutputData> {
		try {
			// Create base output metadata
			const outputMetadata = this.createOutputMetadata(params, metadata);

			// Initialize output data structure
			const outputData: INodeOutputData = {
				json: outputMetadata,
			};

			// Handle binary output
			if (params.outputFormat === 'binary' || params.outputFormat === 'both') {
				const binaryData = this.createBinaryOutput(filledPdfData, params);
				outputData.binary = {
					pdf: {
						data: binaryData.data,
						mimeType: binaryData.mimeType,
						fileName: binaryData.fileName,
						fileExtension: binaryData.fileExtension,
					},
				};

				console.log(`Binary output created: ${binaryData.fileName}`);
			}

			// Handle file output
			if (params.outputFormat === 'file' || params.outputFormat === 'both') {
				if (!params.outputPath) {
					throw new NodeOperationError(
						this.context.getNode(),
						'Output path is required when saving to file',
						{ description: 'Please specify an output path in the node configuration' },
					);
				}

				// Save PDF to file with enhanced capabilities
				const fileResult = await this.saveToFile(filledPdfData, params.outputPath);

				// Add file information to output metadata
				outputData.json.outputPath = fileResult.fullPath;
				outputData.json.metadata = {
					...outputData.json.metadata,
					fileOutput: {
						fullPath: fileResult.fullPath,
						fileName: fileResult.fileName,
						directory: fileResult.directory,
						fileSize: fileResult.fileSize,
						success: fileResult.success,
					},
				};

				console.log(`File output saved to: ${fileResult.fullPath} (${fileResult.fileSize} bytes)`);
			}

			return outputData;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new NodeOperationError(
				this.context.getNode(),
				`Output formatting failed: ${errorMessage}`,
				{ description: 'Error occurred while preparing output data' },
			);
		}
	}
}
