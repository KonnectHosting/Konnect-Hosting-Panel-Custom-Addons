const path = require('node:path');
const repo = path.resolve(__dirname, '../../../..');
const base = require(path.join(repo, 'webpack.config.js'));
const stage = process.env.GMOD_TOOLKIT_BROWSER_STAGE;
const output = process.env.GMOD_TOOLKIT_BROWSER_OUTPUT;
if (!stage || !output) throw new Error('Set disposable stage and browser output paths');
module.exports = {
    ...base,
    context: stage,
    entry: path.join(__dirname, 'entry.tsx'),
    output: { path: path.join(output, 'public'), filename: 'fixture.js', publicPath: '/ui/' },
    resolve: {
        ...base.resolve,
        alias: {
            '@/api/http$': path.join(__dirname, 'http.ts'),
            '@/state/server$': path.join(__dirname, 'server.ts'),
            '@/components/elements/Can$': path.join(__dirname, 'Can.tsx'),
            '@/components/elements/ServerContentBlock$': path.join(__dirname, 'Content.tsx'),
            react$: path.join(repo, 'node_modules/react'),
            'react-dom$': path.join(repo, 'node_modules/react-dom'),
            'react-router-dom$': path.join(repo, 'node_modules/react-router-dom'),
            '@': path.join(stage, 'resources/scripts'),
        },
    },
};
