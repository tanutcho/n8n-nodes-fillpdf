# Installation Guide

This guide provides detailed installation instructions for the n8n-nodes-fillpdf community node across different environments and platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Platform-Specific Setup](#platform-specific-setup)
- [Docker Installation](#docker-installation)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **n8n**: Version 0.190.0 or higher
- **Node.js**: Version 16.x or higher
- **Python**: Version 3.7 or higher
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Memory**: Minimum 2GB RAM (4GB+ recommended for large PDFs)
- **Disk Space**: 500MB free space for dependencies

### Python Dependencies

The node requires the `fillpdf` Python library:

```bash
pip install fillpdf
```

### Pre-Installation Checklist

Before installing, verify your environment:

```bash
# Check n8n version
n8n --version

# Check Node.js version  
node --version

# Check Python version
python3 --version

# Check if pip is available
pip3 --version

# Check available disk space
df -h

# Check available memory
free -h  # Linux
vm_stat  # macOS
```

## Installation Methods

### Method 1: n8n Community Nodes Interface (Recommended)

This is the easiest method for most users:

1. **Access n8n Settings**
   - Open your n8n instance
   - Navigate to **Settings** → **Community Nodes**

2. **Install the Node**
   - Click **Install a community node**
   - Enter package name: `n8n-nodes-fillpdf`
   - Click **Install**
   - Wait for installation to complete

3. **Restart n8n**
   - Restart your n8n instance
   - The Fill PDF node should appear in the node palette

### Method 2: npm Installation

For manual installation or development:

```bash
# Navigate to n8n custom nodes directory
cd ~/.n8n/nodes

# Install the package
npm install n8n-nodes-fillpdf

# Restart n8n
```

### Method 3: Global Installation

For system-wide availability:

```bash
# Install globally
npm install -g n8n-nodes-fillpdf

# Set n8n custom nodes path
export N8N_CUSTOM_EXTENSION_ENV=n8n-nodes-fillpdf
```

## Platform-Specific Setup

### Windows

#### Prerequisites Installation

1. **Install Python**:
   - Download from [python.org](https://www.python.org/downloads/)
   - During installation, check "Add Python to PATH"
   - Verify: `python --version`

2. **Install fillpdf**:
   ```cmd
   pip install fillpdf
   ```

3. **Install Node.js**:
   - Download from [nodejs.org](https://nodejs.org/)
   - Install with default options
   - Verify: `node --version`

#### Common Windows Issues

- **Python not found**: Ensure Python is in system PATH
- **Permission errors**: Run Command Prompt as Administrator
- **Long path issues**: Enable long path support in Windows

### macOS

#### Prerequisites Installation

1. **Install Homebrew** (if not installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Python**:
   ```bash
   brew install python3
   ```

3. **Install fillpdf**:
   ```bash
   pip3 install fillpdf
   ```

4. **Install Node.js**:
   ```bash
   brew install node
   ```

#### macOS-Specific Notes

- Use `python3` and `pip3` commands
- May need to install Xcode Command Line Tools: `xcode-select --install`
- For M1 Macs, ensure compatibility with Python packages

### Linux (Ubuntu/Debian)

#### Prerequisites Installation

1. **Update package manager**:
   ```bash
   sudo apt update
   ```

2. **Install Python and pip**:
   ```bash
   sudo apt install python3 python3-pip
   ```

3. **Install fillpdf**:
   ```bash
   pip3 install fillpdf
   ```

4. **Install Node.js**:
   ```bash
   # Using NodeSource repository
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

#### Linux-Specific Notes

- Use `python3` and `pip3` commands
- May need to install build tools: `sudo apt install build-essential`
- For CentOS/RHEL, use `yum` or `dnf` instead of `apt`

### Linux (CentOS/RHEL)

```bash
# Install Python and pip
sudo yum install python3 python3-pip

# Install Node.js
sudo yum install nodejs npm

# Install fillpdf
pip3 install fillpdf
```

## Docker Installation

### Method 1: Dockerfile Extension

Add to your existing n8n Dockerfile:

```dockerfile
FROM n8nio/n8n:latest

# Install Python and pip
USER root
RUN apk add --no-cache python3 py3-pip

# Install fillpdf
RUN pip3 install fillpdf

# Install the community node
RUN npm install n8n-nodes-fillpdf

# Switch back to n8n user
USER node
```

### Method 2: Docker Compose

```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_CUSTOM_EXTENSIONS=n8n-nodes-fillpdf
    volumes:
      - n8n_data:/home/node/.n8n
    command: >
      sh -c "
        apk add --no-cache python3 py3-pip &&
        pip3 install fillpdf &&
        npm install n8n-nodes-fillpdf &&
        n8n start
      "
volumes:
  n8n_data:
```

### Method 3: Runtime Installation

For existing Docker containers:

```bash
# Access running container
docker exec -it n8n-container sh

# Install Python and fillpdf
apk add --no-cache python3 py3-pip
pip3 install fillpdf

# Install the node
npm install n8n-nodes-fillpdf

# Restart n8n (exit and restart container)
exit
docker restart n8n-container
```

## Verification

### Step 1: Check Python Installation

```bash
# Check Python version
python3 --version

# Check fillpdf installation
python3 -c "import fillpdf; print('fillpdf installed successfully')"
```

### Step 2: Check Node Installation

1. **Open n8n interface**
2. **Look for Fill PDF node** in the node palette
3. **Create a test workflow**:
   - Add Manual Trigger node
   - Add Fill PDF node
   - Check if node loads without errors

### Step 3: Test Basic Functionality

Create a simple test:

```javascript
// Test workflow
{
  "nodes": [
    {
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger"
    },
    {
      "name": "Fill PDF Test",
      "type": "n8n-nodes-fillpdf.fillPdf",
      "parameters": {
        "pdfSource": "upload",
        "outputFormat": "binary"
      }
    }
  ]
}
```

## Troubleshooting

### Installation Issues

#### "Package not found" Error

**Cause**: npm registry issues or network problems

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Try different registry
npm install n8n-nodes-fillpdf --registry https://registry.npmjs.org/

# Manual download and install
wget https://registry.npmjs.org/n8n-nodes-fillpdf/-/n8n-nodes-fillpdf-latest.tgz
npm install n8n-nodes-fillpdf-latest.tgz
```

#### "Permission denied" Error

**Cause**: Insufficient permissions for installation

**Solutions**:
```bash
# Linux/macOS - use sudo
sudo npm install -g n8n-nodes-fillpdf

# Windows - run as Administrator
# Or use --unsafe-perm flag
npm install n8n-nodes-fillpdf --unsafe-perm
```

#### "Python not found" Error

**Cause**: Python not in system PATH

**Solutions**:
```bash
# Find Python installation
which python3
whereis python3

# Add to PATH (Linux/macOS)
export PATH="/usr/bin/python3:$PATH"

# Windows - add to system PATH through Environment Variables
```

### Runtime Issues

#### "fillpdf module not found"

**Cause**: fillpdf not installed or wrong Python environment

**Solutions**:
```bash
# Install fillpdf
pip3 install fillpdf

# Check installation
pip3 list | grep fillpdf

# For virtual environments
source venv/bin/activate
pip install fillpdf
```

#### "Node not appearing in palette"

**Cause**: n8n not restarted or installation incomplete

**Solutions**:
1. Restart n8n completely
2. Clear browser cache
3. Check n8n logs for errors
4. Reinstall the node

### Environment-Specific Issues

#### Docker Issues

```bash
# Check if Python is available in container
docker exec -it n8n-container python3 --version

# Check if fillpdf is installed
docker exec -it n8n-container pip3 list | grep fillpdf

# Install missing dependencies
docker exec -it n8n-container pip3 install fillpdf
```

#### Virtual Environment Issues

```bash
# Activate virtual environment
source /path/to/venv/bin/activate

# Install fillpdf in virtual environment
pip install fillpdf

# Start n8n from same environment
n8n start
```

## Advanced Configuration

### Custom Python Path

If Python is installed in a non-standard location:

```bash
# Set custom Python path
export N8N_PYTHON_PATH="/custom/path/to/python3"

# Or in n8n settings
N8N_PYTHON_PATH=/custom/path/to/python3
```

### Performance Tuning

For better performance with large PDFs:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or start n8n with memory limit
node --max-old-space-size=4096 node_modules/n8n/bin/n8n start
```

### Security Configuration

For production environments:

```bash
# Restrict Python execution
export N8N_PYTHON_RESTRICTED=true

# Set temporary directory
export N8N_TEMP_DIR="/secure/temp/path"
```

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs**: Look at n8n logs for detailed error messages
2. **GitHub Issues**: Search existing issues or create a new one
3. **n8n Community**: Ask questions in the n8n community forum
4. **Documentation**: Refer to the main README.md for usage examples

## Next Steps

After successful installation:

1. Read the [Usage Guide](README.md#usage-guide) for workflow examples
2. Check out [Common Patterns](README.md#example-workflows) for inspiration
3. Review [Security Considerations](README.md#security-considerations) for production use
4. Explore [Advanced Features](README.md#advanced-usage) for complex scenarios