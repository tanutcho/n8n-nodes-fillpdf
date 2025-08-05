import { spawn } from 'child_process';
import { FillPdfPythonError, FillPdfRuntimeError } from './errors';

/**
 * Python environment validation result
 */
export interface IPythonValidationResult {
	isValid: boolean;
	pythonExecutable?: string;
	pythonVersion?: string;
	fillpdfVersion?: string;
	error?: FillPdfPythonError | FillPdfRuntimeError;
	suggestions?: string[];
}

/**
 * Python environment validator
 */
export class PythonValidator {
	private static readonly PYTHON_EXECUTABLES = ['python3', 'python', 'py'];
	private static readonly MIN_PYTHON_VERSION = [3, 6]; // Minimum Python version

	/**
	 * Validate Python environment and fillpdf library availability
	 */
	static async validateEnvironment(): Promise<IPythonValidationResult> {
		// Try different Python executables
		for (const executable of this.PYTHON_EXECUTABLES) {
			const result = await this.validatePythonExecutable(executable);
			if (result.isValid) {
				return result;
			}
		}

		// No valid Python found
		const dummyNode = {
			id: 'python-validator',
			name: 'Python Validator',
			type: 'fillPdf',
			typeVersion: 1,
		};
		return {
			isValid: false,
			error: new FillPdfPythonError(
				dummyNode as any,
				'No valid Python installation found',
				{ component: 'Python Validator', operation: 'validateEnvironment' },
				{
					troubleshootingHints: [
						{
							issue: 'No Python installation found',
							solution: 'Install Python 3.6 or higher from https://python.org',
							documentation: 'https://python.org',
							priority: 'high',
						},
						{
							issue: 'Python not in system PATH',
							solution: 'Ensure Python is added to your system PATH',
							priority: 'high',
						},
						{
							issue: 'fillpdf library missing',
							solution: 'Install fillpdf library: pip install fillpdf',
							priority: 'high',
						},
					],
				},
			),
			suggestions: [
				'Install Python 3.6 or higher from https://python.org',
				'Ensure Python is added to your system PATH',
				'Install fillpdf library: pip install fillpdf',
				'On Windows, try using "py" command instead of "python"',
			],
		};
	}

	/**
	 * Validate a specific Python executable
	 */
	static async validatePythonExecutable(executable: string): Promise<IPythonValidationResult> {
		try {
			// Check Python availability and version
			const pythonCheck = await this.checkPythonVersion(executable);
			if (!pythonCheck.isValid) {
				return pythonCheck;
			}

			// Check fillpdf library availability
			const fillpdfCheck = await this.checkFillpdfLibrary(executable);
			if (!fillpdfCheck.isValid) {
				return {
					...fillpdfCheck,
					pythonExecutable: executable,
					pythonVersion: pythonCheck.pythonVersion,
				};
			}

			return {
				isValid: true,
				pythonExecutable: executable,
				pythonVersion: pythonCheck.pythonVersion,
				fillpdfVersion: fillpdfCheck.fillpdfVersion,
			};
		} catch (error) {
			const dummyNode = {
				id: 'python-validator',
				name: 'Python Validator',
				type: 'fillPdf',
				typeVersion: 1,
			};
			return {
				isValid: false,
				error: new FillPdfRuntimeError(
					dummyNode as any,
					`Failed to validate Python executable '${executable}': ${
						error instanceof Error ? error.message : 'Unknown error'
					}`,
					{
						component: 'Python Validator',
						operation: 'validatePythonExecutable',
						pythonExecutable: executable,
						originalError: error instanceof Error ? error : undefined,
					},
				),
			};
		}
	}

