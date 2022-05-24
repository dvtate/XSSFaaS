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
        'portal/signup': './src/portal/signup_page.ts',
        // Script for the login page
        'portal/login': './src/portal/login_page.ts',
        // Default page behaviors
        'js/page': './src/lib/page.ts',
        // Portal main page script
        'portal/index': './src/portal/index.ts',
        // Script for create function page
        'portal/create_function': './src/portal/create_function_page.ts',
        // Script for the manage function page
        'portal/manage_function': './src/portal/manage_function_page.ts',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'static'),
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
        'portal/signup': './src/portal/signup_page.ts',
        // Script for the login page
        'portal/login': './src/portal/login_page.ts',
        // Default page behaviors
        'js/page': './src/lib/page.ts',
        // Portal main page script
        'portal/index': './src/portal/index.ts',
        // Script for create function page
        'portal/create_function': './src/portal/create_function_page.ts',
        // Script for the manage function page
        'portal/manage_function': './src/portal/manage_function_page.ts',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'static'),
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
