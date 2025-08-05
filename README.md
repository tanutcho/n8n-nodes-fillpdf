# n8n-nodes-fillpdf

An n8n community node that enables automated PDF form filling within your workflows using the powerful fillpdf Python library. Perfect for generating contracts, applications, invoices, and other form-based documents programmatically.

## 🚀 Quick Start

1. **Install the node** in your n8n instance
2. **Set up Python dependencies** (fillpdf library)
3. **Add the Fill PDF node** to your workflow
4. **Configure your PDF source** and field mappings
5. **Execute and get your filled PDF**

## 📦 Installation

### Prerequisites

Before installing the node, ensure you have:

- **n8n**: Version 0.190.0 or higher
- **Node.js**: Version 16.x or higher  
- **Python**: Version 3.7 or higher
- **fillpdf library**: Python package for PDF processing

### Method 1: n8n Community Nodes (Recommended)

1. In your n8n instance, go to **Settings** → **Community Nodes**
2. Click **Install a community node**
3. Enter the package name: `n8n-nodes-fillpdf`
4. Click **Install**
5. Restart your n8n instance

### Method 2: Manual Installation

```bash
# Navigate to your n8n installation directory
cd ~/.n8n/nodes

# Install the package
npm install n8n-nodes-fillpdf

# Restart n8n
```

### Method 3: Docker Installation

Add to your n8n Docker environment:

```dockerfile
# In your Dockerfile or docker-compose.yml
ENV N8N_CUSTOM_EXTENSIONS="n8n-nodes-fillpdf"
```

Or install at runtime:

```bash
docker exec -it n8n npm install n8n-nodes-fillpdf
docker restart n8n
```

### Verification

After installation, verify the node appears in your n8n palette:

1. Open your n8n interface
2. Look for "Fill PDF" in the node palette
3. If not visible, restart n8n and clear browser cache

### Installation Checklist

For a step-by-step installation guide, see [INSTALLATION-CHECKLIST.md](INSTALLATION-CHECKLIST.md) which provides:

- ✅ Pre-installation requirements checklist
- ✅ Step-by-step installation instructions
- ✅ Post-installation verification steps
- ✅ Troubleshooting common issues
- ✅ Environment-specific notes
- ✅ Performance optimization tips

## ⚙️ Prerequisites & Setup

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **n8n**: Version 0.190.0 or higher
- **Node.js**: Version 16.x or higher
- **Python**: Version 3.7 or higher
- **Memory**: Minimum 2GB RAM (4GB+ recommended for large PDFs)
- **Disk Space**: 500MB free space for dependencies

### Python Environment Setup

This node requires Python 3.7+ and the fillpdf library. Choose one of the following installation methods:

#### Option 1: System-wide Installation
```bash
# Install Python (if not already installed)
# On Ubuntu/Debian:
sudo apt update && sudo apt install python3 python3-pip

# On macOS (with Homebrew):
brew install python3

# On Windows: Download from python.org and add to PATH

# Install fillpdf library
pip3 install fillpdf

# Verify installation
python3 -c "import fillpdf; print('fillpdf version:', fillpdf.__version__)"
```

#### Option 2: Virtual Environment (Recommended)
```bash
# Create virtual environment
python3 -m venv n8n-pdf-env

# Activate virtual environment
# On Linux/macOS:
source n8n-pdf-env/bin/activate
# On Windows:
n8n-pdf-env\Scripts\activate

# Install fillpdf
pip install fillpdf

# Verify installation
python -c "import fillpdf; print('fillpdf installed successfully')"
```

#### Option 3: Using conda
```bash
# Create conda environment
conda create -n n8n-pdf python=3.9
conda activate n8n-pdf

# Install fillpdf
pip install fillpdf

# Verify installation
python -c "import fillpdf; print('fillpdf installed successfully')"
```

### Docker Setup

For Docker environments, add Python and fillpdf to your container:

```dockerfile
FROM n8nio/n8n:latest

# Switch to root to install packages
USER root

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Install fillpdf
RUN pip3 install fillpdf

# Switch back to n8n user
USER node
```

### Environment Variables

Optional environment variables for customization:

```bash
# Custom Python executable path
export N8N_PYTHON_PATH="/usr/bin/python3"

# Temporary directory for PDF processing
export N8N_TEMP_DIR="/tmp/n8n-pdf"

# Enable debug logging
export DEBUG=n8n-nodes-fillpdf:*
```

### Verification & Testing

#### Automated Setup Validation

Run the included setup validator to check your installation:

