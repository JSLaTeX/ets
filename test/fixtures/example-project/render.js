import { createRequire } from 'node:module';

import { join } from 'desm';
import * as ets from 'embedded-ts';

const require = createRequire(import.meta.url);

console.log(
	await ets.renderFile({
		filePath: join(import.meta.url, 'cowsay.ets'),
		options: {
			importResolver: require.resolve,
		}
	})
);