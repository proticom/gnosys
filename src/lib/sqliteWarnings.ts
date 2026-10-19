process.emitWarning = new Proxy(process.emitWarning, {
  apply(target, thisArg, args: unknown[]) {
    const [warning, options] = args;
    const message = warning instanceof Error ? warning.message : warning;
    const type = warning instanceof Error ? warning.name
      : typeof options === "string" ? options
      : options && typeof options === "object" && "type" in options ? options.type : undefined;
    if (type === "ExperimentalWarning" && typeof message === "string" && /sqlite/i.test(message)) return;
    return Reflect.apply(target, thisArg, args);
  },
});