```bash
# Run the setup validator
node setup-validator.js

# Or if you have the package installed
npx n8n-nodes-fillpdf validate-setup
```

The validator will check:
- ✅ Node.js version compatibility
- ✅ Python installation and version
- ✅ fillpdf library availability
- ✅ System resources (memory, disk space)
- ✅ Basic PDF processing functionality
- ✅ n8n installation (if available)

#### Manual Verification

You can also verify components manually:

```bash
# Check Python installation
python3 --version

# Check fillpdf installation
python3 -c "import fillpdf; print('fillpdf version:', fillpdf.__version__)"

# Check n8n version
n8n --version

# Test basic PDF processing
python3 -c "
import fillpdf
import tempfile
print('Basic PDF processing test passed')
"
```

#### Test Workflow

Create a simple test workflow to verify everything works:

1. **Create test workflow** in n8n
2. **Add Manual Trigger** node
3. **Add Fill PDF** node with a simple PDF
4. **Configure basic field mapping**
5. **Execute workflow** and check for errors

## 🎯 Usage Guide

### Basic Workflow Setup

1. **Add the Fill PDF node** to your workflow from the node palette
2. **Configure the PDF source**:
   - **Upload**: Upload a PDF file directly
   - **URL**: Provide a URL to a PDF file
   - **Binary**: Use PDF data from previous nodes

3. **Set up field mappings**:
   - The node will automatically detect form fields in your PDF
   - Map each field to static values or dynamic expressions
   - Use n8n expressions like `{{ $json.customerName }}` for dynamic data

4. **Choose output format**:
   - **Binary**: Return PDF as binary data for further processing
   - **File**: Save PDF to a specified file path
   - **Both**: Get binary data and save to file

### Common Workflow Patterns

#### Pattern 1: Simple Form Filling

Basic PDF form filling with static and dynamic values:

```javascript
// Workflow: Manual Trigger → Set Data → Fill PDF
{
  "nodes": [
    {
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger"
    },
    {
      "name": "Set Form Data", 
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            {"name": "customerName", "value": "John Doe"},
            {"name": "email", "value": "john@example.com"},
            {"name": "phone", "value": "+1-555-0123"}
          ]
        }
      }
    },
    {
      "name": "Fill Application Form",
      "type": "n8n-nodes-fillpdf.fillPdf",
      "parameters": {
        "pdfSource": "upload",
        "pdfFile": "application-form.pdf",
        "fieldMappings": {
          "mapping": [
            {
              "pdfFieldName": "applicant_name",
              "valueSource": "expression",
              "expression": "{{ $json.customerName }}"
            },
            {
              "pdfFieldName": "email_address",
              "valueSource": "expression", 
              "expression": "{{ $json.email }}"
            },
            {
              "pdfFieldName": "phone_number",
              "valueSource": "expression",
              "expression": "{{ $json.phone }}"
            },
            {
              "pdfFieldName": "application_date",
              "valueSource": "expression",
              "expression": "{{ $now.format('YYYY-MM-DD') }}"
            }
          ]
        },
        "outputFormat": "binary"
      }
    }
  ]
}
```

#### Pattern 2: Database-Driven Document Generation

Generate documents from database records:

```javascript
// Workflow: Database → Process Data → Fill PDF → Save/Email
{
  "nodes": [
    {
      "name": "Get Customer Orders",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "query": "SELECT * FROM orders WHERE status = 'completed' AND invoice_generated = false"
      }
    },
    {
      "name": "Fill Invoice Template",
      "type": "n8n-nodes-fillpdf.fillPdf", 
      "parameters": {
        "pdfSource": "upload",
        "pdfFile": "invoice-template.pdf",
        "fieldMappings": {
          "mapping": [
            {
              "pdfFieldName": "invoice_number",
              "valueSource": "expression",
              "expression": "INV-{{ $json.order_id }}"
            },
            {
              "pdfFieldName": "customer_name",
              "valueSource": "expression",
              "expression": "{{ $json.customer_name }}"
            },
            {
              "pdfFieldName": "order_total",
              "valueSource": "expression", 
              "expression": "${{ $json.total_amount }}"
            },
            {
              "pdfFieldName": "invoice_date",
              "valueSource": "expression",
              "expression": "{{ $now.format('YYYY-MM-DD') }}"
            }
          ]
        },
        "outputFormat": "both",
        "outputPath": "/invoices/{{ $json.order_id }}_invoice.pdf"
      }
    },
    {
      "name": "Email Invoice",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "toEmail": "{{ $json.customer_email }}",
        "subject": "Invoice #INV-{{ $json.order_id }}",
        "attachments": "data:application/pdf;base64,{{ $binary.pdf.data }}"
      }
    }
  ]
}
```

