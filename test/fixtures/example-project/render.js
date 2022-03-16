import { createRequire } from 'node:module';
import * as ets from 'embedded-ts';
import { join } from 'desm';

const require = createRequire(import.meta.url);

console.log(
	await ets.renderFile({
		filePath: join(import.meta.url, 'cowsay.ets'),
		options: {
			importResolver: require.resolve,
		}
	})
);