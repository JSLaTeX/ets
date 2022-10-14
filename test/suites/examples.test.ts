import * as fs from 'node:fs';
import * as path from 'node:path';

import { join } from 'desm';
import { test } from 'vitest';

import * as ets from '~/index.js';

const fixturesPath = join(import.meta.url, '../fixtures');

function fixture(name: string) {
	return fs.readFileSync(path.join(fixturesPath, name), 'utf8');
}

// wait for https://github.com/vitest-dev/vitest/issues/960 to be fixed
test.skip('compiles example-project', async () => {
	await ets.render(fixture('example-project/cowsay.ets'));
});