#### Pattern 3: Batch Processing with Error Handling

Process multiple PDFs with comprehensive error handling:

```javascript
// Workflow: CSV Input → Split → Fill PDF → Handle Errors
{
  "nodes": [
    {
      "name": "Read Employee Data",
      "type": "n8n-nodes-base.spreadsheetFile",
      "parameters": {
        "filePath": "employees.csv"
      }
    },
    {
      "name": "Fill Employment Contract",
      "type": "n8n-nodes-fillpdf.fillPdf",
      "parameters": {
        "pdfSource": "upload",
        "pdfFile": "employment-contract-template.pdf",
        "fieldMappings": {
          "mapping": [
            {
              "pdfFieldName": "employee_name",
              "valueSource": "expression",
              "expression": "{{ $json.first_name }} {{ $json.last_name }}"
            },
            {
              "pdfFieldName": "position",
              "valueSource": "expression",
              "expression": "{{ $json.job_title }}"
            },
            {
              "pdfFieldName": "salary",
              "valueSource": "expression",
              "expression": "${{ $json.annual_salary }}"
            },
            {
              "pdfFieldName": "start_date",
              "valueSource": "expression",
              "expression": "{{ $json.start_date }}"
            }
          ]
        },
        "outputFormat": "file",
        "outputPath": "/contracts/{{ $json.employee_id }}_contract.pdf",
        "continueOnFail": true
      }
    },
    {
      "name": "Handle Success",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            {"name": "status", "value": "success"},
            {"name": "message", "value": "Contract generated successfully"}
          ]
        }
      }
    },
    {
      "name": "Handle Errors",
      "type": "n8n-nodes-base.set", 
      "parameters": {
        "values": {
          "string": [
            {"name": "status", "value": "error"},
            {"name": "message", "value": "{{ $json.error.message }}"}
          ]
        }
      }
    }
  ]
}
```

#### Pattern 4: Dynamic PDF Templates

Use different PDF templates based on conditions:

```javascript
// Workflow: Input → Switch → Fill Different PDFs
{
  "nodes": [
    {
      "name": "Document Request",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "generate-document"
      }
    },
    {
      "name": "Route by Document Type",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "values": [
          {
            "conditions": [
              {
                "leftValue": "{{ $json.document_type }}",
                "rightValue": "contract",
                "operator": "equal"
              }
            ]
          },
          {
            "conditions": [
              {
                "leftValue": "{{ $json.document_type }}",
                "rightValue": "invoice", 
                "operator": "equal"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "Fill Contract",
      "type": "n8n-nodes-fillpdf.fillPdf",
      "parameters": {
        "pdfSource": "upload",
        "pdfFile": "contract-template.pdf",
        "fieldMappings": {
          "mapping": [
            {
              "pdfFieldName": "client_name",
              "valueSource": "expression",
              "expression": "{{ $json.client_name }}"
            }
          ]
        }
      }
    },
    {
      "name": "Fill Invoice", 
      "type": "n8n-nodes-fillpdf.fillPdf",
      "parameters": {
        "pdfSource": "upload",
        "pdfFile": "invoice-template.pdf",
        "fieldMappings": {
          "mapping": [
            {
              "pdfFieldName": "customer_name",
              "valueSource": "expression",
              "expression": "{{ $json.client_name }}"
            }
          ]
        }
      }
    }
  ]
}
```

### Field Mapping Examples

#### Text Fields
```javascript
{
  "pdfFieldName": "customer_name",
  "valueSource": "expression",
  "expression": "{{ $json.firstName }} {{ $json.lastName }}"
}
```

#### Checkbox Fields
```javascript
{
  "pdfFieldName": "terms_accepted",
  "valueSource": "expression", 
  "expression": "{{ $json.agreedToTerms }}"  // true/false
}
```

#### Date Fields
```javascript
{
  "pdfFieldName": "contract_date",
  "valueSource": "expression",
  "expression": "{{ $now.format('MM/DD/YYYY') }}"
}
```

#### Calculated Fields
```javascript
{
  "pdfFieldName": "total_with_tax",
  "valueSource": "expression",
  "expression": "{{ ($json.subtotal * 1.08).toFixed(2) }}"
}
```

