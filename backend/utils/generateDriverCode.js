import { getDriver } from "./languageDrivers/index.js";
import * as structuredDrivers from "./structuredDrivers.js";
export { formatJsArg } from "./languageDrivers/javascript.js";
export { formatPythonArg } from "./languageDrivers/python.js";

function normalizeTestcaseInput(input){if(typeof input==='object'&&input!==null&&!Array.isArray(input))return input;console.warn('[generateDriverCode] Expected object testcase input, got:',input);return {};}
function buildCallArgs(input){return Object.entries(normalizeTestcaseInput(input)).map(([key,value])=>({key,value}));}
function inferCReturnType(code,fn){const re=new RegExp(`^\\s*([\\w*]+(?:\\s+[\\w*]+)*)\\s+${fn}\\s*\\(`);const line=code.split('\n').find(x=>re.test(x));return line?.match(re)?.[1]?.trim()||null;}
function inferReturnType(code,language,declared,fn){if(declared)return declared;if(language==='c')return inferCReturnType(code,fn)||getDriver(language)?.inferReturnType?.(code)||null;return getDriver(language)?.inferReturnType?.(code)||null;}
export function generateDriverCode(language,userCode,testcaseInput,functionName,declaredReturnType,declaredParamTypes){const fn=functionName||'solve';const returnType=inferReturnType(userCode,language,declaredReturnType,fn);const args=buildCallArgs(testcaseInput);const paramTypes=declaredParamTypes||{};const debugEnabled=typeof process!=='undefined'&&process.env.DRIVER_DEBUG==='1';if(debugEnabled){console.log('[generateDriverCode] TESTCASE INPUT:',testcaseInput);console.log('[generateDriverCode] ARGS:',args);}const driver=getDriver(language);if(!driver)throw new Error(`Unsupported language: ${language}`);const structured=structuredDrivers.generate({language,userCode,fn,returnType,args,paramTypes});if(structured)return structured;return driver.generate({userCode,fn,returnType,args,paramTypes,debugEnabled});}
