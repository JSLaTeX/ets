import { join } from 'desm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import * as ets from '~/index.js';

const users = [{ name: 'geddy' }, { name: 'neil' }, { name: 'alex' }];

const fixturesPath = join(import.meta.url, '../fixtures');

function fixture(name: string) {
	return fs.readFileSync(path.join(fixturesPath, name), 'utf8');
}

const tempFolder = join(import.meta.url, '../temp');

beforeAll(() => {
	fs.mkdirSync(tempFolder, { recursive: true });
});

function hookStdio(
	stream: NodeJS.WriteStream,
	callback: (string: string, encoding: string, fd: unknown) => void
) {
	const oldWrite = stream.write;

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	stream.write = function (string: string, encoding: string, fd: unknown) {
		callback(string, encoding, fd);
	} as any;

	return function () {
		stream.write = oldWrite;
	};
}

describe('ets.compile(string, options)', () => {
	test('compile to a function', async () => {
		const fn = await ets.compile('<p>yay</p>');
		expect(await fn()).toEqual('<p>yay</p>');
	});

	test('empty input works', async () => {
		const fn = await ets.compile('');
		expect(await fn()).toEqual('');
	});

	test('throw if there are syntax errors', async () => {
		await expect(async () => {
			await ets.compile(fixture('fail.ets'));
		}).rejects.toBeDefined();
	});

	test('allow customizing delimiter local var', async () => {
		let fn;
		fn = await ets.compile('<p><?= name ?></p>', { delimiter: '?' });

		expect(await fn({ name: 'geddy' })).toEqual('<p>geddy</p>');

		fn = await ets.compile('<p><:= name :></p>', { delimiter: ':' });
		expect(await fn({ name: 'geddy' })).toEqual('<p>geddy</p>');

		fn = await ets.compile('<p><$= name $></p>', { delimiter: '$' });
		expect(await fn({ name: 'geddy' })).toEqual('<p>geddy</p>');
	});

	test('allow customizing open and close delimiters', async () => {
		const fn = await ets.compile('<p>[#= name #]</p>', {
			delimiter: '#',
			openDelimiter: '[',
			closeDelimiter: ']',
		});
		expect(await fn({ name: 'geddy' })).toEqual('<p>geddy</p>');
	});

	test('support custom escape function', async () => {
		const customEscape = (str: string) => str?.toUpperCase() ?? '';

		const fn = await ets.compile('HELLO <%= name %>', { escape: customEscape });
		expect(await fn({ name: 'world' })).toEqual('HELLO WORLD');
	});

	test('can compile to an async function', async () => {
		const value = await ets.render({
			template: '<%= await "Hi" %>',
		});

		expect(value).toEqual('Hi');
	});

	test('Compiled function name matches `filename` without the extension', async () => {
		const func = await ets.compile('<%= "Foo" %>', {
			filename: 'foo.ets',
		});

		expect(func.name).toEqual('foo');
	});
});

describe('ets.render(str, data, opts)', () => {
	test('render the template', async () => {
		expect(await ets.render('<p>yay</p>')).toEqual('<p>yay</p>');
		expect(await ets.render({ template: '<p>yay</p>' })).toEqual('<p>yay</p>');
	});

	test('empty input works', async () => {
		expect(await ets.render('')).toEqual('');
		expect(await ets.render({ template: '' })).toEqual('');
	});

	test('undefined renders nothing escaped', async () => {
		expect(await ets.render('<%= undefined %>')).toEqual('');
	});

	test('undefined renders nothing raw', async () => {
		expect(await ets.render('<%- undefined %>'), '');
	});

	test('null renders nothing escaped', async () => {
		expect(await ets.render('<%= null %>')).toEqual('');
	});

	test('null renders nothing raw', async () => {
		expect(await ets.render('<%- null %>')).toEqual('');
	});

	test('zero-value data item renders something escaped', async () => {
		expect(await ets.render('<%= 0 %>')).toEqual('0');
	});

	test('zero-value data object renders something raw', async () => {
		expect(await ets.render('<%- 0 %>')).toEqual('0');
	});

	test('accept locals', async () => {
		expect(
			await ets.render({
				template: '<p><%= name %></p>',
				data: { name: 'geddy' },
			})
		).toEqual('<p>geddy</p>');
	});
});