#### Conditional Fields
```javascript
{
  "pdfFieldName": "discount_amount",
  "valueSource": "expression",
  "expression": "{{ $json.isVip ? ($json.total * 0.1).toFixed(2) : '0.00' }}"
}
```

For more detailed examples, see [EXAMPLES.md](EXAMPLES.md).

### Field Mapping Guide

#### Static Values
Use static values for fields that don't change:
```javascript
{
  "pdfFieldName": "company_name",
  "valueSource": "static",
  "staticValue": "Acme Corporation"
}
```

#### Dynamic Expressions
Use n8n expressions for dynamic data:
```javascript
{
  "pdfFieldName": "customer_email",
  "valueSource": "expression", 
  "expression": "{{ $json.email }}"
}
```

#### Field Types Support

| PDF Field Type | Supported Values | Example |
|----------------|------------------|---------|
| Text | String values | `"John Doe"` |
| Checkbox | Boolean values | `true`, `false` |
| Radio Button | String (option name) | `"option1"` |
| Dropdown | String (option value) | `"value1"` |

## 🔧 Configuration Options

### PDF Source Options

| Option | Description | Use Case |
|--------|-------------|----------|
| `upload` | Upload PDF file directly | Static templates |
| `url` | Fetch PDF from URL | Remote templates |
| `binary` | Use PDF from previous node | Dynamic templates |

### Output Format Options

| Option | Description | Output |
|--------|-------------|--------|
| `binary` | Return as binary data | For further processing |
| `file` | Save to file system | For storage/archival |
| `both` | Binary data + file save | Maximum flexibility |

### Advanced Options

| Option | Default | Description |
|--------|---------|-------------|
| `flattenPdf` | `false` | Remove form fields after filling |
| `validateFields` | `true` | Validate field existence |
| `skipMissingFields` | `false` | Continue if fields are missing |

## 🚨 Troubleshooting

### Quick Diagnostics

Run these commands to identify common issues:

```bash
# Check Python installation
python3 --version

# Check fillpdf installation  
python3 -c "import fillpdf; print('fillpdf version:', fillpdf.__version__)"

# Check Node.js version
node --version

# Check n8n version
n8n --version

# Verify node installation
npm list n8n-nodes-fillpdf
```

### Common Setup Issues

#### 1. "Python not found" Error
**Symptoms**: `Error: spawn python3 ENOENT`

**Solutions**:
```bash
# Check if Python is installed
which python3

# Install Python if missing
# Ubuntu/Debian: sudo apt install python3
# macOS: brew install python3  
# Windows: Download from python.org

# Add Python to PATH
export PATH="/usr/bin/python3:$PATH"

# For custom Python location
export N8N_PYTHON_PATH="/usr/bin/python3"
```

#### 2. "fillpdf module not found" Error
**Symptoms**: `ModuleNotFoundError: No module named 'fillpdf'`

**Solutions**:
```bash
# Install fillpdf
pip3 install fillpdf

# For virtual environments
source venv/bin/activate
pip install fillpdf

# Verify installation
python3 -c "import fillpdf; print('OK')"
```

#### 3. Node Not Appearing in Palette
**Symptoms**: Fill PDF node not visible in n8n

**Solutions**:
```bash
# Restart n8n completely
pkill -f n8n
n8n start

# Clear browser cache and refresh

# Reinstall the node
npm uninstall n8n-nodes-fillpdf
npm install n8n-nodes-fillpdf
```

#### 4. "Permission denied" Errors
**Symptoms**: Cannot write files or access directories

**Solutions**:
```bash
# Check and fix directory permissions
ls -la /path/to/output/directory
chmod 755 /path/to/output/directory

# For npm installation issues
sudo npm install n8n-nodes-fillpdf
# Or fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
```

#### 5. Docker-Specific Issues
**Symptoms**: Python/fillpdf not available in container

**Solutions**:
```bash
# Install in running container
docker exec -it n8n-container sh
apk add --no-cache python3 py3-pip
pip3 install fillpdf

# Or update Dockerfile
FROM n8nio/n8n:latest
USER root
RUN apk add --no-cache python3 py3-pip && pip3 install fillpdf
USER node
```

### PDF Processing Issues

#### "PDF has no fillable fields"
- Verify PDF contains form fields (not just text)
- Use Adobe Reader to check for fillable fields
- Create fillable PDF using PDF editor

#### "Field mapping failed"
- Check exact field names (case-sensitive)
- Use field inspection to get correct names:
  ```python
  import fillpdf
  fields = fillpdf.get_form_fields('your-pdf.pdf')
  print(fields)
  ```

