import { join } from 'desm';
import * as fs from 'node:fs';

import * as ets from '~/index.js';

const output = await ets.render(
	fs.readFileSync(
		join(import.meta.url, '../fixtures/example-project/cowsay.ets'),
		'utf8'
	)
);

console.log(output);
