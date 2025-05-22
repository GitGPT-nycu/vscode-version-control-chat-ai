//@ts-check
'use strict';

const path = require('path');
const copyWebpackPlugin = require('copy-webpack-plugin'); 

/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  watchOptions: {
    poll: 1000,
    ignored: /node_modules|dist/,
  },
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'source-map',
  infrastructureLogging: {
    level: "log",
  },
  plugins: [
    new copyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/**/*.html'),
          to: path.resolve(__dirname, 'dist/[name][ext]')
        },
        {
          from: path.resolve(__dirname, 'src/**/*.css'),
          to: path.resolve(__dirname, 'dist/[name][ext]')
        },
        {
          from: path.resolve(__dirname, 'src/**/*.js'),
          to: path.resolve(__dirname, 'dist/[name][ext]')
        }
      ]
    })
  ],
};

module.exports = [ extensionConfig ];
