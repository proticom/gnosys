const SQLITE_EXPERIMENTAL_WARNING = "SQLite is an experimental feature and might change at any time";
let installed = false;

export function installSqliteWarningFilter(): void {
  if (installed) return;
  installed = true;
  process.emitWarning = new Proxy(process.emitWarning, {
    apply(target, thisArg, args: unknown[]) {
      const [warning, options] = args;
      const type = typeof options === "string" ? options
        : options && typeof options === "object" && "type" in options ? options.type : undefined;
      if (warning === SQLITE_EXPERIMENTAL_WARNING && type === "ExperimentalWarning") return;
      return Reflect.apply(target, thisArg, args);
    },
  });
}
