const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, './'),
  roots: ['<rootDir>/tests/'],
  testMatch: ['<rootDir>/tests/**/(*.)+(spec|test).[jt]s?(x)'],
  transform: {
    '^.+\\.(js|jsx|mjs)$': '<rootDir>/node_modules/babel-jest',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs)$',
  ],
};
