const { Binary } = require('./index.js');

const b = new Binary('jscythe');
b.installFromGitHubRelease('bytemain', 'jscythe', 'v0.0.2').then(() => {
  b.run();
});
