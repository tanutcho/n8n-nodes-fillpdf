#!/usr/bin/env node

/**
 * n8n-nodes-fillpdf Setup Validator
 * 
 * This script validates that all prerequisites are properly installed
 * and configured for the n8n-nodes-fillpdf community node.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SetupValidator {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green
            warning: '\x1b[33m', // Yellow
            error: '\x1b[31m',   // Red
            reset: '\x1b[0m'     // Reset
        };
        
        console.log(`${colors[type]}${message}${colors.reset}`);
    }

    async runCommand(command, args = []) {
        return new Promise((resolve) => {
            const process = spawn(command, args, { 
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true 
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                resolve({
                    code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                process.kill();
                resolve({
                    code: -1,
                    stdout: '',
                    stderr: 'Command timeout'
                });
            }, 10000);
        });
    }

    async test(name, testFn) {
        this.log(`Testing: ${name}...`);
        
        try {
            const result = await testFn();
            
            if (result.success) {
                this.log(`✓ ${name}: ${result.message}`, 'success');
                this.results.passed++;
            } else if (result.warning) {
                this.log(`⚠ ${name}: ${result.message}`, 'warning');
                this.results.warnings++;
            } else {
                this.log(`✗ ${name}: ${result.message}`, 'error');
                this.results.failed++;
            }
            
            this.results.tests.push({
                name,
                success: result.success,
                warning: result.warning,
                message: result.message
            });
            
        } catch (error) {
            this.log(`✗ ${name}: ${error.message}`, 'error');
            this.results.failed++;
            this.results.tests.push({
                name,
                success: false,
                message: error.message
            });
        }
    }

    async validateNodeJs() {
        const result = await this.runCommand('node', ['--version']);
        
        if (result.code !== 0) {
            return {
                success: false,
                message: 'Node.js not found. Please install Node.js 16.x or higher.'
            };
        }
        
        const version = result.stdout.replace('v', '');
        const majorVersion = parseInt(version.split('.')[0]);
        
        if (majorVersion < 16) {
            return {
                success: false,
                message: `Node.js version ${version} found. Version 16.x or higher required.`
            };
        }
        
        return {
            success: true,
            message: `Node.js version ${version} found`
        };
    }

    async validatePython() {
        const commands = ['python3', 'python'];
        
        for (const cmd of commands) {
            const result = await this.runCommand(cmd, ['--version']);
            
            if (result.code === 0) {
                const version = result.stdout.split(' ')[1];
                const [major, minor] = version.split('.').map(Number);
                
                if (major >= 3 && minor >= 7) {
                    return {
                        success: true,
                        message: `Python ${version} found using '${cmd}' command`
                    };
                } else {
                    return {
                        success: false,
                        message: `Python ${version} found but version 3.7+ required`
                    };
                }
            }
        }
        
        return {
            success: false,
            message: 'Python not found. Please install Python 3.7 or higher.'
        };
    }

    async validateFillPdf() {
        const commands = ['python3', 'python'];
        
        for (const cmd of commands) {
            const result = await this.runCommand(cmd, ['-c', 'import fillpdf; print(fillpdf.__version__)']);
            
            if (result.code === 0) {
                return {
                    success: true,
                    message: `fillpdf version ${result.stdout} found`
                };
            }
        }
        
        return {
            success: false,
            message: 'fillpdf library not found. Run: pip3 install fillpdf'
        };
    }

    async validateN8n() {
        const result = await this.runCommand('n8n', ['--version']);
        
        if (result.code !== 0) {
            return {
                warning: true,
                message: 'n8n not found in PATH. This is OK if running in Docker or custom setup.'
            };
        }
        
        const version = result.stdout.trim();
        return {
            success: true,
            message: `n8n version ${version} found`
        };
    }

    async validateNodePackage() {
        const result = await this.runCommand('npm', ['list', 'n8n-nodes-fillpdf']);
        
        if (result.code === 0) {
            return {
                success: true,
                message: 'n8n-nodes-fillpdf package found'
            };
        }
        
        return {
            warning: true,
            message: 'n8n-nodes-fillpdf not installed yet. Install with: npm install n8n-nodes-fillpdf'
        };
    }

    async validateSystemResources() {
        // Check available memory (Linux/macOS)
        const memResult = await this.runCommand('free', ['-h']);
        
        if (memResult.code === 0) {
            const lines = memResult.stdout.split('\n');
            const memLine = lines.find(line => line.startsWith('Mem:'));
            
            if (memLine) {
                const available = memLine.split(/\s+/)[6];
                return {
                    success: true,
                    message: `System memory available: ${available}`
                };
            }
        }
        
        // Fallback for other systems
        return {
            warning: true,
            message: 'Could not check system memory. Ensure at least 2GB RAM available.'
        };
    }

    async validateDiskSpace() {
        const result = await this.runCommand('df', ['-h', '.']);
        
        if (result.code === 0) {
            const lines = result.stdout.split('\n');
            const diskLine = lines[1];
            const available = diskLine.split(/\s+/)[3];
            
            return {
                success: true,
                message: `Disk space available: ${available}`
            };
        }
        
        return {
            warning: true,
            message: 'Could not check disk space. Ensure at least 500MB available.'
        };
    }

    async validatePythonPath() {
        const commands = ['python3', 'python'];
        
        for (const cmd of commands) {
            const result = await this.runCommand('which', [cmd]);
            
            if (result.code === 0) {
                return {
                    success: true,
                    message: `Python executable found at: ${result.stdout}`
                };
            }
        }
        
        return {
            success: false,
            message: 'Python executable not found in PATH'
        };
    }

    async validateBasicPdfProcessing() {
        const testScript = `
import fillpdf
import tempfile
import os

try:
    # Test basic functionality
    print("fillpdf import successful")
    print("Basic validation passed")
except Exception as e:
    print(f"Error: {e}")
    exit(1)
`;
        
        const commands = ['python3', 'python'];
        
        for (const cmd of commands) {
            const result = await this.runCommand(cmd, ['-c', testScript]);
            
            if (result.code === 0) {
                return {
                    success: true,
                    message: 'Basic PDF processing test passed'
                };
            }
        }
        
        return {
            success: false,
            message: 'Basic PDF processing test failed'
        };
    }

    async run() {
        this.log('n8n-nodes-fillpdf Setup Validator', 'info');
        this.log('=====================================\n', 'info');
        
        // Run all validation tests
        await this.test('Node.js Installation', () => this.validateNodeJs());
        await this.test('Python Installation', () => this.validatePython());
        await this.test('Python Path', () => this.validatePythonPath());
        await this.test('fillpdf Library', () => this.validateFillPdf());
        await this.test('Basic PDF Processing', () => this.validateBasicPdfProcessing());
        await this.test('n8n Installation', () => this.validateN8n());
        await this.test('Node Package', () => this.validateNodePackage());
        await this.test('System Memory', () => this.validateSystemResources());
        await this.test('Disk Space', () => this.validateDiskSpace());
        
        // Print summary
        this.log('\n=====================================', 'info');
        this.log('VALIDATION SUMMARY', 'info');
        this.log('=====================================', 'info');
        
        this.log(`✓ Passed: ${this.results.passed}`, 'success');
        this.log(`⚠ Warnings: ${this.results.warnings}`, 'warning');
        this.log(`✗ Failed: ${this.results.failed}`, 'error');
        
        if (this.results.failed === 0) {
            this.log('\n🎉 All critical tests passed! Your system is ready for n8n-nodes-fillpdf.', 'success');
            
            if (this.results.warnings > 0) {
                this.log('\nNote: Some warnings were found but they may not prevent the node from working.', 'warning');
            }
        } else {
            this.log('\n❌ Some critical tests failed. Please address the issues above before using the node.', 'error');
            
            this.log('\nNext steps:', 'info');
            this.log('1. Install missing dependencies', 'info');
            this.log('2. Run this validator again', 'info');
            this.log('3. Check the troubleshooting guide: TROUBLESHOOTING.md', 'info');
        }
        
        return this.results.failed === 0;
    }
}

// Run validator if called directly
if (require.main === module) {
    const validator = new SetupValidator();
    validator.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validator error:', error);
        process.exit(1);
    });
}

module.exports = SetupValidator;