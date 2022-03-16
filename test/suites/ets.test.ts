/* eslint-disable no-eval */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, test, expect } from 'vitest';
import { join } from 'desm';
import * as ets from '~/index.js';
import type { ClientFunction } from '~/types.js';

function fixture(name: string) {
	return fs.readFileSync('test/fixtures/' + name, 'utf8');
}

const users = [{ name: 'geddy' }, { name: 'neil' }, { name: 'alex' }];

const fixturesPath = join(import.meta.url, '../fixtures');

describe('ets.compile(string, options)', () => {
	test('compile to a function', async () => {
		const fn = await ets.compile('<p>yay</p>');
		expect(fn()).toEqual('<p>yay</p>');
	});

	test('empty input works', async () => {
		const fn = await ets.compile('');
		expect(fn()).toEqual('');
	});

	test('throw if there are syntax errors', async () => {
		await expect(async () => {
			await ets.compile(fixture('fail.ets'));
		}).rejects.toBe(true);
	});

	test('allow customizing delimiter local var', async () => {
		let fn;
		fn = await ets.compile('<p><?= name ?></p>', { delimiter: '?' });

		expect(fn({ name: 'geddy' })).toEqual('<p>geddy</p>');

		fn = await ets.compile('<p><:= name :></p>', { delimiter: ':' });
		expect(fn({ name: 'geddy' })).toEqual('<p>geddy</p>');

		fn = await ets.compile('<p><$= name $></p>', { delimiter: '$' });
		expect(fn({ name: 'geddy' })).toEqual('<p>geddy</p>');
	});

	test('allow customizing open and close delimiters', async () => {
		const fn = await ets.compile('<p>[#= name #]</p>', {
			delimiter: '#',
			openDelimiter: '[',
			closeDelimiter: ']',
		});
		expect(fn({ name: 'geddy' })).toEqual('<p>geddy</p>');
	});

	test('support custom escape function', async () => {
		const customEscape = (str: string) => str?.toUpperCase() ?? '';

		const fn = await ets.compile('HELLO <%= name %>', { escape: customEscape });
		expect(fn({ name: 'world' })).toEqual('HELLO WORLD');
	});

	test('destructuring works in strict and async mode', async () => {
		const locals = { foo: 'bar' };
		const value = await ets.render({
			template: fixture('strict-destructuring.ets'),
			data: locals,
			options: {
				destructuredLocals: Object.keys(locals),
			},
		});

		expect(value).toEqual(locals.foo);
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

describe('client mode', () => {
	test('have a working client option', async () => {
		const fn = await ets.compile('<p><%= foo %></p>', { client: true });
		const str = fn.toString();
		let preFn: ClientFunction | undefined;
		eval('preFn = ' + str);
		expect(preFn?.({ foo: 'bar' })).toEqual('<p>bar</p>');
	});

	test('support client mode without locals', async () => {
		const fn = await ets.compile('<p><%= "foo" %></p>', { client: true });
		const str = fn.toString();
		let preFn: ClientFunction | undefined;
		eval('preFn = ' + str);
		expect(preFn?.()).toEqual('<p>foo</p>');
	});

	test('not include rethrow() in client mode if compileDebug is false', async () => {
		const fn = await ets.compile('<p><%= "foo" %></p>', {
			client: true,
			compileDebug: false,
		});
		// There could be a `rethrow` in the function declaration
		expect(fn.toString().match(/rethrow/g) ?? []).length.to.be.lessThanOrEqual(
			1
		);
	});

	test('support custom escape function in client mode', async () => {
		const customEscape = (str: string) => str?.toUpperCase() ?? '';

		const fn = await ets.compile('HELLO <%= name %>', {
			escape: customEscape,
			client: true,
		});
		const str = fn.toString();
		let preFn: ClientFunction | undefined;
		eval('var preFn = ' + str);
		expect(preFn?.({ name: 'world' })).toEqual('HELLO WORLD');
	});

	test('escape filename in errors in client mode', async () => {
		await expect(async () => {
			const fn = await ets.compile('<% throw new Error("whoops"); %>', {
				client: true,
				filename: '<script>',
			});
			await fn();
		}).rejects.toThrow(/Error: &lt;script&gt;/);
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
		expect(html).toEqual('<h1>fonebone</h1>');
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
		).toEqual('The Jones&#39;s');
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
		try {
			await ets.render(fixture('no.newlines.error.ets'));
		} catch (error: unknown) {
			expect((error as { message: string }).message).includes(
				'>> 4| <%= qdata %>'
			);

			throw error;
		}

		throw new Error('Expected ReferenceError');
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
		expect(fn({ users })).toEqual(expectedResult);
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
		expect(fn({ users })).toEqual(expectedResult);
	});
});

describe('<%%', () => {
	test('produce literals', async () => {
		expect(await ets.render('<%%- "foo" %>')).toEqual('<%- "foo" %>');
	});

	test('work without an end tag', async () => {
		expect(ets.render('<%%')).toEqual('<%');
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
			return;
		}

		throw new Error('no error reported when there should be');
	});

	test('not include fancy stack info if compileDebug is false', async () => {
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
			expect(errorStack).toEqual(fixture('error.out'));
			return;
		}

		throw new Error('no error reported when there should be');
	});

	let unhook = null;
	test('log JS source when debug is set', async () => {
		let out = '';
		let needToExit = false;
		unhook = hook_stdio(process.stdout, (str) => {
			out += str;
			if (needToExit) {
				return;
			}

			if (out.indexOf('__output')) {
				needToExit = true;
				unhook();
				unhook = null;
				done();
			}
		});
		ets.render(fixture('hello-world.ets'), {}, { debug: true });
	});

	test('escape filename in errors', async () => {
		await expect(async () => {
			await ets.render({
				template: '<% throw new Error("whoops"); %>',
				options: { filename: '<script>' },
			});
		}).rejects.toThrow(/Error: &lt;script&gt;/);
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
		}).rejects.toThrow(/Error: zooby/);
	});

	teardown(() => {
		if (!unhook) {
			return;
		}

		unhook();
		unhook = null;
	});
});