describe('ets.renderFile(path, [data], [options], [fn])', async () => {
	test('render a file', async () => {
		expect(await ets.renderFile('test/fixtures/para.ets')).toEqual(
			'<p>hey</p>\n'
		);
	});

	test('accept locals', async () => {
		const data = { name: 'fonebone' };
		const options = { delimiter: '$' };
		const html = await ets.renderFile({
			filePath: 'test/fixtures/user.ets',
			data,
			options,
		});
		expect(html).toEqual('<h1>fonebone</h1>\n');
	});
});

test('support express multiple views folders, falls back to second if first is not available', async () => {
	const data = {
		viewsText: 'test',
		includePath: 'views-include.ets',
		settings: {
			views: [path.join(fixturesPath, 'nonexistent-folder'), fixturesPath],
		},
	};
	const value = await ets.renderFile({
		filePath: path.join(fixturesPath, 'views.ets'),
		data,
	});

	expect(value).toEqual('<div><p>global test</p>\n</div>\n');
});

test('can reference by paths with directory names', async () => {
	const data = {
		viewsText: 'test',
		includePath: 'views/views-include.ets',
		settings: {
			views: [path.join(fixturesPath, '/views'), fixturesPath],
		},
	};
	const value = await ets.renderFile({
		filePath: path.join(fixturesPath, 'views.ets'),
		data,
	});

	expect(value).toEqual('<div><p>custom test</p>\n</div>\n');
});

describe('<%', () => {
	test('without semicolons', async () => {
		expect(await ets.render(fixture('no.semicolons.ets'))).toEqual(
			fixture('no.semicolons.html')
		);
	});
});

describe('<%=', () => {
	test('should not throw an error with a // comment on the final line', async () => {
		expect(
			await ets.render({
				template: '<%=\n// a comment\nname\n// another comment %>',
				data: {
					name: '&nbsp;<script>',
				},
			})
		).toEqual('&amp;nbsp;&lt;script&gt;');
	});

	test('escape &amp;<script>', async () => {
		expect(
			await ets.render({
				template: '<%= name %>',
				data: { name: '&nbsp;<script>' },
			})
		).toEqual('&amp;nbsp;&lt;script&gt;');
	});

	test("should escape '", async () => {
		expect(
			await ets.render({
				template: '<%= name %>',
				data: { name: "The Jones's" },
			})
		).toEqual('The Jones&apos;s');
	});

	test('should escape &foo_bar;', async () => {
		expect(
			await ets.render({ template: '<%= name %>', data: { name: '&foo_bar;' } })
		).toEqual('&amp;foo_bar;');
	});

	test('should accept custom function', async () => {
		const customEscape = (str: string) => str?.toUpperCase() ?? '';

		expect(
			await ets.render({
				template: '<%= name %>',
				data: { name: "The Jones's" },
				options: { escape: customEscape },
			})
		).toEqual("THE JONES'S");
	});
});

describe('<%-', () => {
	test('should not throw an error with a // comment on the final line', async () => {
		expect(
			await ets.render({
				template: '<%-\n// a comment\nname\n// another comment %>',
				data: {
					name: '&nbsp;<script>',
				},
			})
		).toEqual('&nbsp;<script>');
	});

	test('not escape', async () => {
		expect(
			await ets.render({ template: '<%- name %>', data: { name: '<script>' } })
		).toEqual('<script>');
	});

	test('terminate gracefully if no close tag is found', async () => {
		await expect(async () => {
			await ets.compile('<h1>oops</h1><%- name ->');
		}).rejects.toThrow(/Could not find matching close tag for/);
	});
});

describe('%>', () => {
	test('produce newlines', async () => {
		expect(
			await ets.render({ template: fixture('newlines.ets'), data: { users } })
		).toEqual(fixture('newlines.html'));
	});

	test('works with `-%>` interspersed', async () => {
		expect(
			await ets.render({
				template: fixture('newlines.mixed.ets'),
				data: { users },
			})
		).toEqual(fixture('newlines.mixed.html'));
	});

	test('consecutive tags work', async () => {
		expect(await ets.render(fixture('consecutive-tags.ets'))).toEqual(
			fixture('consecutive-tags.html')
		);
	});
});

