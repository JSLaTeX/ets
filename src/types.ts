export type RenderFileCallback<T> = (err: Error | null, str: string) => T;

export type Data = Record<string, any>;

/**
 * This type of function is returned from `compile`.
 *
 * @param data an object of data to be passed into the template.
 */
export type TemplateFunction = (data?: Data) => Promise<string>;

/**
 * Used internally to generate a `TemplateFunction`.
 *
 * @param locals an object of data to be passed into the template.
 * The name of this variable is adjustable through `localsName`.
 *
 * @param escape callback used to escape variables
 * @param include callback used to include files at runtime with `include()`
 * @param rethrow callback used to handle and rethrow errors
 */
export type ClientFunction = (
	locals?: Data,
	escape?: EscapeCallback,
	include?: AsyncIncludeCallback,
	rethrow?: RethrowCallback,
	importResolver?: ImportResolver
) => Promise<string>;

type ImportResolver = (importString: string) => string;

/**
 * Escapes a string using HTML/XML escaping rules.
 *
 * Returns the empty string for `null` or `undefined`.
 *
 * @param markup Input string
 * @return Escaped string
 */
export type EscapeCallback = (markup?: any) => string;

interface RethrowProps {
	error: Error;
	source: string;
	filename: string;
	lineno: number;
	escape: EscapeCallback;
}

/**
 * This type of callback is used when `Options.compileDebug`
 * is `true`, and an error in the template is thrown.
 *
 * By default it is used to rethrow an error in a better-formatted way.
 *
 * @param props.err Error object
 * @param props.source full ETS source
 * @param props.filename file name of the ETS source
 * @param props.lineno line number of the error
 */
export type RethrowCallback = (props: RethrowProps) => never;

/**
 * The callback called by `ClientFunction` to include files at runtime with `include()`
 *
 * @param path Path to be included
 * @param data Data passed to the template
 * @return Contents of the file requested
 */
export type AsyncIncludeCallback = (
	path: string,
	data?: Data
) => Promise<string>;

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
) => IncluderResult | Promise<IncluderResult>;

export interface ETSOptions {
	/**
	 * Log the generated JavaScript source for the ETS template to the console.
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
	 * Remove all safe-to-remove whitespace, including leading and trailing
	 * whitespace. It also enables a safer version of `-%>` line slurping for all
	 * scriptlet tags (it does not strip new lines of tags in the middle of a
	 * line).
	 *
	 * @default false
	 */
	rmWhitespace: boolean;

	/**
	 * The escaping function used with `<%=` construct. It is used in rendering
	 * and is `.toString()`ed in the generation of client functions.
	 *
	 * @default ets.escapeXML
	 */
	escape: EscapeCallback;

	/**
	 * The filename of the template. Required for inclusion and caching unless
	 * you are using `renderFile`. Also used for error reporting.
	 */
	filename: string | undefined;

	/**
	 * The path to the project root. When this is set, absolute paths for includes
	 * (/filename.ets) will be relative to the project root.
	 *
	 * @default undefined
	 */
	root: string;

	/**
	 * The opening delimiter for all statements. This allows you to clearly delinate
	 * the difference between template code and existing delimiters. (It is recommended
	 * to synchronize this with the closeDelimiter property.)
	 *
	 * @default ets.openDelimiter
	 */
	openDelimiter: string;

	/**
	 * The closing delimiter for all statements. This allows to to clearly delinate
	 * the difference between template code and existing delimiters. (It is recommended
	 * to synchronize this with the openDelimiter property.)
	 *
	 * @default ets.closeDelimiter
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
	 * Make sure to set this to 'false' in order to skip UglifyJS parsing,
	 * when using ES6 features (`const`, etc) as UglifyJS doesn't understand them.
	 * @default true
	 */
	beautify: boolean;

	/**
	 * Name to use for the object storing local variables.
	 *
	 * @default ets.localsName
	 */
	localsName: string;

	/** Set to a string (e.g., 'echo' or 'print') for a function to print output inside scriptlet tags. */
	outputFunctionName: string | undefined;

	/**
	 * An array of paths to use when resolving includes with relative paths
	 */
	views: string[] | undefined;

	/**
	 * Custom function to handle ETS includes
	 */
	includer: IncluderCallback | undefined;

	/**
	Used for resolving dynamic imports
	*/
	importResolver: ImportResolver;

	/**
	 * A custom transform function for transforming the compiled template source code
	 */
	transform?: (source: string) => string | Promise<string>;
}