suite('rmWhitespace', () => {
	test('works', () => {
		const outp = ets.render(
			fixture('rmWhitespace.ets'),
			{},
			{ rmWhitespace: true }
		);
		assert.equal(outp.replace(/\n/g, lf), fixture('rmWhitespace.html'));
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
				filePath: fixture('include-nested-escape.ets'),
				options: { filename: file, escape },
			})
		).toEqual(fixture('include-nested-escape.html'));
	});

	test('include in expression ets', async () => {
		const file = 'test/fixtures/include-expression.ets';
		assert.equal(
			ets.render(fixture('include-expression.ets'), {}, { filename: file }),
			fixture('include-expression.html')
		);
	});

	test('include ets fails without `filename`', async () => {
		try {
			ets.render(fixture('include-simple.ets'));
		} catch (error) {
			assert.ok(error.message.includes('Could not find'));
			return;
		}

		throw new Error('expected inclusion error');
	});

	test('show filename when including nonexistent file', async () => {
		try {
			ets.render(fixture('include-nonexistent.ets'));
		} catch (error) {
			assert.ok(error.message.includes('nonexistent-file'));
			return;
		}

		throw new Error('expected inclusion error containing file name');
	});

	test('strips BOM', async () => {
		assert.equal(
			ets.render(
				'<%- include("fixtures/includes/bom.ets") %>',
				{},
				{ filename: path.join(__dirname, 'f.ets') }
			),
			'<p>This is a file with BOM.</p>' + lf
		);
	});

	test('include ets with locals', async () => {
		const file = 'test/fixtures/include.ets';
		assert.equal(
			ets.render(
				fixture('include.ets'),
				{ pets: users },
				{ filename: file, delimiter: '@' }
			),
			fixture('include.html')
		);
	});

	test('include ets with absolute path and locals', async () => {
		const file = 'test/fixtures/include-abspath.ets';
		assert.equal(
			ets.render(
				fixture('include-abspath.ets'),
				{ dir: path.join(__dirname, 'fixtures'), pets: users, path },
				{ filename: file, delimiter: '@' }
			),
			fixture('include.html')
		);
	});

	test('include ets with set root path', async () => {
		const file = 'test/fixtures/include-root.ets';
		const viewsPath = path.join(__dirname, 'fixtures');
		assert.equal(
			ets.render(
				fixture('include-root.ets'),
				{ pets: users },
				{ filename: file, delimiter: '@', root: viewsPath }
			),
			fixture('include.html')
		);
	});

	test('include ets with custom includer function', async () => {
		const file = 'test/fixtures/include-root.ets';
		const inc = function (original, prev) {
			if (original.charAt(0) === '/') {
				// original: '/include'         (windows)
				// prev:     'D:\include.ets'   (windows)
				return {
					filename: path.join(__dirname, 'fixtures', original + '.ets'),
				};
			} else {
				return prev;
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

	test('include ets with includer returning template', () => {
		const file = 'test/fixtures/include-root.ets';
		const inc = function (original, prev) {
			// original: '/include'         (windows)
			// prev:     'D:\include.ets'   (windows)
			if (original === '/include') {
				return {
					template: '<p>Hello template!</p>' + lf,
				};
			} else {
				return prev;
			}
		};

		expect(
			ets.render({
				template: fixture('include-root.ets'),
				data: { pets: users },
				options: { filename: file, delimiter: '@', includer: inc },
			})
		).toEqual(fixture('hello-template.html'));
	});

	test('work when nested', () => {
		const file = 'test/fixtures/menu.ets';
		assert.equal(
			ets.render(fixture('menu.ets'), { pets: users }, { filename: file }),
			fixture('menu.html')
		);
	});

	test('work with a variable path', () => {
		const file = 'test/fixtures/menu_var.ets';
		const includePath = 'includes/menu-item';
		assert.equal(
			ets.render(
				fixture('menu.ets'),
				{ pets: users, varPath: includePath },
				{ filename: file }
			),
			fixture('menu.html')
		);
	});

	test('include arbitrary files as-is', () => {
		const file = 'test/fixtures/include.css.ets';
		assert.equal(
			ets.render(
				fixture('include.css.ets'),
				{ pets: users },
				{ filename: file }
			),
			fixture('include.css.html')
		);
	});

	test('pass compileDebug to include', () => {
		const file = 'test/fixtures/include.ets';
		let fn;
		fn = ets.compile(fixture('include.ets'), {
			filename: file,
			delimiter: '@',
			compileDebug: false,
		});
		try {
			// Render without a required variable reference
			fn({ foo: 'asdf' });
		} catch (error) {
			assert.equal(error.message, 'pets is not defined');
			assert.ok(!error.path);
			return;
		}

		throw new Error('no error reported when there should be');
	});

	test('is dynamic', () => {
		fs.writeFileSync(__dirname + '/tmp/include.ets', '<p>Old</p>');
		const file = 'test/fixtures/include_cache.ets';
		const options = { filename: file };
		const out = ets.compile(fixture('include_cache.ets'), options);
		assert.equal(out(), '<p>Old</p>' + lf);

		fs.writeFileSync(__dirname + '/tmp/include.ets', '<p>New</p>');
		assert.equal(out(), '<p>New</p>' + lf);
	});

	test('support caching', () => {
		fs.writeFileSync(__dirname + '/tmp/include.ets', '<p>Old</p>');
		const file = 'test/fixtures/include_cache.ets';
		const options = { cache: true, filename: file };
		let out = ets.render(fixture('include_cache.ets'), {}, options);
		const expected = fixture('include_cache.html');
		assert.equal(out, expected);
		out = ets.render(fixture('include_cache.ets'), {}, options);
		// No change, still in cache
		assert.equal(out, expected);
		fs.writeFileSync(__dirname + '/tmp/include.ets', '<p>New</p>');
		out = ets.render(fixture('include_cache.ets'), {}, options);
		assert.equal(out, expected);
	});

	test('handles errors in included file', () => {
		try {
			ets.render(
				'<%- include("fixtures/include-with-error") %>',
				{},
				{ filename: path.join(__dirname, 'f.ets') }
			);
		} catch (error) {
			assert.ok(error.message.includes('foobar is not defined'));
			return;
		}

		throw new Error('expected inclusion error');
	});
});

describe('comments', () => {
	test('fully render with comments removed', () => {
		expect(ets.render(fixture('comments.ets'))).toEqual(
			fixture('comments.html')
		);
	});
});

describe('identifier validation', () => {
	test('invalid outputFunctionName', async () => {
		expect(async () => {
			await ets.compile('<p>yay</p>', {
				outputFunctionName: 'x;console.log(1);x',
			});
		}).rejects.toThrow(/outputFunctionName is not a valid JS identifier/);
	});

	test('invalid localsName', async () => {
		const locals = {};
		expect(async () => {
			await ets.compile('<p>yay</p>', {
				localsName: 'function(){console.log(1);return locals;}()',
			});
		}).rejects.toThrow(/localsName is not a valid JS identifier/);
	});

	test('invalid destructuredLocals', () => {
		const locals = {};
		expect(() => {
			await ets.compile('<p>yay</p>', {
				destructuredLocals: ['console.log(1); //'],
			});
		}).rejects.toThrow(/destructuredLocals\[0] is not a valid JS identifier/);
	});
});
