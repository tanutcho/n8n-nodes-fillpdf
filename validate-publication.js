#!/usr/bin/env node

/**
 * Publication Readiness Validator
 * 
 * This script validates that the package is ready for publication to npm
 * and meets all n8n community node standards.
 */

const fs = require('fs');
const path = require('path');

class PublicationValidator {
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

    async test(name, testFn) {
        this.log(`Checking: ${name}...`);
        
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

    fileExists(filePath) {
        return fs.existsSync(filePath);
    }

    readJsonFile(filePath) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to read ${filePath}: ${error.message}`);
        }
    }

    readTextFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read ${filePath}: ${error.message}`);
        }
    }

    async validatePackageJson() {
        if (!this.fileExists('package.json')) {
            return {
                success: false,
                message: 'package.json not found'
            };
        }

        const pkg = this.readJsonFile('package.json');
        const issues = [];

        // Required fields
        const requiredFields = ['name', 'version', 'description', 'license', 'author', 'repository'];
        for (const field of requiredFields) {
            if (!pkg[field]) {
                issues.push(`Missing required field: ${field}`);
            }
        }

        // n8n specific requirements
        if (!pkg.keywords || !pkg.keywords.includes('n8n-community-node-package')) {
            issues.push('Missing n8n-community-node-package keyword');
        }

        if (!pkg.n8n || !pkg.n8n.nodes || pkg.n8n.nodes.length === 0) {
            issues.push('Missing n8n node configuration');
        }

        if (!pkg.peerDependencies || !pkg.peerDependencies['n8n-workflow']) {
            issues.push('Missing n8n-workflow peer dependency');
        }

        // Version format
        if (pkg.version && !/^\d+\.\d+\.\d+/.test(pkg.version)) {
            issues.push('Version should follow semantic versioning (x.y.z)');
        }

        if (issues.length > 0) {
            return {
                success: false,
                message: issues.join(', ')
            };
        }

        return {
            success: true,
            message: `Package configuration valid (v${pkg.version})`
        };
    }

    async validateRequiredFiles() {
        const requiredFiles = [
            'README.md',
            'LICENSE',
            'CONTRIBUTING.md',
            'INSTALLATION.md',
            'TROUBLESHOOTING.md',
            'EXAMPLES.md',
            'CHANGELOG.md'
        ];

        const missingFiles = requiredFiles.filter(file => !this.fileExists(file));

        if (missingFiles.length > 0) {
            return {
                success: false,
                message: `Missing required files: ${missingFiles.join(', ')}`
            };
        }

        return {
            success: true,
            message: 'All required documentation files present'
        };
    }

    async validateDistDirectory() {
        if (!this.fileExists('dist')) {
            return {
                success: false,
                message: 'dist directory not found. Run npm run build first.'
            };
        }

        const pkg = this.readJsonFile('package.json');
        if (pkg.n8n && pkg.n8n.nodes) {
            for (const nodePath of pkg.n8n.nodes) {
                if (!this.fileExists(nodePath)) {
                    return {
                        success: false,
                        message: `Node file not found: ${nodePath}`
                    };
                }
            }
        }

        return {
            success: true,
            message: 'Built distribution files present'
        };
    }

    async validateReadme() {
        if (!this.fileExists('README.md')) {
            return {
                success: false,
                message: 'README.md not found'
            };
        }

        const readme = this.readTextFile('README.md');
        const issues = [];

        // Required sections
        const requiredSections = [
            'Installation',
            'Prerequisites',
            'Usage',
            'Troubleshooting'
        ];

        for (const section of requiredSections) {
            if (!readme.toLowerCase().includes(section.toLowerCase())) {
                issues.push(`Missing ${section} section`);
            }
        }

        // Check for placeholder content
        if (readme.includes('your-username') || readme.includes('Your Name')) {
            issues.push('Contains placeholder content that should be replaced');
        }

        if (issues.length > 0) {
            return {
                warning: true,
                message: issues.join(', ')
            };
        }

        return {
            success: true,
            message: 'README.md is comprehensive and complete'
        };
    }

    async validateLicense() {
        if (!this.fileExists('LICENSE')) {
            return {
                success: false,
                message: 'LICENSE file not found'
            };
        }

        const license = this.readTextFile('LICENSE');
        
        if (license.length < 100) {
            return {
                success: false,
                message: 'LICENSE file appears to be incomplete'
            };
        }

        return {
            success: true,
            message: 'LICENSE file present and appears complete'
        };
    }

    async validateNpmIgnore() {
        if (!this.fileExists('.npmignore')) {
            return {
                warning: true,
                message: '.npmignore not found. All files will be published.'
            };
        }

        const npmignore = this.readTextFile('.npmignore');
        
        // Check for common exclusions
        const shouldExclude = ['tests/', 'node_modules/', '*.test.ts', 'tsconfig.json'];
        const missing = shouldExclude.filter(pattern => !npmignore.includes(pattern));

        if (missing.length > 0) {
            return {
                warning: true,
                message: `Consider excluding: ${missing.join(', ')}`
            };
        }

        return {
            success: true,
            message: '.npmignore properly configured'
        };
    }

    async validateGitHubFiles() {
        const githubFiles = [
            '.github/workflows/ci.yml',
            '.github/ISSUE_TEMPLATE/bug_report.md',
            '.github/ISSUE_TEMPLATE/feature_request.md',
            '.github/pull_request_template.md'
        ];

        const missingFiles = githubFiles.filter(file => !this.fileExists(file));

        if (missingFiles.length > 0) {
            return {
                warning: true,
                message: `Missing GitHub templates: ${missingFiles.join(', ')}`
            };
        }

        return {
            success: true,
            message: 'GitHub templates and workflows configured'
        };
    }

    async validateScripts() {
        const pkg = this.readJsonFile('package.json');
        const requiredScripts = ['build', 'test', 'lint', 'format'];
        const missing = requiredScripts.filter(script => !pkg.scripts || !pkg.scripts[script]);

        if (missing.length > 0) {
            return {
                success: false,
                message: `Missing required scripts: ${missing.join(', ')}`
            };
        }

        // Check for publication scripts
        if (!pkg.scripts.prepublishOnly && !pkg.scripts.prepack) {
            return {
                warning: true,
                message: 'No pre-publication script found. Consider adding prepublishOnly or prepack.'
            };
        }

        return {
            success: true,
            message: 'Package scripts properly configured'
        };
    }

    async validateLintingSetup() {
        const pkg = this.readJsonFile('package.json');
        const issues = [];

        // Check for n8n-nodes-base plugin
        if (!pkg.devDependencies || !pkg.devDependencies['eslint-plugin-n8n-nodes-base']) {
            issues.push('Missing eslint-plugin-n8n-nodes-base dependency');
        }

        // Check for ESLint config file
        const eslintConfigs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml'];
        const hasEslintConfig = eslintConfigs.some(config => this.fileExists(config));
        
        if (!hasEslintConfig) {
            issues.push('No ESLint configuration file found');
        }

        // Check for Prettier config
        const prettierConfigs = ['.prettierrc.js', '.prettierrc.json', '.prettierrc.yml', '.prettierrc.yaml', 'prettier.config.js'];
        const hasPrettierConfig = prettierConfigs.some(config => this.fileExists(config));
        
        if (!hasPrettierConfig) {
            issues.push('No Prettier configuration file found');
        }

        if (issues.length > 0) {
            return {
                warning: true,
                message: issues.join(', ')
            };
        }

        return {
            success: true,
            message: 'Linting setup properly configured with n8n-nodes-base plugin'
        };
    }

    async validateDependencies() {
        const pkg = this.readJsonFile('package.json');
        const issues = [];

        // Check for security vulnerabilities in dependencies
        if (pkg.dependencies) {
            const deps = Object.keys(pkg.dependencies);
            if (deps.length > 10) {
                issues.push(`Large number of dependencies (${deps.length}). Consider reducing.`);
            }
        }

        // Check peer dependencies
        if (!pkg.peerDependencies || !pkg.peerDependencies['n8n-workflow']) {
            issues.push('Missing n8n-workflow peer dependency');
        }

        if (issues.length > 0) {
            return {
                warning: true,
                message: issues.join(', ')
            };
        }

        return {
            success: true,
            message: 'Dependencies properly configured'
        };
    }

    async validateSecurity() {
        const { spawn } = require('child_process');
        
        return new Promise((resolve) => {
            const audit = spawn('npm', ['audit', '--json'], { 
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true 
            });
            
            let stdout = '';
            let stderr = '';
            
            audit.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            audit.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            audit.on('close', (code) => {
                try {
                    if (code === 0) {
                        resolve({
                            success: true,
                            message: 'No security vulnerabilities found'
                        });
                    } else {
                        const auditResult = JSON.parse(stdout);
                        const vulnerabilities = auditResult.metadata?.vulnerabilities;
                        
                        if (vulnerabilities) {
                            const total = vulnerabilities.total || 0;
                            const critical = vulnerabilities.critical || 0;
                            const high = vulnerabilities.high || 0;
                            
                            if (critical > 0 || high > 0) {
                                resolve({
                                    success: false,
                                    message: `Security vulnerabilities found: ${critical} critical, ${high} high. Run 'npm audit fix' to resolve.`
                                });
                            } else if (total > 0) {
                                resolve({
                                    warning: true,
                                    message: `${total} low/moderate security vulnerabilities found. Consider running 'npm audit fix'.`
                                });
                            } else {
                                resolve({
                                    success: true,
                                    message: 'No significant security vulnerabilities found'
                                });
                            }
                        } else {
                            resolve({
                                success: true,
                                message: 'Security audit completed successfully'
                            });
                        }
                    }
                } catch (error) {
                    resolve({
                        warning: true,
                        message: 'Could not parse security audit results'
                    });
                }
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                audit.kill();
                resolve({
                    warning: true,
                    message: 'Security audit timed out'
                });
            }, 30000);
        });
    }

    async run() {
        this.log('n8n-nodes-fillpdf Publication Validator', 'info');
        this.log('==========================================\n', 'info');
        
        // Run all validation tests
        await this.test('Package.json Configuration', () => this.validatePackageJson());
        await this.test('Required Documentation Files', () => this.validateRequiredFiles());
        await this.test('Built Distribution Files', () => this.validateDistDirectory());
        await this.test('README.md Content', () => this.validateReadme());
        await this.test('License File', () => this.validateLicense());
        await this.test('NPM Ignore Configuration', () => this.validateNpmIgnore());
        await this.test('GitHub Templates', () => this.validateGitHubFiles());
        await this.test('Package Scripts', () => this.validateScripts());
        await this.test('Linting Setup', () => this.validateLintingSetup());
        await this.test('Dependencies', () => this.validateDependencies());
        await this.test('Security Audit', () => this.validateSecurity());
        
        // Print summary
        this.log('\n==========================================', 'info');
        this.log('PUBLICATION READINESS SUMMARY', 'info');
        this.log('==========================================', 'info');
        
        this.log(`✓ Passed: ${this.results.passed}`, 'success');
        this.log(`⚠ Warnings: ${this.results.warnings}`, 'warning');
        this.log(`✗ Failed: ${this.results.failed}`, 'error');
        
        if (this.results.failed === 0) {
            this.log('\n🎉 Package is ready for publication!', 'success');
            
            if (this.results.warnings > 0) {
                this.log('\nNote: Some warnings were found. Consider addressing them before publishing.', 'warning');
            }
            
            this.log('\nNext steps:', 'info');
            this.log('1. Run: npm run release:dry (to test publication)', 'info');
            this.log('2. Run: npm run release (to publish to npm)', 'info');
            this.log('3. Create GitHub release with tag', 'info');
            
        } else {
            this.log('\n❌ Package is not ready for publication. Please address the issues above.', 'error');
            
            this.log('\nRequired actions:', 'info');
            this.log('1. Fix all failed checks', 'info');
            this.log('2. Run this validator again', 'info');
            this.log('3. Test with npm pack --dry-run', 'info');
        }
        
        return this.results.failed === 0;
    }
}

// Run validator if called directly
if (require.main === module) {
    const validator = new PublicationValidator();
    validator.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validator error:', error);
        process.exit(1);
    });
}

module.exports = PublicationValidator;