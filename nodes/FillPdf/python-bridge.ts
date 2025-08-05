import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { IPythonInput, IPythonOutput } from './types';
import { PythonValidator, IPythonValidationResult } from './python-validator';
import { FillPdfPythonError, FillPdfRuntimeError, IErrorContext } from './errors';

/**
 * Python bridge for handling PDF operations via subprocess
 */
export class PythonBridge {
	private pythonExecutable: string;
	private scriptPath: string;
	private validationResult?: IPythonValidationResult;

	constructor(pythonExecutable?: string) {
		this.pythonExecutable = pythonExecutable || 'python3';
		this.scriptPath = join(__dirname, 'fillpdf-processor.py');
	}

	/**
	 * Validate Python environment before first use
	 */
	async validateEnvironment(): Promise<IPythonValidationResult> {
		if (this.validationResult) {
			return this.validationResult;
		}

		// If specific executable was provided, validate it
		if (this.pythonExecutable !== 'python3') {
			this.validationResult = await PythonValidator.validatePythonExecutable(this.pythonExecutable);
		} else {
			// Auto-detect best Python executable
			this.validationResult = await PythonValidator.validateEnvironment();
			if (this.validationResult.isValid && this.validationResult.pythonExecutable) {
				this.pythonExecutable = this.validationResult.pythonExecutable;
			}
		}

		return this.validationResult;
	}

	/**
	 * Execute Python script with JSON input/output
	 */
	async executePythonScript(input: IPythonInput): Promise<IPythonOutput> {
		// Validate environment first
		const validation = await this.validateEnvironment();
		if (!validation.isValid) {
			// Create a dummy node for error context (will be replaced with actual node in calling code)
			const dummyNode = {
				id: 'python-bridge',
				name: 'Python Bridge',
				type: 'fillPdf',
				typeVersion: 1,
			};

			if (validation.error) {
				throw validation.error;
			} else {
				throw new FillPdfPythonError(
					dummyNode as any,
					'Python environment validation failed',
					{ component: 'Python Bridge', operation: 'executePythonScript' },
					{ pythonExecutable: this.pythonExecutable },
				);
			}
		}

		return new Promise((resolve, reject) => {
			const pythonProcess = this.spawnPythonProcess();
			let stdout = '';
			let stderr = '';

			// Handle process output
			pythonProcess.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			pythonProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			// Handle process completion
			pythonProcess.on('close', (code) => {
				if (code !== 0) {
					const error = this.handlePythonError(code || -1, stderr);
					reject(error);
					return;
				}

				try {
					const output: IPythonOutput = JSON.parse(stdout);
					resolve(output);
				} catch (parseError) {
					const dummyNode = {
						id: 'python-bridge',
						name: 'Python Bridge',
						type: 'fillPdf',
						typeVersion: 1,
					};
					reject(
						new FillPdfRuntimeError(
							dummyNode as any,
							`Failed to parse Python output: ${
								parseError instanceof Error ? parseError.message : 'Unknown error'
							}`,
							{
								component: 'Python Bridge',
								operation: 'executePythonScript',
								stdout,
								stderr,
								originalError: parseError instanceof Error ? parseError : undefined,
							},
						),
					);
				}
			});

			// Handle process errors
			pythonProcess.on('error', (error) => {
				const dummyNode = {
					id: 'python-bridge',
					name: 'Python Bridge',
					type: 'fillPdf',
					typeVersion: 1,
				};
				reject(
					new FillPdfRuntimeError(
						dummyNode as any,
						`Failed to spawn Python process: ${error.message}`,
						{
							component: 'Python Bridge',
							operation: 'executePythonScript',
							originalError: error,
						},
					),
				);
			});

			// Send input data to Python process
			try {
				const inputJson = JSON.stringify(input);
				pythonProcess.stdin?.write(inputJson);
				pythonProcess.stdin?.end();
			} catch (error) {
				const dummyNode = {
					id: 'python-bridge',
					name: 'Python Bridge',
					type: 'fillPdf',
					typeVersion: 1,
				};
				reject(
					new FillPdfRuntimeError(
						dummyNode as any,
						`Failed to send data to Python process: ${
							error instanceof Error ? error.message : 'Unknown error'
						}`,
						{
							component: 'Python Bridge',
							operation: 'executePythonScript',
							originalError: error instanceof Error ? error : undefined,
						},
					),
				);
			}
		});
	}