	/**
	 * Check Python version
	 */
	private static async checkPythonVersion(executable: string): Promise<IPythonValidationResult> {
		return new Promise((resolve) => {
			const pythonProcess = spawn(executable, ['--version'], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			let stdout = '';
			let stderr = '';

			pythonProcess.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			pythonProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			pythonProcess.on('close', (code) => {
				if (code !== 0) {
					const dummyNode = {
						id: 'python-validator',
						name: 'Python Validator',
						type: 'fillPdf',
						typeVersion: 1,
					};
					resolve({
						isValid: false,
						error: new FillPdfPythonError(
							dummyNode as any,
							`Python executable '${executable}' not found or not working`,
							{
								component: 'Python Validator',
								operation: 'checkPythonVersion',
								pythonExecutable: executable,
								exitCode: code || 0,
								stderr,
							},
							{ pythonExecutable: executable },
						),
					});
					return;
				}

				// Parse version from output (Python 3.x.x)
				const versionOutput = stdout || stderr;
				const versionMatch = versionOutput.match(/Python (\d+)\.(\d+)\.(\d+)/);

				if (!versionMatch) {
					const dummyNode = {
						id: 'python-validator',
						name: 'Python Validator',
						type: 'fillPdf',
						typeVersion: 1,
					};
					resolve({
						isValid: false,
						error: new FillPdfRuntimeError(
							dummyNode as any,
							`Could not parse Python version from: ${versionOutput}`,
							{
								component: 'Python Validator',
								operation: 'checkPythonVersion',
								pythonExecutable: executable,
								stdout: versionOutput,
							},
						),
					});
					return;
				}

				const major = parseInt(versionMatch[1]);
				const minor = parseInt(versionMatch[2]);
				const patch = parseInt(versionMatch[3]);
				const version = `${major}.${minor}.${patch}`;

				// Check minimum version requirement
				if (
					major < this.MIN_PYTHON_VERSION[0] ||
					(major === this.MIN_PYTHON_VERSION[0] && minor < this.MIN_PYTHON_VERSION[1])
				) {
					const dummyNode = {
						id: 'python-validator',
						name: 'Python Validator',
						type: 'fillPdf',
						typeVersion: 1,
					};
					resolve({
						isValid: false,
						pythonVersion: version,
						error: new FillPdfPythonError(
							dummyNode as any,
							`Python version ${version} is too old. Minimum required: ${this.MIN_PYTHON_VERSION.join(
								'.',
							)}`,
							{
								component: 'Python Validator',
								operation: 'checkPythonVersion',
								pythonExecutable: executable,
							},
							{
								pythonVersion: version,
								troubleshootingHints: [
									{
										issue: `Python version ${version} is too old`,
										solution: `Upgrade Python to version ${this.MIN_PYTHON_VERSION.join(
											'.',
										)} or higher`,
										documentation: 'https://python.org',
										priority: 'high',
									},
								],
							},
						),
						suggestions: [
							`Upgrade Python to version ${this.MIN_PYTHON_VERSION.join('.')} or higher`,
							'Download from https://python.org',
						],
					});
					return;
				}

				resolve({
					isValid: true,
					pythonVersion: version,
				});
			});

			pythonProcess.on('error', (error) => {
				const dummyNode = {
					id: 'python-validator',
					name: 'Python Validator',
					type: 'fillPdf',
					typeVersion: 1,
				};
				resolve({
					isValid: false,
					error: new FillPdfRuntimeError(
						dummyNode as any,
						`Failed to execute Python: ${error.message}`,
						{
							component: 'Python Validator',
							operation: 'checkPythonVersion',
							pythonExecutable: executable,
							originalError: error,
						},
					),
				});
			});
		});
	}

	/**
	 * Check fillpdf library availability and version
	 */
	private static async checkFillpdfLibrary(executable: string): Promise<IPythonValidationResult> {
		return new Promise((resolve) => {
			const checkScript = `
import sys
try:
    import fillpdf
    print(f"fillpdf:{getattr(fillpdf, '__version__', 'unknown')}")
except ImportError as e:
    print(f"error:fillpdf library not found - {str(e)}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"error:Failed to import fillpdf - {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

			const pythonProcess = spawn(executable, ['-c', checkScript], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			let stdout = '';
			let stderr = '';

			pythonProcess.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			pythonProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			pythonProcess.on('close', (code) => {
				if (code !== 0) {
					const errorMessage = stderr.includes('fillpdf library not found')
						? 'fillpdf library is not installed'
						: `Failed to check fillpdf library: ${stderr}`;

					const dummyNode = {
						id: 'python-validator',
						name: 'Python Validator',
						type: 'fillPdf',
						typeVersion: 1,
					};
					resolve({
						isValid: false,
						error: new FillPdfPythonError(
							dummyNode as any,
							errorMessage,
							{
								component: 'Python Validator',
								operation: 'checkFillpdfLibrary',
								pythonExecutable: executable,
								exitCode: code || 0,
								stderr,
							},
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
						),
						suggestions: [
							'Install fillpdf library: pip install fillpdf',
							'If using virtual environment, activate it first',
							'Try: python -m pip install fillpdf',
						],
					});
					return;
				}

				// Parse fillpdf version
				const versionMatch = stdout.match(/fillpdf:(.+)/);
				const fillpdfVersion = versionMatch ? versionMatch[1].trim() : 'unknown';

				resolve({
					isValid: true,
					fillpdfVersion,
				});
			});

			pythonProcess.on('error', (error) => {
				const dummyNode = {
					id: 'python-validator',
					name: 'Python Validator',
					type: 'fillPdf',
					typeVersion: 1,
				};
				resolve({
					isValid: false,
					error: new FillPdfRuntimeError(
						dummyNode as any,
						`Failed to check fillpdf library: ${error.message}`,
						{
							component: 'Python Validator',
							operation: 'checkFillpdfLibrary',
							pythonExecutable: executable,
							originalError: error,
						},
					),
				});
			});
		});
	}

	/**
	 * Get helpful error message with installation instructions
	 */
	static getInstallationInstructions(): string[] {
		return [
			'To use the Fill PDF node, you need:',
			'',
			'1. Python 3.6 or higher:',
			'   - Download from: https://python.org',
			'   - Make sure Python is added to your system PATH',
			'',
			'2. fillpdf library:',
			'   - Install with: pip install fillpdf',
			'   - Or: python -m pip install fillpdf',
			'',
			'3. Verify installation:',
			'   - Run: python --version',
			'   - Run: python -c "import fillpdf; print(fillpdf.__version__)"',
			'',
			'Common issues:',
			'- On Windows, try "py" instead of "python"',
			'- If using virtual environment, activate it first',
			'- For permission issues, try: pip install --user fillpdf',
		];
	}

	/**
	 * Create a validation error with helpful suggestions
	 */
	static createValidationError(message: string, suggestions: string[] = []): FillPdfPythonError {
		const dummyNode = {
			id: 'python-validator',
			name: 'Python Validator',
			type: 'fillPdf',
			typeVersion: 1,
		};
		return new FillPdfPythonError(
			dummyNode as any,
			message,
			{ component: 'Python Validator', operation: 'createValidationError' },
			{
				troubleshootingHints: [...suggestions, ...this.getInstallationInstructions()].map(
					(suggestion) => ({
						issue: 'Python environment setup',
						solution: suggestion,
						priority: 'medium' as const,
					}),
				),
			},
		);
	}
}
