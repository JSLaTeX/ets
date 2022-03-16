import * as fs from 'node:fs';
import * as path from 'node:path';
import { outdent } from 'outdent';
import xmlEscape from 'xml-escape';
import escapeStringRegexp from 'escape-string-regexp';
import LRUCache from 'lru-cache';
import esbuild from 'esbuild';
import type {
	ClientFunction,
	EscapeCallback,
	ETSOptions,
	TemplateFunction,
} from '~/types.js';

const DEFAULT_OPEN_DELIMITER = '<';
const DEFAULT_CLOSE_DELIMITER = '>';
const DEFAULT_DELIMITER = '%';
const DEFAULT_LOCALS_NAME = 'locals';
const REGEX_STRING = '(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)';
const BOM = /^\uFEFF/;
const JS_IDENTIFIER_REGEX = /^[a-zA-Z_$][\w$]*$/;

/**
 * ETS template function cache. This can be a LRU object from lru-cache NPM
 * module. By default, it is {@link module:utils.cache}, a simple in-process
 * cache that grows continuously.
 */
const cache = new LRUCache<string, ClientFunction | TemplateFunction>();

/**
 * Get the path to the included file from the parent file path and the
 * specified path.
 */
export function resolveInclude(
	name: string,
	filename: string,
	isDir?: boolean
): string {
	let includePath = path.resolve(
		isDir ? filename : path.dirname(filename),
		name
	);
	const ext = path.extname(name);
	if (!ext) {
		includePath += '.ets';
	}

	return includePath;
}

/**
 * Try to resolve file path on multiple directories
 */
function resolvePaths(name: string, paths: string[]): string {
	for (let filePath of paths) {
		filePath = resolveInclude(name, filePath, true);
		if (fs.existsSync(filePath)) {
			return filePath;
		}
	}

	throw new Error('resolvePaths(): path not found');
}

/**
 * Get the path to the included file by Options
 *
 * @param  path    specified path
 * @param  options compilation options
 */
