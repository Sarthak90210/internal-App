const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

// Register require hook for .js files in src
require.extensions['.js'] = function(module, filename) {
  if (filename.includes('node_modules')) {
    return module._compile(fs.readFileSync(filename, 'utf8'), filename);
  }
  const content = fs.readFileSync(filename, 'utf8');
  const transformed = babel.transformSync(content, {
    filename,
    plugins: [
      require.resolve('@babel/plugin-transform-modules-commonjs'),
      [require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'classic' }]
    ]
  });
  module._compile(transformed.code, filename);
};

const { useAuthStore } = require('../src/stores/authStore');

console.log('authStore loaded:', typeof useAuthStore);
console.log('initial state:', useAuthStore.getState());
