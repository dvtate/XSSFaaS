const path = require('path');

// Development watcher
const devConfig = {
    mode: 'development',
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
};

// Select config
module.exports =
    process.env.DEPLOY_ENV && process.env.DEPLOY_ENV.toLowerCase().startsWith('prod')
        ? prodConfig
        : devConfig;
