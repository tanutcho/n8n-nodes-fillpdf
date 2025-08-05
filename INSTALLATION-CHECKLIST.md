# Installation Checklist

Use this checklist to ensure proper installation and setup of n8n-nodes-fillpdf.

## Pre-Installation Requirements

### System Requirements
- [ ] **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- [ ] **Memory**: At least 2GB RAM available (4GB+ recommended)
- [ ] **Disk Space**: At least 500MB free space
- [ ] **Network**: Internet connection for downloading packages

### Software Requirements
- [ ] **Node.js**: Version 16.x or higher installed
  ```bash
  node --version  # Should show v16.x.x or higher
  ```
- [ ] **npm**: Package manager available
  ```bash
  npm --version
  ```
- [ ] **Python**: Version 3.7 or higher installed
  ```bash
  python3 --version  # Should show 3.7.x or higher
  ```
- [ ] **pip**: Python package manager available
  ```bash
  pip3 --version
  ```

## Installation Steps

### Step 1: Install Python Dependencies
- [ ] Install fillpdf library
  ```bash
  pip3 install fillpdf
  ```
- [ ] Verify fillpdf installation
  ```bash
  python3 -c "import fillpdf; print('fillpdf version:', fillpdf.__version__)"
  ```

### Step 2: Install n8n Node Package

Choose one installation method:

#### Method A: n8n Community Nodes Interface
- [ ] Open n8n interface
- [ ] Navigate to **Settings** → **Community Nodes**
- [ ] Click **Install a community node**
- [ ] Enter package name: `n8n-nodes-fillpdf`
- [ ] Click **Install**
- [ ] Wait for installation to complete

#### Method B: Manual Installation
- [ ] Navigate to n8n directory
  ```bash
  cd ~/.n8n/nodes
  ```
- [ ] Install package
  ```bash
  npm install n8n-nodes-fillpdf
  ```

#### Method C: Docker Installation
- [ ] Update Dockerfile or docker-compose.yml
- [ ] Add Python and fillpdf to container
- [ ] Install n8n-nodes-fillpdf package
- [ ] Rebuild container

### Step 3: Restart n8n
- [ ] Stop n8n completely
- [ ] Start n8n again
- [ ] Clear browser cache if needed

## Post-Installation Verification

### Step 1: Run Setup Validator
- [ ] Run automated validator
  ```bash
  node setup-validator.js
  ```
- [ ] Address any failed tests
- [ ] Re-run validator until all critical tests pass

### Step 2: Visual Verification
- [ ] Open n8n interface
- [ ] Check node palette for "Fill PDF" node
- [ ] Node should appear under appropriate category

### Step 3: Basic Functionality Test
- [ ] Create new workflow
- [ ] Add Manual Trigger node
- [ ] Add Fill PDF node
- [ ] Configure basic settings
- [ ] Save workflow without errors

### Step 4: Test PDF Processing
- [ ] Upload a simple PDF with form fields
- [ ] Configure field mappings
- [ ] Execute workflow
- [ ] Verify PDF output is generated

## Troubleshooting Common Issues

### Issue: Python not found
- [ ] Check Python installation: `which python3`
- [ ] Add Python to PATH if needed
- [ ] Try alternative Python commands: `python`, `py`

### Issue: fillpdf not found
- [ ] Reinstall fillpdf: `pip3 install fillpdf`
- [ ] Check virtual environment activation
- [ ] Verify Python environment matches n8n environment

### Issue: Node not in palette
- [ ] Restart n8n completely
- [ ] Clear browser cache
- [ ] Check installation location
- [ ] Reinstall package if needed

### Issue: Permission errors
- [ ] Use sudo for global installation (Linux/macOS)
- [ ] Fix npm permissions
- [ ] Check directory ownership

### Issue: Docker problems
- [ ] Verify Python installed in container
- [ ] Check fillpdf installation in container
- [ ] Ensure proper volume mounts
- [ ] Restart container after changes

## Environment-Specific Notes

### Windows
- [ ] Ensure Python added to system PATH
- [ ] Use forward slashes in file paths
- [ ] Run Command Prompt as Administrator if needed
- [ ] Enable long path support if required

### macOS
- [ ] Use `python3` and `pip3` commands
- [ ] Install Xcode Command Line Tools if needed
- [ ] Use Homebrew for package management
- [ ] Check M1 Mac compatibility

### Linux
- [ ] Use `python3` and `pip3` commands
- [ ] Install build tools if needed: `sudo apt install build-essential`
- [ ] Check distribution-specific package managers
- [ ] Verify user permissions

### Docker
- [ ] Use appropriate base image with Python
- [ ] Install system dependencies in Dockerfile
- [ ] Set proper user permissions
- [ ] Mount volumes correctly

## Performance Optimization

### Memory Settings
- [ ] Increase Node.js memory limit if needed
  ```bash
  export NODE_OPTIONS="--max-old-space-size=4096"
  ```

### File Handling
- [ ] Configure temporary directory
  ```bash
  export N8N_TEMP_DIR="/tmp/n8n-pdf"
  ```

### Python Path
- [ ] Set custom Python path if needed
  ```bash
  export N8N_PYTHON_PATH="/usr/bin/python3"
  ```

## Security Considerations

### File Permissions
- [ ] Set appropriate file permissions for output directories
- [ ] Restrict access to temporary files
- [ ] Use secure file paths

### Python Execution
- [ ] Validate Python script inputs
- [ ] Limit subprocess execution time
- [ ] Use isolated Python environment

### Network Security
- [ ] Validate PDF URLs before processing
- [ ] Implement file size limits
- [ ] Sanitize user inputs

## Final Verification

### Complete System Test
- [ ] All validator tests pass
- [ ] Node appears in n8n palette
- [ ] Can create workflows with Fill PDF node
- [ ] Can process sample PDF successfully
- [ ] Error handling works correctly
- [ ] Performance is acceptable

### Documentation Review
- [ ] Read README.md for usage examples
- [ ] Review TROUBLESHOOTING.md for common issues
- [ ] Check EXAMPLES.md for workflow patterns
- [ ] Understand security considerations

### Production Readiness
- [ ] Test with production-like data
- [ ] Verify error handling in edge cases
- [ ] Test performance with large files
- [ ] Implement monitoring and logging
- [ ] Set up backup and recovery procedures

## Getting Help

If you encounter issues during installation:

1. **Check the validator output** for specific error messages
2. **Review TROUBLESHOOTING.md** for detailed solutions
3. **Search GitHub issues** for similar problems
4. **Create new issue** with complete system information
5. **Ask in n8n community** for general n8n questions

## Installation Complete!

Once all items are checked:

- ✅ Your system is ready to use n8n-nodes-fillpdf
- ✅ You can create workflows with PDF form filling
- ✅ You have the tools to troubleshoot issues
- ✅ You understand the security considerations

**Next Steps:**
1. Explore the example workflows in EXAMPLES.md
2. Create your first PDF filling workflow
3. Review advanced configuration options
4. Consider performance optimization for your use case

---

**Installation Date:** ___________  
**Installed By:** ___________  
**System:** ___________  
**Notes:** ___________