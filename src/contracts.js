import { readFileSync } from "node:fs";

import { validate } from "./validator.js";

const CONTRACTS_DIR = new URL("../contracts/", import.meta.url);

export function loadSchema(name) {
  return JSON.parse(readFileSync(new URL(`${name}.schema.json`, CONTRACTS_DIR), "utf8"));
}

// 按契约名称校验一份资料，返回违规描述数组。
export function validateAgainst(name, value) {
  return validate(loadSchema(name), value);
}
