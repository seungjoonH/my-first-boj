export function buildCls(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(' ').trim();
}
