// Type definitions for ejs 3.1
// Project: http://ejs.co/, https://github.com/mde/ejs
// Definitions by: Ben Liddicott <https://github.com/benliddicott>
//                 ExE Boss <https://github.com/ExE-Boss>
//                 Piotr Błażejewicz <https://github.com/peterblazejewicz>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.4

/**
 * Get the path to the included file from the parent file path and the
 * specified path.
 *
 * @param name specified path
 * @param filename parent file path
 * @param isDir whether the parent file path is a directory
 */
export function resolveInclude(
	name: string,
	filename: string,
	isDir?: boolean
): string;

/**
 * Compile the given `str` of ejs into a template function.
 */
export function compile(
	template: string,
	opts: ETSOptions & { async: true; client?: false | undefined }
): AsyncTemplateFunction;
export function compile(
	template: string,
	opts: ETSOptions & { async: true; client: true }
): AsyncClientFunction;
export function compile(
	template: string,
	opts?: ETSOptions & { async?: false | undefined; client?: false | undefined }
): TemplateFunction;
export function compile(
	template: string,
	opts?: ETSOptions & { async?: false | undefined; client: true }
): ClientFunction;
export function compile(
	template: string,
	opts?: ETSOptions
): TemplateFunction | AsyncTemplateFunction;

/**
 * Render the given `template` of ejs.
 *
 * If you would like to include options but not data, you need to explicitly
 * call this function with `data` being an empty object or `null`.
 */
export function render(
	template: string,
	data?: Data,
	opts?: ETSOptions & { async: false }
): string;
export function render(
	template: string,
	data: Data | undefined,
	opts: ETSOptions & { async: true }
): Promise<string>;
export function render(
	template: string,
	data: Data | undefined,
	opts: ETSOptions & { async?: never | undefined }
): string;
export function render(
	template: string,
	data?: Data,
	opts?: ETSOptions
): string | Promise<string>;

/**
 * Callback for receiving data from `renderFile`.
 *
 * @param err error, if any resulted from the rendering process
 * @param str output string, is `undefined` if there is an error
 */
export type RenderFileCallback<T> = (err: Error | null, str: string) => T;

/**
 * Render an EJS file at the given `path` and callback `cb(err, str)`.
 *
 * If you would like to include options but not data, you need to explicitly
 * call this function with `data` being an empty object or `null`.
 */
export function renderFile<T>(path: string, cb: RenderFileCallback<T>): T;
export function renderFile<T>(
	path: string,
	data: Data,
	cb: RenderFileCallback<T>
): T;
export function renderFile<T>(
	path: string,
	data: Data,
	opts: ETSOptions,
	cb: RenderFileCallback<T>
): T;
export function renderFile(
	path: string,
	data?: Data,
	opts?: ETSOptions
): Promise<string>;

/**
 * Clear intermediate JavaScript cache. Calls {@link Cache#reset}.
 */
export function clearCache(): void;

/**
 * EJS template function cache. This can be a LRU object from lru-cache
 * NPM module. By default, it is `utils.cache`, a simple in-process
 * cache that grows continuously.
 */
export let cache: Cache;

/**
 * Custom file loader. Useful for template preprocessing or restricting access
 * to a certain part of the filesystem.
 *
 * @param path the path of the file to be read
 * @return the contents of the file as a string or object that implements the toString() method
 *
 * @default fs.readFileSync
 */
export type fileLoader = (path: string) => string | { toString(): string };
export let fileLoader: fileLoader;

/**
 * Name of the object containing the locals.
 *
 * This variable is overridden by {@link ETSOptions}`.localsName` if it is not
 * `undefined`.
 *
 * @default 'locals'
 */
export let localsName: string;

/**
 * The opening delimiter for all statements. This allows you to clearly delinate
 * the difference between template code and existing delimiters. (It is recommended
 * to synchronize this with the closeDelimiter property.)
 *
 * @default '<'
 */
export let openDelimiter: string;

/**
 * The closing delimiter for all statements. This allows to to clearly delinate
 * the difference between template code and existing delimiters. (It is recommended
 * to synchronize this with the openDelimiter property.)
 *
 * @default '>'
 */
export let closeDelimiter: string;

/**
 * The delimiter used in template compilation.
 *
 * @default '%'
 */
export let delimiter: string | undefined;

export interface Data {
	[name: string]: any;
}

/**
 * This type of function is returned from `compile`, when
 * `Options.client` is false.
 *
 * @param data an object of data to be passed into the template.
 * @return Return type depends on `Options.async`.
 */
export type TemplateFunction = (data?: Data) => string;

/**
 * This type of function is returned from `compile`, when
 * `Options.client` is false.
 *
 * @param data an object of data to be passed into the template.
 * @return Return type depends on `Options.async`.
 */
export type AsyncTemplateFunction = (data?: Data) => Promise<string>;

/**
 * This type of function is returned from `compile`, when
 * `Options.client` is true.
 *
 *
 * This is also used internally to generate a `TemplateFunction`.
 *
 * @param locals an object of data to be passed into the template.
 * The name of this variable is adjustable through `localsName`.
 *
 * @param escape callback used to escape variables
 * @param include callback used to include files at runtime with `include()`
 * @param rethrow callback used to handle and rethrow errors
 *
 * @return Return type depends on `Options.async`.
 */
export type ClientFunction = (
	locals?: Data,
	escape?: EscapeCallback,
	include?: IncludeCallback,
	rethrow?: RethrowCallback
) => string;