describe('-%>', () => {
	test('not produce newlines', async () => {
		expect(
			await ets.render({
				template: fixture('no.newlines.ets'),
				data: { users },
			})
		).toEqual(fixture('no.newlines.html'));
	});
	test('stack traces work', async () => {
		expect.hasAssertions();
		try {
			await ets.render(fixture('no.newlines.error.ets'));
		} catch (error: unknown) {
			expect((error as { message: string }).message).includes(
				'>> 4| <%= qdata %>'
			);
		}
	});

	test('works with unix style', async () => {
		const content =
			'<ul><% -%>\n' +
			'<% users.forEach(function(user){ -%>\n' +
			'<li><%= user.name -%></li>\n' +
			'<% }) -%>\n' +
			'</ul><% -%>\n';

		const expectedResult =
			'<ul><li>geddy</li>\n<li>neil</li>\n<li>alex</li>\n</ul>';
		const fn = await ets.compile(content);
		expect(await fn({ users })).toEqual(expectedResult);
	});

	test('works with windows style', async () => {
		const content =
			'<ul><% -%>\r\n' +
			'<% users.forEach(function(user){ -%>\r\n' +
			'<li><%= user.name -%></li>\r\n' +
			'<% }) -%>\r\n' +
			'</ul><% -%>\r\n';

		const expectedResult =
			'<ul><li>geddy</li>\r\n<li>neil</li>\r\n<li>alex</li>\r\n</ul>';
		const fn = await ets.compile(content);
		expect(await fn({ users })).toEqual(expectedResult);
	});
});

describe('<%%', () => {
	test('produce literals', async () => {
		expect(await ets.render('<%%- "foo" %>')).toEqual('<%- "foo" %>');
	});

	test('work without an end tag', async () => {
		expect(await ets.render('<%%')).toEqual('<%');
		expect(
			await ets.render({
				template: fixture('literal.ets'),
				options: { delimiter: ' ' },
			}),
			fixture('literal.html')
		);
	});
});

describe('%%>', () => {
	test('produce literal', async () => {
		expect(await ets.render('%%>')).toEqual('%>');
		expect(
			await ets.render({ template: '  >', options: { delimiter: ' ' } })
		).toEqual(' >');
	});
});

describe('<%_ and _%>', () => {
	test('slurps spaces and tabs', async () => {
		expect(
			await ets.render({
				template: fixture('space-and-tab-slurp.ets'),
				data: { users },
			})
		).toEqual(fixture('space-and-tab-slurp.html'));
	});
});

describe('single quotes', () => {
	test('not mess up the constructed function', async () => {
		expect(await ets.render(fixture('single-quote.ets'))).toEqual(
			fixture('single-quote.html')
		);
	});
});

describe('double quotes', () => {
	test('not mess up the constructed function', async () => {
		expect(await ets.render(fixture('double-quote.ets'))).toEqual(
			fixture('double-quote.html')
		);
	});
});

describe('backslashes', () => {
	test('escape', async () => {
		expect(await ets.render(fixture('backslash.ets'))).toEqual(
			fixture('backslash.html')
		);
	});
});

describe('messed up whitespace', () => {
	test('work', async () => {
		expect(
			await ets.render({ template: fixture('messed.ets'), data: { users } })
		).toEqual(fixture('messed.html'));
	});
});

describe('exceptions', () => {
	test('produce useful stack traces', async () => {
		expect.hasAssertions();
		try {
			await ets.render({
				template: fixture('error.ets'),
				options: { filename: 'error.ets' },
			});
		} catch (error: unknown) {
			const err = error as { path: string; stack: string };
			expect(err.path).toEqual('error.ets');
			let errorStack = err.stack.split('\n').slice(0, 8).join('\n');
			errorStack = errorStack.replace(/\n/g, '\n');
			errorStack = errorStack.replace(/\r\r\n/g, '\n');
			expect(errorStack).toEqual(fixture('error.out'));
		}
	});

	test('not include fancy stack info if compileDebug is false', async () => {
		expect.hasAssertions();
		try {
			await ets.render({
				template: fixture('error.ets'),
				options: {
					filename: 'error.ets',
					compileDebug: false,
				},
			});
		} catch (error: unknown) {
			const err = error as { path: string; stack: string };
			expect(!err.path).toBe(true);
			let errorStack = err.stack.split('\n').slice(0, 8).join('\n');
			errorStack = errorStack.replace(/\n/g, '\n');
			errorStack = errorStack.replace(/\r\r\n/g, '\n');
			expect(errorStack).not.toEqual(fixture('error.out'));
		}
	});

	let unhook: (() => void) | undefined;
	test('log JS source when debug is set', async () => {
		let out = '';
		let needToExit = false;
		unhook = hookStdio(process.stdout, (str) => {
			out += str;
			if (needToExit) {
				return;
			}

			if (out.indexOf('__output')) {
				needToExit = true;
				unhook?.();
				unhook = undefined;
			}
		});

		await ets.render({
			template: fixture('hello-world.ets'),
			options: { debug: true },
		});
	});

	test('escape filename in errors', async () => {
		await expect(async () => {
			await ets.render({
				template: '<% throw new Error("whoops"); %>',
				options: { filename: '<script>' },
			});
		}).rejects.toThrow(/&lt;script&gt;/);
	});

	test('filename in errors uses custom escape', async () => {
		await expect(async () => {
			await ets.render({
				template: '<% throw new Error("whoops"); %>',
				options: {
					filename: '<script>',
					escape() {
						return 'zooby';
					},
				},
			});
		}).rejects.toThrow(/zooby/);
	});

	afterEach(() => {
		if (unhook === undefined) {
			return;
		}

		unhook();
		unhook = undefined;
	});
});