function getIncludePath(
	origPath: string,
	options: ETSOptions
): string | undefined {
	let includePath: string | undefined;
	let filePath: string;
	const { views } = options;
	const match = /^[A-Za-z]+:\\|^\//.exec(origPath);

	// Abs path
	if (match && match.length > 0) {
		origPath = origPath.replace(/^\/*/, '');
		if (Array.isArray(options.root)) {
			includePath = resolvePaths(origPath, options.root);
		} else {
			includePath = resolveInclude(origPath, options.root, true);
		}
	}
	// Relative paths
	else {
		// Look relative to a passed filename first
		if (options.filename) {
			filePath = resolveInclude(origPath, options.filename);
			if (fs.existsSync(filePath)) {
				includePath = filePath;
			}
		}

		// Then look in any views directories
		if (includePath === undefined && Array.isArray(views)) {
			includePath = resolvePaths(origPath, views);
		}

		if (includePath === undefined && typeof options.includer !== 'function') {
			throw new Error(
				`Could not find the include file "${options.escape(origPath)}"`
			);
		}
	}

	return includePath;
}

/**
Render an ETS file at the given `path`.
*/
type RenderFileProps =
	| {
			filePath: string;
			data: Record<string, unknown>;
			options?: Omit<Partial<ETSOptions>, 'filename'>;
	  }
	| string;

export async function renderFile(props: RenderFileProps): Promise<string> {
	if (typeof props === 'string') {
		const templateRenderFunction = await handleCache({
			filename: props,
		});
		return templateRenderFunction();
	} else {
		const { filePath, data, options } = props;
		const templateRenderFunction = await handleCache({
			...options,
			filename: filePath,
		});
		return templateRenderFunction(data);
	}
}

/**
 * Get the template from a string or a file, either compiled on-the-fly or
 * read from cache (if enabled), and cache the template if needed.
 *
 * If `template` is not set, the file specified in `options.filename` will be
 * read.
 *
 * If `options.cache` is true, this function reads the file from
 * `options.filename` so it must be set prior to calling this function.
 *
 * @param options   compilation options
 * @param template source
 */

async function handleCache(
	options: Partial<ETSOptions>,
	template?: string
): Promise<TemplateFunction | ClientFunction> {
	let templateRenderFunction: TemplateFunction | ClientFunction | undefined;
	const { filename } = options;
	const hasTemplate = template !== undefined;

	if (options.cache) {
		if (!filename) {
			throw new Error('cache option requires a filename');
		}

		templateRenderFunction = cache.get(filename);
		if (templateRenderFunction !== undefined) {
			return templateRenderFunction;
		}

		if (!hasTemplate) {
			template = await fs.promises.readFile(filename, 'utf-8');
			template = template.replace(BOM, '');
		}
	} else if (!hasTemplate) {
		if (!filename) {
			throw new Error('Internal ETS error: no file name or template provided');
		}

		template = await fs.promises.readFile(filename, 'utf8');
		template = template.replace(BOM, '');
	}

	templateRenderFunction = await compile(template!, options);
	if (options.cache) {
		cache.set(filename!, templateRenderFunction);
	}

	return templateRenderFunction;
}

/**
Get the template function.
If `options.cache` is `true`, then the template is cached.
@param filePath	path for the specified file
@param options compilation options
@return {(TemplateFunction|ClientFunction)}
Depending on the value of `options.client`, either type might be returned
@static
*/
async function includeFile(
	filePath: string,
	options: ETSOptions
): Promise<ClientFunction> {
	const opts = { ...options };
	opts.filename = getIncludePath(filePath, opts);
	if (typeof options.includer === 'function') {
		const includerResult = options.includer(filePath, opts.filename!);
		if (includerResult) {
			if (includerResult.filename) {
				opts.filename = includerResult.filename;
			}

			if (includerResult.template) {
				return handleCache(opts, includerResult.template);
			}
		}
	}

	const templateRenderFunction = await handleCache(opts);
	return templateRenderFunction;
}

type RethrowProps = {
	error: Error;
	source: string;
	filename: string;
	lineno: number;
	escape: EscapeCallback;
};

/**
Re-throw the given `err` in context to the `str` of ets, `filename`, and
`lineno`.
*/
function rethrow({
	error,
	source,
	filename,
	lineno,
	escape,
}: RethrowProps): never {
	const lines = source.split('\n');
	const start = Math.max(lineno - 3, 0);
	const end = Math.min(lines.length, lineno + 3);
	filename = escape(filename);

	// Error context
	const context = lines
		.slice(start, end)
		.map((line, i) => {
			const curr = i + start + 1;
			return (
				(curr === lineno ? ' >> ' : '    ') + curr.toString() + '| ' + line
			);
		})
		.join('\n');

	// Alter exception message
	(error as any).path = filename;
	error.message = outdent`
		${filename ?? 'ets'}:${lineno}
		${context}

		${error.message}
	`;

	throw error;
}

function stripSemi(str: string) {
	return str.replace(/;(\s*$)/, '$1');
}

/**
Compile the given `str` of ets into a template function.
@param template ETS template
@param compilation options
*/
export async function compile(
	template: string,
	options: Partial<ETSOptions> & { client: true }
): Promise<ClientFunction>;
export async function compile(
	template: string,
	options: Partial<ETSOptions> & { client: false }
): Promise<TemplateFunction>;
export async function compile(
	template: string,
	options?: Partial<ETSOptions>
): Promise<TemplateFunction | ClientFunction>;
export async function compile(
	template: string,
	options?: Partial<ETSOptions>
): Promise<TemplateFunction | ClientFunction> {
	return new Template(template, options).compile();
}

type RenderProps =
	| {
			template: string;
			data?: Record<string, unknown>;
			options?: Partial<ETSOptions>;
	  }
	| string;

/**
Render the given `template` of ets.

If you would like to include options but not data, you need to explicitly
call this function with `data` being an empty object or `null`.

@param template ETS template
@param template data
@param compilation and rendering options
@public
*/
export async function render(props: RenderProps): Promise<string> {
	if (typeof props === 'string') {
		const templateRenderFunction = await handleCache({}, props);
		return templateRenderFunction();
	} else {
		const templateRenderFunction = await handleCache(
			props.options ?? {},
			props.template
		);
		return templateRenderFunction(props.data);
	}
}

/**
 * Clear intermediate JavaScript cache. Calls {@link Cache#reset}.
 * @public
 */
export function clearCache() {
	cache.clear();
}

const modes = {
	EVAL: 'eval',
	ESCAPED: 'escaped',
	RAW: 'raw',
	COMMENT: 'comment',
	LITERAL: 'literal',
};

export class Template {
	mode: string | null = null;
	truncate = false;
	currentLine = 1;
	source = '';
	options: ETSOptions;
	templateText: string;
	regex: RegExp;

	constructor(text: string, opts: Partial<ETSOptions> = {}) {
		this.templateText = text;
		this.options = {
			beautify: opts.beautify ?? false,
			cache: opts.cache ?? false,
			client: opts.client ?? false,
			closeDelimiter: opts.closeDelimiter ?? DEFAULT_CLOSE_DELIMITER,
			compileDebug: opts.compileDebug ?? false,
			debug: opts.debug ?? false,
			delimiter: opts.delimiter ?? DEFAULT_DELIMITER,
			destructuredLocals: opts.destructuredLocals ?? [],
			escape: opts.escape ?? xmlEscape,
			filename: opts.filename,
			openDelimiter: opts.openDelimiter ?? DEFAULT_OPEN_DELIMITER,
			includer: opts.includer,
			rmWhitespace: opts.rmWhitespace ?? false,
			root: opts.root ?? '/',
			outputFunctionName: opts.outputFunctionName,
			localsName: opts.localsName ?? DEFAULT_LOCALS_NAME,
			views: opts.views,
		};

		this.regex = this.createRegex();
	}

	createRegex() {
		let str = REGEX_STRING;
		const delim = escapeStringRegexp(this.options.delimiter);
		const open = escapeStringRegexp(this.options.openDelimiter);
		const close = escapeStringRegexp(this.options.closeDelimiter);
		str = str.replace(/%/g, delim).replace(/</g, open).replace(/>/g, close);
		return new RegExp(str);
	}

	// eslint-disable-next-line complexity
	async compile(): Promise<ClientFunction | TemplateFunction> {
		let src: string;
		let fn: ClientFunction;
		const { options } = this;
		let prepended = '';
		let appended = '';
		const escapeFn = options.escape;
		let Ctor: FunctionConstructor;
		const sanitizedFilename = options.filename
			? JSON.stringify(options.filename)
			: 'undefined';

		if (!this.source) {
			this.generateSource();
			prepended += outdent`
				var __output = "";
				function __append(s) { if (s !== undefined && s !== null) __output += s }
			`;

			if (options.outputFunctionName) {
				if (!JS_IDENTIFIER_REGEX.test(options.outputFunctionName)) {
					throw new Error('outputFunctionName is not a valid JS identifier.');
				}

				prepended += `  var ${options.outputFunctionName} = __append;\n`;
			}

			if (!JS_IDENTIFIER_REGEX.test(options.localsName)) {
				throw new Error('localsName is not a valid JS identifier.');
			}

			if (options.destructuredLocals.length > 0) {
				let destructuring =
					'  var __locals = (' + options.localsName + ' || {}),\n';
				for (let i = 0; i < options.destructuredLocals.length; i++) {
					const name = options.destructuredLocals[i]!;
					if (!JS_IDENTIFIER_REGEX.test(name)) {
						throw new Error(
							`destructuredLocals[${i}] is not a valid JS identifier.`
						);
					}

					if (i > 0) {
						destructuring += ',\n  ';
					}

					destructuring += name + ' = __locals.' + name;
				}

				prepended += destructuring + ';\n';
			}

			appended += '  return __output;\n';
			this.source = prepended + this.source + appended;
		}

		if (options.compileDebug) {
			src = outdent`
				var __line = 1;
				var __lines = ${JSON.stringify(this.templateText)};
				var __filename = ${sanitizedFilename};
				try {
					${this.source}
				} catch (error) {
					rethrow({ error, source: __lines, filename: __filename, lineno: __line, escape: escapeFn });
				}
			`;
		} else {
			src = this.source;
		}

		if (options.client) {
			src = `escapeFn = escapeFn ?? ${escapeFn.toString()};\n` + src;
			if (options.compileDebug) {
				src = `rethrow = rethrow ?? ${rethrow.toString()};\n` + src;
			}
		}

		src = '"use strict";\n' + src;

		if (options.debug) {
			console.log(src);
		}

		if (options.compileDebug && options.filename) {
			src += `\n//# sourceURL=${sanitizedFilename}\n`;
		}

		const { code } = await esbuild.transform(src, {
			minify: false,
			keepNames: true,
			loader: 'ts',
		});
		src = code;

		try {
			Ctor = async function () {
				/* noop */
			}.constructor as FunctionConstructor;

			fn = new Ctor(
				options.localsName + ', escapeFn, include, rethrow',
				src
			) as ClientFunction;
		} catch (error: unknown) {
			if (error instanceof SyntaxError) {
				if (options.filename) {
					error.message += ` in ${options.filename}`;
				}

				error.message += outdent`
					while compiling ets

					If the above error is not helpful, you may want to try EJS-Lint:
					https://github.com/RyanZim/EJS-Lint
				`;
			}

			throw error;
		}

		// Return a callable function which will execute the function
		// created by the source-code, with the passed data as locals
		// Adds a local `include` function which allows full recursive include
		const returnedFn = options.client
			? fn
			: async function (data?: Record<string, unknown>) {
					async function include(
						filePath: string,
						includeData?: Record<string, unknown>
					) {
						let d = { ...data };
						if (includeData) {
							d = { ...d, ...includeData };
						}

						const fileTemplateRenderFunction = await includeFile(
							filePath,
							options
						);

						return fileTemplateRenderFunction(d);
					}

					return fn(data ?? {}, escapeFn, include, rethrow);
			  };

		if (options.filename) {
			const { filename } = options;
			const basename = path.basename(filename, path.extname(filename));
			try {
				Object.defineProperty(returnedFn, 'name', {
					value: basename,
					writable: false,
					enumerable: false,
					configurable: true,
				});
			} catch {
				/* ignore */
			}
		}

		return returnedFn;
	}

	generateSource() {
		const { options } = this;

		if (options.rmWhitespace) {
			// Have to use two separate replace here as `^` and `$` operators don't
			// work well with `\r` and empty lines don't work well with the `m` flag.
			this.templateText = this.templateText
				.replace(/[\r\n]+/g, '\n')
				.replace(/^\s+|\s+$/gm, '');
		}

		// Slurp spaces and tabs before <%_ and after _%>
		this.templateText = this.templateText
			.replace(/[ \t]*<%_/gm, '<%_')
			.replace(/_%>[ \t]*/gm, '_%>');

		const matches = this.parseTemplateText();
		const { delimiter: d, openDelimiter: o, closeDelimiter: c } = options;

		if (matches && matches.length > 0) {
			for (const [index, line] of matches.entries()) {
				// If this is an opening tag, check for closing tags
				// FIXME: May end up with some false positives here
				// Better to store modes as k/v with openDelimiter + delimiter as key
				// Then this can simply check against the map
				if (
					line.startsWith(o + d) && // If it is a tag
					!line.startsWith(o + d + d)
				) {
					// and is not escaped
					const closing = matches[index + 2];
					if (
						!(
							closing === d + c ||
							closing === '-' + d + c ||
							closing === '_' + d + c
						)
					) {
						throw new Error(`Could not find matching close tag for "${line}".`);
					}
				}

				this.scanLine(line);
			}
		}
	}

	parseTemplateText() {
		let str = this.templateText;
		const pat = this.regex;
		let result = pat.exec(str);
		const arr: string[] = [];
		let firstPos;

		while (result) {
			firstPos = result.index;

			if (firstPos !== 0) {
				arr.push(str.slice(0, Math.max(0, firstPos)));
				str = str.slice(firstPos);
			}

			arr.push(result[0]!);
			str = str.slice(result[0]!.length);
			result = pat.exec(str);
		}

		if (str) {
			arr.push(str);
		}

		return arr;
	}

	#addOutput(line: string) {
		if (this.truncate) {
			// Only replace single leading linebreak in the line after
			// -%> tag -- this is the single, trailing linebreak
			// after the tag that the truncation mode replaces
			// Handle Win / Unix / old Mac linebreaks -- do the \r\n
			// combo first in the regex-or
			line = line.replace(/^(?:\r\n|\r|\n)/, '');
			this.truncate = false;
		}

		if (!line) {
			return line;
		}

		// Preserve literal slashes
		line = line.replace(/\\/g, '\\\\');

		// Convert linebreaks
		line = line.replace(/\n/g, '\\n');
		line = line.replace(/\r/g, '\\r');

		// Escape double-quotes
		// - this will be the delimiter during execution
		line = line.replace(/"/g, '\\"');
		this.source += `    ; __append("${line}")\n`;
	}

	// eslint-disable-next-line complexity
	scanLine(line: string) {
		const { delimiter: d, openDelimiter: o, closeDelimiter: c } = this.options;
		const newLineCount = line.split('\n').length - 1;

		switch (line) {
			case o + d:
			case o + d + '_':
				this.mode = modes.EVAL;
				break;
			case o + d + '=':
				this.mode = modes.ESCAPED;
				break;
			case o + d + '-':
				this.mode = modes.RAW;
				break;
			case o + d + '#':
				this.mode = modes.COMMENT;
				break;
			case o + d + d:
				this.mode = modes.LITERAL;
				this.source +=
					// prettier-ignore
					`    ; __append("${line.replace(o + d + d, o + d)}")\n`;
				break;
			case d + d + c:
				this.mode = modes.LITERAL;
				this.source +=
					// prettier-ignore
					`    ; __append("${line.replace(d + d + c, d + c)}")\n`;
				break;
			case d + c:
			case '-' + d + c:
			case '_' + d + c:
				if (this.mode === modes.LITERAL) {
					this.#addOutput(line);
				}

				this.mode = null;
				this.truncate = line.startsWith('-') || line.startsWith('_');
				break;
			default:
				// In script mode, depends on type of tag
				if (this.mode) {
					// If '//' is found without a line break, add a line break.
					// eslint-disable-next-line default-case
					switch (this.mode) {
						case modes.EVAL:
						case modes.ESCAPED:
						case modes.RAW:
							if (line.lastIndexOf('//') > line.lastIndexOf('\n')) {
								line += '\n';
							}
					}

					// eslint-disable-next-line default-case
					switch (this.mode) {
						// Just executing code
						case modes.EVAL:
							this.source += `    ; ${line}\n`;
							break;
						// Exec, esc, and output
						case modes.ESCAPED:
							this.source += `    ; __append(escapeFn(${stripSemi(line)}))\n`;
							break;
						// Exec and output
						case modes.RAW:
							this.source += `    ; __append(${stripSemi(line)})\n`;
							break;
						case modes.COMMENT:
							// Do nothing
							break;
						// Literal <%% mode, append as raw output
						case modes.LITERAL:
							this.#addOutput(line);
							break;
					}
				}
				// In string mode, just add the output
				else {
					this.#addOutput(line);
				}
		}

		if (this.options.compileDebug && newLineCount) {
			this.currentLine += newLineCount;
			this.source += `    ; __line = ${this.currentLine}\n`;
		}
	}
}
