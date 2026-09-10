/**
 * languageDrivers/java.js
 *
 * Plan 011 (Batch 3): see languageDrivers/python.js's header for the full
 * reasoning. Mechanical extraction from generateDriverCode.js's java
 * branch (+ its share of inferReturnType()) and operationSequenceDriver.js's
 * generateJavaDriver().
 */
import { javaDeclaration, formatJavaLiteral, inferJavaType } from "../languageTypes/java.js";

/**
 * inferReturnType — regex-based FALLBACK ONLY, for problems that don't
 * declare an explicit `returnType` contract (see backend/models/
 * Problem.js). Was the `if (language === "java")` branch inside
 * generateDriverCode.js's central inferReturnType() dispatcher; that
 * dispatcher now calls this via the same registry
 * languageDrivers/index.js uses for generate()/generateOperationSequence()
 * — see generateDriverCode.js. Intentionally a short whitelist and will
 * always miss some valid type — any problem whose natural return type
 * isn't on this list MUST declare `returnType` explicitly rather than
 * relying on this regex. Do not treat extending this list as a substitute
 * for declaring the contract on the problem itself. Optional export (only
 * statically-typed languages need one — see STATICALLY_TYPED_LANGUAGE_KEYS
 * in backend/config/languages.js) — not part of the required generate()/
 * generateOperationSequence() contract validated at module-load time.
 */
