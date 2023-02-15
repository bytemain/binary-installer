const { existsSync, mkdirSync, rmSync } = require('fs');
const { join } = require('path');
const { spawn } = require('child_process');
const os = require('os');

const axios = require('axios');
const tar = require('tar');

const rmrf = (path) => {
  return rmSync(path, { force: true, recursive: true });
};

const error = (msg) => {
  console.error(msg);
  process.exit(1);
};

function getPlatform() {
  const type = os.type();
  const arch = os.arch();

  if (type === 'Windows_NT') return `windows-${arch}`;
  if (type === 'Linux') return `linux-${arch}`;
  if (type === 'Darwin') return `darwin-${arch}`;

  throw new Error(`Unsupported platform: ${type} ${arch}`);
}

class Binary {
  constructor(name, baseDir = __dirname) {
    let errors = [];
    if (name && typeof name !== 'string') {
      errors.push('name must be a string');
    }
    if (!name) {
      errors.push('You must specify the name of your binary');
    }
    this.name = name;
    this.installDirectory = join(baseDir, 'bin');

    if (!existsSync(this.installDirectory)) {
      mkdirSync(this.installDirectory, { recursive: true });
    }

    this.binaryPath = join(this.installDirectory, this.name);
  }
  exists() {
    return existsSync(this.binaryPath);
  }
  uninstall() {
    if (existsSync(this.installDirectory)) {
      rmrf(this.installDirectory);
    }
  }
  installFromGitHubRelease(owner, repo, releaseTag, proxyUrl) {
    const platform = getPlatform();
    let url = `https://github.com/${owner}/${repo}/releases/download/${releaseTag}/${this.name}-${platform}.tar.gz`;
    if (proxyUrl) {
      url = `${proxyUrl}/${url}`;
    }

    return this.install({ url });
  }
  install(fetchOptions, suppressLogs = false) {
    const { url } = fetchOptions;
    try {
      new URL(url);
    } catch (e) {
      error(e);
    }

    if (existsSync(this.installDirectory)) {
      rmrf(this.installDirectory);
    }
    mkdirSync(this.installDirectory, { recursive: true });
    if (!suppressLogs) {
      console.error(`Downloading binary from ${url}`);
    }

    return axios({ ...fetchOptions, responseType: 'stream' })
      .then((res) => {
        return new Promise((resolve, reject) => {
          const sink = res.data.pipe(
            tar.x({ strip: 1, C: this.installDirectory })
          );
          sink.on('finish', () => resolve());
          sink.on('error', (err) => reject(err));
        });
      })
      .then(() => {
        if (!suppressLogs) {
          console.error(`${this.name} has been installed!`);
        }
      })
      .catch((e) => {
        error(`Error fetching release: ${e.message}`);
      });
  }

  async run() {
    if (!this.exists()) {
      error(`Binary not found at ${this.binaryPath}. Please install it first.`)
    }
    const [, , ...args] = process.argv;

    const child = spawn(this.binaryPath, args, {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      console.log(`\nProcess exited with code ${code}`);
    });
  }
}

module.exports = {
  Binary,
  getPlatform
};
