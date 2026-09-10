/**
 * languageDrivers/cpp.js
 *
 * Plan 011 (Batch 3): see languageDrivers/python.js's header for the full
 * reasoning. Mechanical extraction from generateDriverCode.js's cpp
 * branch (+ its share of inferReturnType()) and operationSequenceDriver.js's
 * generateCppDriver().
 */
import { cppDeclaration, formatCppValue } from "../languageTypes/cpp.js";

/**
 * inferReturnType — regex-based FALLBACK ONLY. See java.js's identical
 * comment on this same function for the full reasoning; the only
 * difference here is C++'s type vocabulary.
 */
export function inferReturnType(userCode) {
  // vector<vector<int>> must be checked before vector<int> — the latter
  // is a substring of the former, so alternation order matters here.
  const match = userCode.match(
    /(vector<vector<int>>|vector<string>|vector<int>|long long|double|bool|string|void|int)\s+\w+\s*\(/
  );

  return match?.[1] || "int";
}

/**
 * generate — single-call driver template. Was the `if (language ===
 * "cpp")` branch body in generateDriverCode.js.
 *
 * Plan 012 Batch 6: `returnType` is now actually read (previously not
 * even destructured — silently ignored, the same class of oversight
 * Batch 5 found in this file's generateOperationSequence's resultMode).
 * `auto result = solution.${fn}(...)` cannot deduce a type from a void
 * expression — a real, pre-existing, cross-language compile-error bug
 * for every void-returning, in-place-mutation problem (rotate-array,
 * sort-colors, sudoku-solver, etc.), not something Plan 012 introduced.
 * The fix mirrors languageDrivers/c.js's: the real expected output for
 * these problems was never the return value — it's the post-call state
 * of whichever reference argument the function mutates — so print THAT
 * instead of attempting to capture a nonexistent return value. C++
 * passes containers by reference (`vector<int>& nums`), so the local
 * `nums` the driver already declared is mutated in place by the call;
 * no special serialization is needed beyond the generic `printResult`
 * template this file already has (which handles `vector<vector<T>>` for
 * free via its own recursive template instantiation).
 */
export function generate({ userCode, fn, returnType, args, paramTypes }) {
  const declarations = args
    .map(({ key, value }) => cppDeclaration(key, value, paramTypes[key]))
    .join("\n  ");

  const cppCallArgs = args.map((a) => a.key).join(", ");

  const printResultHelpers = `
void printResult(int x) { cout << x; }
void printResult(long long x) { cout << x; }
void printResult(double x) { cout << x; }

void printResult(bool x) {
  cout << (x ? "true" : "false");
}

void printResult(const string& x) {
  cout << "\\"";
  for (char c : x) {
    if (c == '"' || c == '\\\\') cout << '\\\\';
    cout << c;
  }
  cout << "\\"";
}

template<typename T>
void printResult(const vector<T>& v) {
  cout << "[";
  for (size_t i = 0; i < v.size(); i++) {
    if (i) cout << ",";
    printResult(v[i]);
  }
  cout << "]";
}
`;

  if (returnType === "void") {
    const arrayArgs = args.filter(({ value }) => Array.isArray(value));
    if (arrayArgs.length !== 1) {
      throw new Error(
        `generate(): "${fn}" returns void (an in-place-mutation problem) but has ${arrayArgs.length} array arguments — expected exactly 1 to know which one to print as the result`
      );
    }
    const { key } = arrayArgs[0];

    return `
#include <bits/stdc++.h>
using namespace std;
${printResultHelpers}
${userCode}

int main() {
  try {
    ${declarations}

    Solution solution;

    solution.${fn}(${cppCallArgs});

    printResult(${key});
    cout << endl;

  } catch (exception& e) {
    cout << "RUNTIME_ERROR:" << e.what();
  }

  return 0;
}
`;
  }

  return `
#include <bits/stdc++.h>
using namespace std;
${printResultHelpers}
${userCode}

int main() {
  try {
    ${declarations}

    Solution solution;

    auto result = solution.${fn}(${cppCallArgs});

    printResult(result);
    cout << endl;

  } catch (exception& e) {
    cout << "RUNTIME_ERROR:" << e.what();
  }

  return 0;
}
`;
}

/**
 * generateOperationSequence — constructor + method-sequence replay driver.
 * Was operationSequenceDriver.js's generateCppDriver(). C++ has neither
 * dynamic dispatch nor reflection, but the op sequence is known at
 * driver-GENERATION time (not just at runtime) — every op call is
 * unrolled into a direct, statically-typed method call. The remaining
 * problem is that different ops can have different return types (some
 * void, some not) within the same sequence; SFINAE (portable back to
 * C++11, unlike `if constexpr` which needs C++17 and isn't guaranteed on
 * every Judge0 environment) picks the right overload of callOp() based on
 * whether the wrapped call expression is void, exactly mirroring Java's
 * reflection-based "null for void" behavior without needing reflection.
 */
export function generateOperationSequence({ userCode, className, constructorArgs, opNames, opArgsList, resultMode }) {
  const ctorDecls = constructorArgs
    .map(([k, v]) => cppDeclaration(k, v))
    .join("\n    ");
  const ctorCallArgs = constructorArgs.map(([k]) => k).join(", ");

  const includeVoid = resultMode === "all" ? "true" : "false";
  const opCallLines = opNames
    .map((name, i) => {
      const argsCpp = opArgsList[i].map((v) => formatCppValue(v)).join(", ");
      return `callOp(_results, ${includeVoid}, [&]{ return _instance.${name}(${argsCpp}); });`;
    })
    .join("\n    ");

  return `
#include <bits/stdc++.h>
using namespace std;

string toJsonStr(int x) { return to_string(x); }
string toJsonStr(long long x) { return to_string(x); }
string toJsonStr(long x) { return to_string(x); }
string toJsonStr(double x) { ostringstream oss; oss << x; return oss.str(); }
string toJsonStr(bool x) { return x ? "true" : "false"; }
string toJsonStr(const string& x) {
  string r = "\\"";
  for (char c : x) {
    if (c == '"' || c == '\\\\') r += '\\\\';
    r += c;
  }
  r += "\\"";
  return r;
}
template<typename T>
string toJsonStr(const vector<T>& v) {
  string r = "[";
  for (size_t i = 0; i < v.size(); i++) {
    if (i) r += ",";
    r += toJsonStr(v[i]);
  }
  r += "]";
  return r;
}

// SFINAE dispatch: exactly one of these two overloads is enabled per call
// site, depending on whether decltype(f()) is void. Portable to C++11.
template<typename F>
typename enable_if<is_void<decltype(declval<F>()())>::value>::type
callOp(vector<string>& results, bool includeVoid, F&& f) {
  f();
  if (includeVoid) results.push_back("null");
}

template<typename F>
typename enable_if<!is_void<decltype(declval<F>()())>::value>::type
callOp(vector<string>& results, bool /*includeVoid*/, F&& f) {
  auto r = f();
  results.push_back(toJsonStr(r));
}

${userCode}

int main() {
  try {
    ${ctorDecls}
    ${className} _instance{${ctorCallArgs}};
    vector<string> _results;

    ${opCallLines}

    cout << "[";
    for (size_t i = 0; i < _results.size(); i++) {
      if (i) cout << ",";
      cout << _results[i];
    }
    cout << "]" << endl;
  } catch (exception& e) {
    cout << "RUNTIME_ERROR:" << e.what();
  }
  return 0;
}
`;
}