const path = require('path');

// Development watcher
const devConfig = {
    entry: {
        worker: './src/worker/index.ts'
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.bundle.js'
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
    mode: 'development',
    watch: true,
    watchOptions: {
        ignored: /node_modules/,
    },
};

// Production build
const prodConfig = {
    mode: 'production',
    entry: {
        worker: './src/worker/index.ts'
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
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
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'main.bundle.js'
    },
};

// Select config
module.exports =
    process.env.DEPLOY_ENV && process.env.DEPLOY_ENV.toLowerCase().startsWith('prod')
        ? prodConfig
        : devConfig;
