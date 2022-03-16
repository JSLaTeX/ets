import * as fs from 'node:fs';
import { program } from 'commander';
import { renderFile } from '~/utils/ets.js';

program
	.requiredOption(
		'-o, --out <outputFile>',
		'the file name the compiled ETS file is saved as'
	)
	.argument('<file>', 'the ETS file to compile')
	.parse();

const file = program.args[0]!;
const { out } = program.opts<{ out: string }>();

const outputString = await renderFile({ filePath: file });
fs.writeFileSync(out, outputString);
