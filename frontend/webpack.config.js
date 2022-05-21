const path = require('path');

// Development watcher
const devConfig = {
    mode: 'development',
    entry: {
        // Main script for the worker page
        'worker/index': './src/worker/index.ts',
        // Script run by worker threads
        'worker/index.worker': './src/worker/index.worker.ts',
        // Script for the signup page
        '/portal/signup': './src/portal/signup_page.ts',
        // Script for the login page
        '/portal/login': './src/portal/login_page.ts',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    watch: true,
    watchOptions: {
        ignored: /node_modules/,
    },
};

// Production build
const prodConfig = {
    mode: 'production',
    entry: {
        // Main script for the worker page
        'worker/index': './src/worker/index.ts',
        // Script run by worker threads
        'worker/index.worker': './src/worker/index.worker.ts',
        // Script for the signup page
        '/portal/signup': './src/portal/signup_page.ts',
        // Script for the login page
        '/portal/login': './src/portal/login_page.ts',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
};

// Select config
module.exports =
    process.env.DEPLOY_ENV && process.env.DEPLOY_ENV.toLowerCase().startsWith('prod')
        ? prodConfig
        : devConfig;
