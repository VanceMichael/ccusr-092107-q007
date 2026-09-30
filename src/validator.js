// 极简 JSON Schema 子集校验器，仅支持项目契约用到的关键字：
// type / required / properties / additionalProperties / items /
// enum / const / minLength / maxLength / pattern / minimum / maximum / minItems。
// 返回违规描述数组，空数组表示通过。
export function validate(schema, value, path = "$") {
  const errors = [];
  const fail = (msg) => errors.push(`${path} ${msg}`);

  if (schema.const !== undefined && value !== schema.const) {
    fail(`应为常量 ${JSON.stringify(schema.const)}`);
    return errors;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    fail(`取值 ${JSON.stringify(value)} 不在枚举 ${JSON.stringify(schema.enum)} 内`);
    return errors;
  }

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        fail("应为对象");
        return errors;
      }
      const props = schema.properties ?? {};
      for (const key of schema.required ?? []) {
        if (!(key in value)) fail(`缺少必填字段 ${key}`);
      }
      for (const [key, sub] of Object.entries(props)) {
        if (key in value) errors.push(...validate(sub, value[key], `${path}.${key}`));
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in props)) fail(`存在未约定字段 ${key}`);
        }
      }
      return errors;
    }
    case "array": {
      if (!Array.isArray(value)) {
        fail("应为数组");
        return errors;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        fail(`至少需要 ${schema.minItems} 项`);
      }
      if (schema.items) {
        value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
      }
      return errors;
    }
    case "string": {
      if (typeof value !== "string") {
        fail("应为字符串");
        return errors;
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        fail(`长度至少为 ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        fail(`长度至多为 ${schema.maxLength}`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        fail(`不匹配模式 ${schema.pattern}`);
      }
      return errors;
    }
    case "integer":
    case "number": {
      const ok = schema.type === "integer" ? Number.isInteger(value) : typeof value === "number";
      if (!ok) {
        fail(schema.type === "integer" ? "应为整数" : "应为数值");
        return errors;
      }
      if (schema.minimum !== undefined && value < schema.minimum) fail(`应不小于 ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum) fail(`应不大于 ${schema.maximum}`);
      return errors;
    }
    case "boolean": {
      if (typeof value !== "boolean") fail("应为布尔值");
      return errors;
    }
    default:
      return errors;
  }
}
