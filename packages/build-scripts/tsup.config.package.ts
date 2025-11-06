import { defineConfig } from 'tsup';

const entry = ['src/index.ts'];
const common = {
	clean: true,
	dts: false,
	entry,
	keepNames: true,
	minify: false,
	shims: false,
	skipNodeModulesBundle: true,
	sourcemap: true,
	splitting: false,
	target: 'es2022',
	treeshake: true,
} as const;

export default defineConfig([
	{
		...common,
		format: ['esm', 'cjs'],
		outDir: 'dist',
		outExtension({ format }) {
			return {
				js: format === 'esm' ? '.node.mjs' : '.node.cjs',
			};
		},
		platform: 'node',
	},
	{
		...common,
		format: ['esm', 'cjs'],
		outDir: 'dist',
		outExtension({ format }) {
			return {
				js: format === 'esm' ? '.browser.mjs' : '.browser.cjs',
			};
		},
		platform: 'browser',
	},
	{
		...common,
		format: ['esm'],
		outDir: 'dist',
		outExtension() {
			return { js: '.native.mjs' };
		},
		platform: 'neutral',
	},
]);