#### Memory Issues with Large PDFs
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Use file output instead of binary
# Process in smaller batches
```

### Debug Mode

Enable detailed logging:

```bash
# Environment variable
export DEBUG=n8n-nodes-fillpdf:*

# n8n log level
export N8N_LOG_LEVEL=debug

# Start n8n with debug info
DEBUG=n8n-nodes-fillpdf:* n8n start
```

### Getting Help

If issues persist:

1. **Check logs**: Look at n8n logs for detailed errors
2. **GitHub Issues**: Search existing issues or create new one
3. **Documentation**: Review [INSTALLATION.md](INSTALLATION.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
4. **Community**: Ask in n8n community forums

When reporting issues, include:
- System information (OS, Node.js, Python versions)
- Full error messages and logs
- Node configuration (sanitized)
- Steps to reproduce

## 🔒 Security Considerations

### File Handling
- Validate PDF files before processing
- Use absolute paths for output files
- Implement file size limits
- Sanitize file names

### Expression Safety
- Avoid using `eval()` in expressions
- Validate user input in expressions
- Use n8n's built-in expression functions

### Python Execution
- Run Python in isolated environment
- Limit subprocess execution time
- Validate Python script inputs

## 🧪 Testing Your Setup

### Test Script

Create a test workflow to verify everything works:

```javascript
// Test data
const testData = {
  "customerName": "John Doe",
  "email": "john@example.com", 
  "amount": "$1,000.00"
};

// Simple test PDF with text fields:
// - customer_name
// - email  
// - amount
```

### Validation Checklist

- [ ] Python 3.7+ installed and accessible
- [ ] fillpdf library installed (`pip list | grep fillpdf`)
- [ ] n8n can execute Python scripts
- [ ] PDF templates have fillable form fields
- [ ] Output directory exists and is writable
- [ ] Field mappings match PDF field names exactly

## 📚 Advanced Usage

### Custom Python Scripts

For advanced use cases, you can extend the Python processing:

```python
# custom-processor.py
import fillpdf
import json
import sys

def custom_fill_logic(pdf_path, data):
    # Your custom logic here
    pass

if __name__ == "__main__":
    # Process command line arguments
    pass
```

### Integration Patterns

#### With Database Nodes
```
Database → Fill PDF → Email/Storage
```

#### With HTTP Requests  
```
Webhook → Data Processing → Fill PDF → Response
```

#### With File Operations
```
File Trigger → Fill PDF → File Move/Copy
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/n8n-nodes-fillpdf.git
cd n8n-nodes-fillpdf

# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## 📄 Features

- ✅ **Multiple PDF Sources**: Upload, URL, or binary data input
- ✅ **Field Type Support**: Text, checkbox, radio buttons, dropdowns
- ✅ **Dynamic Mapping**: Use n8n expressions for dynamic field values
- ✅ **Batch Processing**: Handle multiple PDFs in single workflow
- ✅ **Flexible Output**: Binary data, file save, or both
- ✅ **Error Handling**: Comprehensive error reporting and recovery
- ✅ **Validation**: Field existence and type validation
- ✅ **Security**: Safe Python execution and file handling
- ✅ **Performance**: Optimized for large files and batch operations

## Development

### Build

```bash
npm run build
```

### Testing

```bash
# Note: Comprehensive test suite is currently being refactored
# Core functionality is verified through:
npm run build  # TypeScript compilation
npm run lint   # Code quality and n8n standards
npm run audit  # Security validation

# Test commands (currently disabled during refactoring):
# npm test
# npm run test:coverage
# npm run test:watch
```

### Code Quality

```bash
# Check linting (TypeScript, ESLint with n8n rules, Prettier)
npm run lint

# Fix linting issues and format code
npm run lint:fix

# Format code only
npm run format

# Check code formatting
npm run format:check
```

**Linting Features:**
- **TypeScript compilation** checking
- **ESLint** with n8n-nodes-base plugin for n8n-specific rules
- **Prettier** integration for consistent code formatting
- **Automated fixes** for many common issues

### Validation

```bash
# Validate setup environment
npm run validate-setup

# Validate publication readiness
npm run validate-publication

# Security audit
npm run audit

# Fix security vulnerabilities
npm run audit:fix
```

### Release

```bash
# Test release (dry run)
npm run release:dry

# Publish to npm
npm run release
```

## License

MIT

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [fillpdf Python library](https://pypi.org/project/fillpdf/)