describe('rmWhitespace', () => {
	test('works', async () => {
		const outp = await ets.render({
			template: fixture('rmWhitespace.ets'),
			options: { rmWhitespace: true },
		});

		expect(outp).toEqual(fixture('rmWhitespace.html'));
	});
});

describe('include()', () => {
	test('include ets', async () => {
		const file = 'test/fixtures/include-simple.ets';
		expect(
			await ets.render({
				template: fixture('include-simple.ets'),
				options: { filename: file },
			})
		).toEqual(fixture('include-simple.html'));
	});

	test('include and escape ets', async () => {
		const file = 'test/fixtures/include-escaped.ets';
		expect(
			await ets.render({
				template: fixture('include-escaped.ets'),
				options: { filename: file },
			})
		).toEqual(fixture('include-escaped.html'));
	});

	test('include and escape within included ets', async () => {
		const escape = (s: string) => s.toUpperCase();

		const file = 'test/fixtures/include-nested-escape.ets';
		expect(
			await ets.render({
				template: fixture('include-nested-escape.ets'),
				options: { filename: file, escape },
			})
		).toEqual(fixture('include-nested-escape.html'));
	});

	test('include in expression ets', async () => {
		const file = 'test/fixtures/include-expression.ets';
		expect(
			await ets.render({
				template: fixture('include-expression.ets'),
				options: { filename: file },
			})
		).toEqual(fixture('include-expression.html'));
	});

	test('include ets fails without `filename`', async () => {
		expect.hasAssertions();
		try {
			await ets.render(fixture('include-simple.ets'));
		} catch (error: unknown) {
			expect((error as Error).message).to.include('Could not find');
		}
	});

	test('show filename when including nonexistent file', async () => {
		expect.hasAssertions();
		try {
			await ets.render(fixture('include-nonexistent.ets'));
		} catch (error: unknown) {
			expect((error as Error).message).to.include('nonexistent-file');
		}
	});

	test('strips BOM', async () => {
		expect(
			await ets.render({
				template: '<%- await include("includes/bom.ets") %>',
				options: { filename: path.join(fixturesPath, 'f.ets') },
			})
		).toEqual('<p>This is a file with BOM.</p>\n');
	});

	test('include ets with locals', async () => {
		const file = 'test/fixtures/include.ets';
		expect(
			await ets.render({
				template: fixture('include.ets'),
				data: { pets: users },
				options: { filename: file, delimiter: '@' },
			})
		).toEqual(fixture('include.html'));
	});

	test('include ets with absolute path and locals', async () => {
		const file = 'test/fixtures/include-abspath.ets';
		expect(
			await ets.render({
				template: fixture('include-abspath.ets'),
				data: { dir: fixturesPath, pets: users, path },
				options: { filename: file, delimiter: '@' },
			})
		).toEqual(fixture('include.html'));
	});

	test('include ets with set root path', async () => {
		const file = 'test/fixtures/include-root.ets';
		const viewsPath = fixturesPath;
		expect(
			await ets.render({
				template: fixture('include-root.ets'),
				data: { pets: users },
				options: { filename: file, delimiter: '@', root: viewsPath },
			})
		).toEqual(fixture('include.html'));
	});

	test('include ets with custom includer function', async () => {
		const file = 'test/fixtures/include-root.ets';
		const inc = function (original: string, prev: string) {
			if (original.startsWith('/')) {
				// original: '/include'         (windows)
				// prev:     'D:\include.ets'   (windows)
				return {
					filename: path.join(fixturesPath, original + '.ets'),
				};
			} else {
				return { filename: prev };
			}
		};

		expect(
			await ets.render({
				template: fixture('include-root.ets'),
				data: { pets: users },
				options: { filename: file, delimiter: '@', includer: inc },
			})
		).toEqual(fixture('include.html'));
	});

	test('include ets with includer returning template', async () => {
		const file = 'test/fixtures/include-root.ets';
		const inc = function (original: string, prev: string) {
			// original: '/include'         (windows)
			// prev:     'D:\include.ets'   (windows)
			if (original === '/include') {
				return {
					template: '<p>Hello template!</p>\n',
				};
			} else {
				return prev;
			}
		};

		expect(
			await ets.render({
				template: fixture('include-root.ets'),
				data: { pets: users },
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				options: { filename: file, delimiter: '@', includer: inc as any },
			})
		).toEqual(fixture('hello-template.html'));
	});

	test('work when nested', async () => {
		const file = 'test/fixtures/menu.ets';
		expect(
			await ets.render({
				template: fixture('menu.ets'),
				data: { pets: users },
				options: { filename: file },
			})
		).toEqual(fixture('menu.html'));
	});

	test('work with a variable path', async () => {
		const file = 'test/fixtures/menu_var.ets';
		const includePath = 'includes/menu-item';
		expect(
			await ets.render({
				template: fixture('menu.ets'),
				data: { pets: users, varPath: includePath },
				options: { filename: file },
			})
		).toEqual(fixture('menu.html'));
	});

	test('include arbitrary files as-is', async () => {
		const file = 'test/fixtures/include.css.ets';
		expect(
			await ets.render({
				template: fixture('include.css.ets'),
				data: { pets: users },
				options: { filename: file },
			})
		).toEqual(fixture('include.css.html'));
	});

	test('pass compileDebug to include', async () => {
		expect.hasAssertions();
		const file = 'include.ets';
		const fn = await ets.compile(fixture('include.ets'), {
			filename: file,
			delimiter: '@',
			compileDebug: false,
		});
		try {
			// Render without a required variable reference
			await fn({ foo: 'asdf' });
		} catch (error: unknown) {
			expect((error as Error).message).toEqual('pets is not defined');
			expect((error as { path: string }).path).toBeUndefined();
		}
	});

	test('is dynamic', async () => {
		fs.writeFileSync(path.join(tempFolder, 'include.ets'), '<p>Old</p>');
		const file = 'test/fixtures/include_cache.ets';
		const options = { filename: file };
		const out = await ets.compile(fixture('include_cache.ets'), options);
		expect(await out()).toEqual('<p>Old</p>\n');

		fs.writeFileSync(path.join(tempFolder, 'include.ets'), '<p>New</p>');
		expect(await out()).toEqual('<p>New</p>\n');
	});

	test('support caching', async () => {
		fs.writeFileSync(path.join(tempFolder, 'include.ets'), '<p>Old</p>');
		const file = 'test/fixtures/include_cache.ets';
		const options = { cache: true, filename: file };
		let out = await ets.render({
			template: fixture('include_cache.ets'),
			options,
		});
		const expected = fixture('include_cache.html');
		expect(out).toEqual(expected);
		out = await ets.render({ template: fixture('include_cache.ets'), options });
		// No change, still in cache
		expect(out).toEqual(expected);
		fs.writeFileSync(path.join(tempFolder, 'include.ets'), '<p>New</p>');
		out = await ets.render({ template: fixture('include_cache.ets'), options });
		expect(out).toEqual(expected);
	});

	test('handles errors in included file', async () => {
		expect.hasAssertions();
		try {
			await ets.render({
				template: '<%- await include("include-with-error") %>',
				options: { filename: path.join(fixturesPath, 'f.ets') },
			});
		} catch (error: unknown) {
			expect((error as Error).message).to.include('foobar is not defined');
		}
	});
});

describe('comments', () => {
	test('fully render with comments removed', async () => {
		expect(await ets.render(fixture('comments.ets'))).toEqual(
			fixture('comments.html')
		);
	});
});

describe('identifier validation', () => {
	test('invalid outputFunctionName', async () => {
		await expect(async () => {
			await ets.compile('<p>yay</p>', {
				outputFunctionName: 'x;console.log(1);x',
			});
		}).rejects.toThrow(/outputFunctionName is not a valid JS identifier/);
	});

	test('invalid localsName', async () => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const locals = {};
		await expect(async () => {
			await ets.compile('<p>yay</p>', {
				localsName: 'function(){console.log(1);return locals;}()',
			});
		}).rejects.toThrow(/localsName is not a valid JS identifier/);
	});
});

describe('typescript', () => {
	test('typescript.ets', async () => {
		await ets.render(fixture('typescript.ets'));
	});
});
