const { Binary } = require('./index.js');

const b = new Binary('jscythe');
b.configureGitHubRelease('bytemain', 'jscythe', 'v0.0.2');
b.run();