/**
 * This type of function is returned from `compile`, when
 * `Options.client` is true.
 *
 *
 * This is also used internally to generate a `TemplateFunction`.
 *
 * @param locals an object of data to be passed into the template.
 * The name of this variable is adjustable through `localsName`.
 *
 * @param escape callback used to escape variables
 * @param include callback used to include files at runtime with `include()`
 * @param rethrow callback used to handle and rethrow errors
 *
 * @return Return type depends on `Options.async`.
 */
export type AsyncClientFunction = (
	locals?: Data,
	escape?: EscapeCallback,
	include?: IncludeCallback,
	rethrow?: RethrowCallback
) => Promise<string>;

/**
 * Escapes a string using HTML/XML escaping rules.
 *
 * Returns the empty string for `null` or `undefined`.
 *
 * @param markup Input string
 * @return Escaped string
 */
export type EscapeCallback = (markup?: any) => string;

/**
 * This type of callback is used when `Options.compileDebug`
 * is `true`, and an error in the template is thrown.
 *
 * By default it is used to rethrow an error in a better-formatted way.
 *
 * @param err Error object
 * @param str full EJS source
 * @param filename file name of the EJS source
 * @param lineno line number of the error
 */
export type RethrowCallback = (
	err: Error,
	str: string,
	filename: string | null | undefined,
	lineno: number,
	esc: EscapeCallback
) => never;

/**
 * The callback called by `ClientFunction` to include files at runtime with `include()`
 *
 * @param path Path to be included
 * @param data Data passed to the template
 * @return Contents of the file requested
 */
export type IncludeCallback = (path: string, data?: Data) => string;

/**
 * An object where {@link filename} is the final parsed path or {@link template} is the content of the included template
 */
export type IncluderResult =
	| { filename: string; template?: never }
	| { template: string; filename?: never };

/**
 * @param originalPath the path as it appears in the include statement
 * @param parsedPath the previously resolved path
 *
 * @return An {@link IncluderResult} object containing the filename or template data.
 */
export type IncluderCallback = (
	originalPath: string,
	parsedPath: string
) => IncluderResult;

export interface ETSOptions {
	/**
	 * Log the generated JavaScript source for the EJS template to the console.
	 *
	 * @default false
	 */
	debug: boolean;

	/**
	 * Include additional runtime debugging information in generated template
	 * functions.
	 *
	 * @default true
	 */
	compileDebug: boolean;

	/**
	 * An array of local variables that are always destructured from `localsName`,
	 * available even in strict mode.
	 *
	 * @default []
	 */
	destructuredLocals: string[];

	/**
	 * Remove all safe-to-remove whitespace, including leading and trailing
	 * whitespace. It also enables a safer version of `-%>` line slurping for all
	 * scriptlet tags (it does not strip new lines of tags in the middle of a
	 * line).
	 *
	 * @default false
	 */
	rmWhitespace: boolean;

	/**
	 * Whether or not to compile a `ClientFunction` that can be rendered
	 * in the browser without depending on ejs.js. Otherwise, a `TemplateFunction`
	 * will be compiled.
	 *
	 * @default false
	 */
	client: boolean;

	/**
	 * The escaping function used with `<%=` construct. It is used in rendering
	 * and is `.toString()`ed in the generation of client functions.
	 *
	 * @default ejs.escapeXML
	 */
	escape: EscapeCallback;

	/**
	 * The filename of the template. Required for inclusion and caching unless
	 * you are using `renderFile`. Also used for error reporting.
	 */
	filename: string | undefined;

	/**
	 * The path to the project root. When this is set, absolute paths for includes
	 * (/filename.ejs) will be relative to the project root.
	 *
	 * @default undefined
	 */
	root: string;

	/**
	 * The opening delimiter for all statements. This allows you to clearly delinate
	 * the difference between template code and existing delimiters. (It is recommended
	 * to synchronize this with the closeDelimiter property.)
	 *
	 * @default ejs.openDelimiter
	 */
	openDelimiter: string;

	/**
	 * The closing delimiter for all statements. This allows to to clearly delinate
	 * the difference between template code and existing delimiters. (It is recommended
	 * to synchronize this with the openDelimiter property.)
	 *
	 * @default ejs.closeDelimiter
	 */
	closeDelimiter: string;

	/**
	 * Character to use with angle brackets for open/close
	 * @default '%'
	 */
	delimiter: string;

	/**
	 * Whether or not to enable caching of template functions. Beware that
	 * the options of compilation are not checked as being the same, so
	 * special handling is required if, for example, you want to cache client
	 * and regular functions of the same file.
	 *
	 * Requires `filename` to be set. Only works with rendering function.
	 *
	 * @default false
	 */
	cache: boolean;

	/**
	 * Whether or not to create an async function instead of a regular function.
	 * This requires language support.
	 *
	 * @default false
	 */
	async: boolean;

	/**
	 * Make sure to set this to 'false' in order to skip UglifyJS parsing,
	 * when using ES6 features (`const`, etc) as UglifyJS doesn't understand them.
	 * @default true
	 */
	beautify: boolean;

	/**
	 * Name to use for the object storing local variables when not using `with` or destructuring.
	 *
	 * @default ejs.localsName
	 */
	localsName: string;

	/** Set to a string (e.g., 'echo' or 'print') for a function to print output inside scriptlet tags. */
	outputFunctionName: string | undefined;

	/**
	 * An array of paths to use when resolving includes with relative paths
	 */
	views: string[] | undefined;

	/**
	 * Custom function to handle EJS includes
	 */
	includer: IncluderCallback | undefined;
}
