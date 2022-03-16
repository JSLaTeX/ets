import * as path from 'node:path'
import * as fs from 'node:fs';
const folders = fs.readdirSync('.');
for (const folder of folders) {
	if (folder.endsWith('.ejs')) {
		fs.renameSync(folder, `${path.parse(folder).name}.ets`);
	}
}