export function inferReturnType(userCode) {
  const match = userCode.match(
    /public\s+(int\[\]\[\]|int\[\]|boolean|long|double|int|String|void)\s+\w+\s*\(/
  );

  return match?.[1] || "int";
}

/**
 * generate — single-call driver template. Was the `if (language ===
 * "java")` branch body in generateDriverCode.js.
 *
 * Plan 012 Batch 6: two real, pre-existing bugs fixed here, neither
 * C-specific (found while onboarding C, but this file's own bug, not
 * introduced by that work):
 *   1. `${returnType} result = solution.${fn}(...)` cannot declare a
 *      variable of type `void` — a hard compile error for every void-
 *      returning, in-place-mutation problem (rotate-array, sort-colors,
 *      sudoku-solver, etc.). Fix mirrors cpp.js's: print the mutated
 *      array argument (Java arrays are reference types, so the local
 *      variable the driver already declared reflects the mutation)
 *      instead of attempting to capture a nonexistent return value.
 *   2. `int[][]` return fell through to the generic `System.out.println(result)`
 *      branch, which for a 2D array prints Java's default
 *      `Object.toString()` (something like `[[I@1b6d3586`), not the
 *      array's contents — silently wrong output, not a compile error,
 *      so easy to miss without actually running it. Fixed with
 *      `Arrays.deepToString`, matching the existing `int[]` branch's use
 *      of `Arrays.toString`.
 */
export function generate({ userCode, fn, returnType, args, paramTypes }) {
  const declarations = args
    .map(({ key, value }) => javaDeclaration(key, value, paramTypes[key]))
    .join("\n    ");

  const javaCallArgs = args.map((a) => a.key).join(", ");

  if (returnType === "void") {
    const arrayArgs = args.filter(({ value }) => Array.isArray(value));
    if (arrayArgs.length !== 1) {
      throw new Error(
        `generate(): "${fn}" returns void (an in-place-mutation problem) but has ${arrayArgs.length} array arguments — expected exactly 1 to know which one to print as the result`
      );
    }
    const { key, value } = arrayArgs[0];
    const is2d = Array.isArray(value[0]);
    const printExpr = is2d ? `Arrays.deepToString(${key})` : `Arrays.toString(${key})`;

    return `
import java.util.Arrays;

${userCode}

class Main {
  public static void main(String[] args) {
    try {
      ${declarations}
      Solution solution = new Solution();
      solution.${fn}(${javaCallArgs});
      System.out.println(${printExpr});
    } catch (Exception e) {
      System.out.println("RUNTIME_ERROR:" + e.getMessage());
    }
  }
}
`;
  }

  return `
import java.util.Arrays;

${userCode}

class Main {
  public static void main(String[] args) {
    try {
      ${declarations}
      ${returnType === "int[][]"
        ? `
      Solution solution = new Solution();
      int[][] result = solution.${fn}(${javaCallArgs});
      System.out.println(Arrays.deepToString(result));
      `
        : returnType === "int[]"
        ? `
      Solution solution = new Solution();
      int[] result = solution.${fn}(${javaCallArgs});
      System.out.println(Arrays.toString(result));
      `
        : `
      Solution solution = new Solution();
      ${returnType} result = solution.${fn}(${javaCallArgs});
      System.out.println(result);
      `
      }
    } catch (Exception e) {
      System.out.println("RUNTIME_ERROR:" + e.getMessage());
    }
  }
}
`;
}

/**
 * generateOperationSequence — constructor + method-sequence replay driver.
 * Was operationSequenceDriver.js's generateJavaDriver(). Java has no
 * built-in dynamic dispatch by method-name string, so this uses
 * reflection: find the declared method matching (name, argument count)
 * and invoke it. Method.invoke performs unboxing + widening conversions
 * automatically, and returns null for a void method — which conveniently
 * already matches this driver's "null for void" convention without any
 * special-casing.
 */
export function generateOperationSequence({ userCode, className, constructorArgs, opNames, opArgsList, resultMode }) {
  const ctorDecls = constructorArgs.map(([k, v]) => javaDeclaration(k, v)).join("\n      ");
  const ctorCallArgs = constructorArgs.map(([k]) => k).join(", ");

  const opNamesLiteral = opNames.map((n) => `"${n}"`).join(", ");
  const opArgsLiteral = opArgsList
    .map((argsRow) => {
      const items = argsRow.map((v) => formatJavaLiteral(v, inferJavaType(v))).join(", ");
      return `{ ${items} }`;
    })
    .join(", ");

  return `
import java.util.*;
import java.lang.reflect.Method;

${userCode}

class Main {
  // Minimal JSON encoder for reflection results — no JSON library is
  // guaranteed to be on the Judge0 Java classpath, so this only needs to
  // handle the value shapes these design problems actually return:
  // null, String, Boolean, any Number (int/long/double via autoboxing),
  // and List<...> (e.g. Twitter's getNewsFeed).
  static String toJson(Object o) {
    if (o == null) return "null";
    if (o instanceof String) {
      StringBuilder sb = new StringBuilder("\\"");
      for (char c : ((String) o).toCharArray()) {
        if (c == '"' || c == '\\\\') sb.append('\\\\');
        sb.append(c);
      }
      sb.append("\\"");
      return sb.toString();
    }
    if (o instanceof Boolean || o instanceof Number) return String.valueOf(o);
    if (o instanceof List) {
      StringBuilder sb = new StringBuilder("[");
      List<?> list = (List<?>) o;
      for (int i = 0; i < list.size(); i++) {
        if (i > 0) sb.append(",");
        sb.append(toJson(list.get(i)));
      }
      sb.append("]");
      return sb.toString();
    }
    if (o instanceof int[]) {
      int[] arr = (int[]) o;
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < arr.length; i++) {
        if (i > 0) sb.append(",");
        sb.append(arr[i]);
      }
      sb.append("]");
      return sb.toString();
    }
    return "\\"" + o.toString() + "\\"";
  }

  public static void main(String[] args) {
    try {
      ${ctorDecls}
      ${className} _instance = new ${className}(${ctorCallArgs});
      String[] _opNames = { ${opNamesLiteral} };
      Object[][] _opArgs = { ${opArgsLiteral} };
      List<Object> _results = new ArrayList<>();

      for (int _i = 0; _i < _opNames.length; _i++) {
        Method _method = null;
        for (Method m : _instance.getClass().getMethods()) {
          if (m.getName().equals(_opNames[_i]) && m.getParameterCount() == _opArgs[_i].length) {
            _method = m;
            break;
          }
        }
        if (_method == null) {
          throw new RuntimeException("No method named " + _opNames[_i] + " with " + _opArgs[_i].length + " argument(s)");
        }
        Object _res = _method.invoke(_instance, _opArgs[_i]);
        ${resultMode === "all" ? "_results.add(_res);" : "if (_res != null) _results.add(_res);"}
      }

      System.out.println(toJson(_results));
    } catch (Exception e) {
      Throwable _cause = e.getCause() != null ? e.getCause() : e;
      System.out.println("RUNTIME_ERROR:" + _cause.getMessage());
    }
  }
}
`;
}