// 极简 JSON Schema 校验器，仅支持本项目契约用到的子集：
// type / required / properties / items / enum / const /
// minLength / minimum / minItems / pattern / additionalProperties。
export function validate(value, schema, path = "$") {
  const errors = [];
  const fail = (message) => errors.push(`${path} ${message}`);

  if (schema.const !== undefined && value !== schema.const) {
    fail(`应等于常量 ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    fail(`不在枚举值 ${JSON.stringify(schema.enum)} 内`);
  }

  const type = schema.type;
  if (type) {
    const ok =
      (type === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) ||
      (type === "array" && Array.isArray(value)) ||
      (type === "string" && typeof value === "string") ||
      (type === "boolean" && typeof value === "boolean") ||
      (type === "number" && typeof value === "number") ||
      (type === "integer" && Number.isInteger(value));
    if (!ok) {
      fail(`类型应为 ${type}`);
      return errors;
    }
  }

  if (type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      fail(`长度不足 ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      fail(`不匹配模式 ${schema.pattern}`);
    }
  }
  if ((type === "integer" || type === "number") && schema.minimum !== undefined && value < schema.minimum) {
    fail(`小于最小值 ${schema.minimum}`);
  }
  if (type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      fail(`至少需要 ${schema.minItems} 项`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validate(item, schema.items, `${path}[${index}]`));
      });
    }
  }
  if (type === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) fail(`缺少字段 ${key}`);
    }
    const properties = schema.properties ?? {};
    for (const [key, sub] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validate(value[key], sub, `${path}.${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) fail(`存在未约定字段 ${key}`);
      }
    }
  }
  return errors;
}

export function assertValid(value, schema, label = "资料") {
  const errors = validate(value, schema);
  if (errors.length > 0) {
    throw new Error(`${label}不符合契约: ${errors.join("; ")}`);
  }
  return value;
}
