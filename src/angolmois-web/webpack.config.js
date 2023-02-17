module.exports = {
	mode: 'production',
	entry: './src/main.ts',
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
			},
		],
	},
	resolve: {
	  extensions: [
		'.ts', '.js',
	  ],
	},
};
