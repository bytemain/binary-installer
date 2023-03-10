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
  configureUrl(url) {
    this.url = url;
  }
  configureGitHubRelease(owner, repo, releaseTag, proxyUrl) {
    const platform = getPlatform();
    let url = `https://github.com/${owner}/${repo}/releases/download/${releaseTag}/${this.name}-${platform}.tar.gz`;
    if (proxyUrl) {
      url = `${proxyUrl}/${url}`;
    }
    this.url = url;
  }
  install(fetchOptions, options) {
    const { allowReinstall, suppressLogs } = options || {
      allowReinstall: true,
      suppressLogs: false
    };
    const { url } = this;
    if (!url) {
      error(`You must configure the download url of ${this.name} binary`);
    }
    try {
      new URL(url);
    } catch (e) {
      error('this.url: ' + e);
    }

    if (this.exists()) {
      if (allowReinstall) {
        console.log(`\n${this.name} is already installed, reinstalling...`);
        this.uninstall();
      } else {
        console.log(`\n${this.name} is already installed, skipping...`);
        return;
      }
    }

    mkdirSync(this.installDirectory, { recursive: true });
    if (!suppressLogs) {
      console.error(`Downloading binary from ${url}`);
    }

    return axios({ ...fetchOptions, url: this.url, responseType: 'stream' })
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
      console.error(
        `Binary not found at ${this.binaryPath}. Try install first...`
      );
      await this.install();
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
