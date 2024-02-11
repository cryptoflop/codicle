//@ts-check

'use strict';

const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
    filename: 'extension.js'
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts']
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: "node-loader",
        options: {
          name: "[name].[ext]",
        }
      },
      // {
      //   test: /\.node/,
      //   type: 'asset/resource',
      //   generator: {
      //     filename: (pathData) => {
      //       const filenameArr = pathData.filename.split('/')
      //       const path = filenameArr.slice(2, filenameArr.length - 2).join('/').replaceAll('..', '_')
      //       return `${path}/[name][ext]`
      //     }
      //   }
      // },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

const webviewConfig = {
  target: 'web', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/webview/index.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist/webview'),
    // libraryTarget: 'commonjs2'
    filename: 'index.js'
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js'],
    alias: {
      three: path.resolve('./node_modules/three')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader'
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./src/webview/*.(css|html|glb)", to: "[name][ext]" },
        { from: "./src/webview/assets/*", to: "assets/[name][ext]" }
      ]
    }),
  ],
  devtool: 'inline-source-map'
}

module.exports = [extensionConfig, webviewConfig];