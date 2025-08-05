import { PythonBridge } from '../nodes/FillPdf/python-bridge';
import { IPythonInput, IPythonOutput } from '../nodes/FillPdf/types';
import { FillPdfPythonError, FillPdfRuntimeError } from '../nodes/FillPdf/errors';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock PythonValidator
jest.mock('../nodes/FillPdf/python-validator', () => ({
  PythonValidator: {
    validateEnvironment: jest.fn(),
    validatePythonExecutable: jest.fn(),
  },
}));

describe('PythonBridge', () => {
  let pythonBridge: PythonBridge;
  let mockProcess: any;

  beforeEach(() => {
    pythonBridge = new PythonBridge();
    
    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn(),
      end: jest.fn(),
    };
    
    mockSpawn.mockReturnValue(mockProcess as any);
    
    // Mock validation to succeed by default
    const { PythonValidator } = require('../nodes/FillPdf/python-validator');
    PythonValidator.validateEnvironment.mockResolvedValue({
      isValid: true,
      pythonExecutable: 'python3',
      version: '3.9.0',
      fillpdfAvailable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default python executable', () => {
      const bridge = new PythonBridge();
      expect(bridge.getPythonExecutable()).toBe('python3');
    });

    it('should initialize with custom python executable', () => {
      const bridge = new PythonBridge('/usr/bin/python3.9');
      expect(bridge.getPythonExecutable()).toBe('/usr/bin/python3.9');
    });
  });

  describe('validateEnvironment', () => {
    it('should validate environment successfully', async () => {
      const result = await pythonBridge.validateEnvironment();
      
      expect(result.isValid).toBe(true);
      expect(result.pythonExecutable).toBe('python3');
    });

    it('should cache validation result', async () => {
      const { PythonValidator } = require('../nodes/FillPdf/python-validator');
      
      await pythonBridge.validateEnvironment();
      await pythonBridge.validateEnvironment();
      
      expect(PythonValidator.validateEnvironment).toHaveBeenCalledTimes(1);
    });

    it('should validate custom executable', async () => {
      const { PythonValidator } = require('../nodes/FillPdf/python-validator');
      const bridge = new PythonBridge('/custom/python');
      
      await bridge.validateEnvironment();
      
      expect(PythonValidator.validatePythonExecutable).toHaveBeenCalledWith('/custom/python');
    });
  });

  describe('executePythonScript', () => {
    const mockInput: IPythonInput = {
      action: 'fill',
      pdfData: 'base64data',
      fieldMappings: { name: 'John Doe' },
      options: { flatten: true, outputFormat: 'binary' },
    };

    it('should execute python script successfully', async () => {
      const expectedOutput: IPythonOutput = {
        success: true,
        data: 'filled-pdf-base64',
        metadata: { fieldCount: 1, processingTime: 100 },
      };

      // Start the execution
      const executionPromise = pythonBridge.executePythonScript(mockInput);

      // Simulate successful python output
      setTimeout(() => {
        mockProcess.stdout.emit('data', JSON.stringify(expectedOutput));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await executionPromise;
      
      expect(result).toEqual(expectedOutput);
      expect(mockSpawn).toHaveBeenCalledWith('python3', [expect.stringContaining('fillpdf-processor.py')], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.any(Object),
      });
    });

    it('should handle python process errors', async () => {
      const executionPromise = pythonBridge.executePythonScript(mockInput);

      // Simulate process error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Process spawn failed'));
      }, 10);

      await expect(executionPromise).rejects.toThrow(FillPdfRuntimeError);
    });

    it('should handle python script errors', async () => {
      const executionPromise = pythonBridge.executePythonScript(mockInput);

      // Simulate python script error
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'ModuleNotFoundError: No module named \'fillpdf\'');
        mockProcess.emit('close', 1);
      }, 10);

      await expect(executionPromise).rejects.toThrow(FillPdfPythonError);
    });

    it('should handle invalid JSON output', async () => {
      const executionPromise = pythonBridge.executePythonScript(mockInput);

      // Simulate invalid JSON output
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'invalid json');
        mockProcess.emit('close', 0);
      }, 10);

      await expect(executionPromise).rejects.toThrow(FillPdfRuntimeError);
    });

    it('should handle environment validation failure', async () => {
      const { PythonValidator } = require('../nodes/FillPdf/python-validator');
      PythonValidator.validateEnvironment.mockResolvedValue({
        isValid: false,
        error: new FillPdfPythonError({} as any, 'Python not found', {} as any),
      });

      await expect(pythonBridge.executePythonScript(mockInput)).rejects.toThrow(FillPdfPythonError);
    });

    it('should send input data to python process', async () => {
      const executionPromise = pythonBridge.executePythonScript(mockInput);

      // Simulate successful execution
      setTimeout(() => {
        mockProcess.stdout.emit('data', JSON.stringify({ success: true }));
        mockProcess.emit('close', 0);
      }, 10);

      await executionPromise;

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(JSON.stringify(mockInput));
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle fillpdf library not found error', async () => {
      const executionPromise = pythonBridge.executePythonScript({} as IPythonInput);

      setTimeout(() => {
        mockProcess.stderr.emit('data', 'ModuleNotFoundError: No module named \'fillpdf\'');
        mockProcess.emit('close', 1);
      }, 10);

      await expect(executionPromise).rejects.toThrow('fillpdf library not found');
    });

    it('should handle python executable not found error', async () => {
      const executionPromise = pythonBridge.executePythonScript({} as IPythonInput);

      setTimeout(() => {
        mockProcess.stderr.emit('data', 'command not found: python3');
        mockProcess.emit('close', 127);
      }, 10);

      await expect(executionPromise).rejects.toThrow('Python executable \'python3\' not found');
    });

    it('should handle permission errors', async () => {
      const executionPromise = pythonBridge.executePythonScript({} as IPythonInput);

      setTimeout(() => {
        mockProcess.stderr.emit('data', 'PermissionError: [Errno 13] Permission denied');
        mockProcess.emit('close', 1);
      }, 10);

      await expect(executionPromise).rejects.toThrow('Permission denied when accessing files');
    });
  });

  describe('utility methods', () => {
    it('should set and get python executable', () => {
      pythonBridge.setPythonExecutable('/new/python');
      expect(pythonBridge.getPythonExecutable()).toBe('/new/python');
    });

    it('should set and get script path', () => {
      pythonBridge.setScriptPath('/new/script.py');
      expect(pythonBridge.getScriptPath()).toBe('/new/script.py');
    });

    it('should clear validation cache when setting new executable', async () => {
      const { PythonValidator } = require('../nodes/FillPdf/python-validator');
      
      await pythonBridge.validateEnvironment();
      pythonBridge.setPythonExecutable('/new/python');
      await pythonBridge.validateEnvironment();
      
      expect(PythonValidator.validateEnvironment).toHaveBeenCalledTimes(1);
      expect(PythonValidator.validatePythonExecutable).toHaveBeenCalledTimes(1);
    });

    it('should force revalidation', async () => {
      const { PythonValidator } = require('../nodes/FillPdf/python-validator');
      
      await pythonBridge.validateEnvironment();
      await pythonBridge.revalidateEnvironment();
      
      expect(PythonValidator.validateEnvironment).toHaveBeenCalledTimes(2);
    });
  });
});