#!/usr/bin/env python3

import subprocess
import sys
import os
import platform

def run_command(cmd, check=True, capture_output=False):
    """Run a shell command and return the result."""
    try:
        result = subprocess.run(cmd, shell=True, check=check, capture_output=capture_output, text=True)
        if capture_output:
            return result.stdout.strip(), result.stderr.strip()
        return True
    except subprocess.CalledProcessError as e:
        if capture_output:
            return None, e.stderr.strip()
        return False

def is_installed(program):
    """Check if a program is installed."""
    stdout, _ = run_command(f"which {program}", capture_output=True)
    return bool(stdout)

def get_version(program):
    """Get version of a program."""
    stdout, stderr = run_command(f"{program} --version", capture_output=True)
    if stdout:
        return stdout.split()[0] if stdout.split() else "unknown"
    return None

def install_node_npm():
    """Install Node.js and npm if not installed. Assumes Debian/Ubuntu."""
    system = platform.system().lower()
    if system != "linux":
        print("This script assumes Linux (Debian/Ubuntu). Adjust for other OS.")
        sys.exit(1)
    
    distro = platform.linux_distribution()[0].lower() if hasattr(platform, 'linux_distribution') else "unknown"
    if "ubuntu" not in distro and "debian" not in distro:
        print("Assuming Ubuntu/Debian for package installation.")
    
    if is_installed("node"):
        node_ver = get_version("node")
        print(f"Node.js is already installed: {node_ver}")
        if is_installed("npm"):
            npm_ver = get_version("npm")
            print(f"npm is already installed: {npm_ver}")
            return
        else:
            print("npm not found, installing via apt.")
            run_command("sudo apt update")
            run_command("sudo apt install -y npm")
            return
    
    print("Node.js and npm not found, installing...")
    run_command("sudo apt update")
    run_command("curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -")
    run_command("sudo apt install -y nodejs")
    if get_version("npm") is None:
        run_command("sudo apt install -y npm")

def install_chrome():
    """Install Google Chrome if not installed. Assumes Debian/Ubuntu."""
    if is_installed("google-chrome"):
        chrome_ver = get_version("google-chrome")
        print(f"Google Chrome is already installed: {chrome_ver}")
        return
    
    print("Google Chrome not found, installing...")
    run_command("wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -")
    run_command("sudo sh -c 'echo \"deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main\" >> /etc/apt/sources.list.d/google-chrome.list'")
    run_command("sudo apt update")
    run_command("sudo apt install -y google-chrome-stable")

def install_npm_packages():
    """Install required npm packages."""
    packages = ["hpack", "colors", "puppeteer-real-browser"]
    for pkg in packages:
        if run_command(f"npm list -g {pkg}", capture_output=True)[0] is None:
            print(f"Global {pkg} not found, installing...")
            run_command(f"sudo npm install -g {pkg}")
        else:
            print(f"{pkg} is already installed globally.")

def main():
    print("Starting installation of Node.js, npm, Chrome, and required packages...")
    
    install_node_npm()
    install_chrome()
    install_npm_packages()
    
    print("Installation complete!")
    print("To run the Node.js script, save it as e.g., captcha2.js and run: node captcha2.js <target> <time> <rate> <threads> <cookieCount> <proxyFile>")

if __name__ == "__main__":
    main()