	/**
	 * Spawn Python process with proper configuration
	 */
	private spawnPythonProcess(): ChildProcess {
		const pythonProcess = spawn(this.pythonExecutable, [this.scriptPath], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env },
		});

		return pythonProcess;
	}

	/**
	 * Handle Python process errors and convert to structured format
	 */
	private handlePythonError(
		exitCode: number,
		stderr: string,
	): FillPdfPythonError | FillPdfRuntimeError {
		const dummyNode = {
			id: 'python-bridge',
			name: 'Python Bridge',
			type: 'fillPdf',
			typeVersion: 1,
		};
		const context: IErrorContext = {
			component: 'Python Bridge',
			operation: 'handlePythonError',
			exitCode,
			stderr,
			pythonExecutable: this.pythonExecutable,
		};

		// Try to parse structured error from Python
		try {
			const errorOutput = JSON.parse(stderr);
			if (errorOutput.error) {
				return new FillPdfPythonError(dummyNode as any, errorOutput.error, context, {
					troubleshootingHints: errorOutput.troubleshootingHints,
				});
			}
		} catch {
			// Fall back to raw stderr parsing
		}

		// Common error patterns
		if (stderr.includes('ModuleNotFoundError') && stderr.includes('fillpdf')) {
			return new FillPdfPythonError(
				dummyNode as any,
				'fillpdf library not found. Please install it using: pip install fillpdf',
				context,
				{
					missingLibrary: 'fillpdf',
					troubleshootingHints: [
						{
							issue: 'fillpdf library not installed',
							solution: 'Install fillpdf library: pip install fillpdf',
							priority: 'high',
						},
					],
				},
			);
		}

		if (stderr.includes('No such file or directory') || stderr.includes('command not found')) {
			return new FillPdfPythonError(
				dummyNode as any,
				`Python executable '${this.pythonExecutable}' not found. Please ensure Python is installed and accessible.`,
				context,
				{
					pythonExecutable: this.pythonExecutable,
					troubleshootingHints: [
						{
							issue: `Python executable not found: ${this.pythonExecutable}`,
							solution: 'Ensure Python is installed and accessible in your system PATH',
							documentation: 'https://www.python.org/downloads/',
							priority: 'high',
						},
					],
				},
			);
		}

		if (stderr.includes('PermissionError')) {
			return new FillPdfRuntimeError(
				dummyNode as any,
				'Permission denied when accessing files. Please check file permissions.',
				context,
				{
					troubleshootingHints: [
						{
							issue: 'Permission denied',
							solution: 'Check file permissions and ensure the process has read/write access',
							priority: 'high',
						},
					],
				},
			);
		}

		// Generic error fallback
		return new FillPdfRuntimeError(
			dummyNode as any,
			`Python process failed with exit code ${exitCode}: ${stderr || 'Unknown error'}`,
			context,
			{
				exitCode,
				troubleshootingHints: [
					{
						issue: 'Python process execution failed',
						solution: 'Check Python installation and script permissions',
						priority: 'medium',
					},
				],
			},
		);
	}

	/**
	 * Set custom Python executable path and clear validation cache
	 */
	setPythonExecutable(executable: string): void {
		this.pythonExecutable = executable;
		this.validationResult = undefined; // Clear cache to re-validate
	}

	/**
	 * Get current Python executable path
	 */
	getPythonExecutable(): string {
		return this.pythonExecutable;
	}

	/**
	 * Set custom Python script path
	 */
	setScriptPath(path: string): void {
		this.scriptPath = path;
	}

	/**
	 * Get current Python script path
	 */
	getScriptPath(): string {
		return this.scriptPath;
	}

	/**
	 * Get validation result (if available)
	 */
	getValidationResult(): IPythonValidationResult | undefined {
		return this.validationResult;
	}

	/**
	 * Force re-validation of Python environment
	 */
	async revalidateEnvironment(): Promise<IPythonValidationResult> {
		this.validationResult = undefined;
		return this.validateEnvironment();
	}
}

/**
 * Utility function to create a configured Python bridge instance
 */
export function createPythonBridge(pythonExecutable?: string): PythonBridge {
	return new PythonBridge(pythonExecutable);
}
