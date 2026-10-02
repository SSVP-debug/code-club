/** C operation-sequence driver. Supports scalar, bool, void, and TreeNode constructors. */

function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
function scalarLiteral(v) { if (typeof v === 'string') return `"${esc(v)}"`; if (typeof v === 'boolean') return v ? 'true' : 'false'; return String(v); }
function inferReturnType(code, className, methodName) {
  const fn = `${className}_${methodName}`;
  const re = new RegExp(`^\\s*([\\w*]+(?:\\s+[\\w*]+)*)\\s+${fn}\\s*\\(`);
  const line = code.split('\n').find(x => re.test(x));
  return line?.match(re)?.[1]?.trim() || null;
}
function treeHelper() {
  return `
#ifndef CODECLUB_TREENODE_DEFINED
#define CODECLUB_TREENODE_DEFINED
typedef struct TreeNode { int val; struct TreeNode* left; struct TreeNode* right; } TreeNode;
#endif
static TreeNode* cc_tree_node(int v){TreeNode*n=malloc(sizeof(TreeNode));n->val=v;n->left=NULL;n->right=NULL;return n;}
static TreeNode* cc_build_tree(const int*v,int n){if(n<=0||v[0]==INT_MIN)return NULL;TreeNode**a=calloc((size_t)n,sizeof(TreeNode*));for(int i=0;i<n;i++)if(v[i]!=INT_MIN)a[i]=cc_tree_node(v[i]);for(int i=0;i<n;i++)if(a[i]){int l=2*i+1,r=2*i+2;if(l<n)a[i]->left=a[l];if(r<n)a[i]->right=a[r];}TreeNode*r=a[0];free(a);return r;}
`;
}
function buildTreeDecl(key, values) {
  const vals = values.map(v => v == null ? 'INT_MIN' : String(v));
  const init = vals.length ? `{${vals.join(',')}}` : '{0}';
  return [`int _${key}Values[${Math.max(1, vals.length)}] = ${init};`, `TreeNode* ${key} = cc_build_tree(_${key}Values, ${vals.length});`];
}

export function generateCOperationSequence({ userCode, className, constructorArgs, opNames, opArgsList, resultMode }) {
  const includes = `#include <stdio.h>\n#include <stdlib.h>\n#include <stdbool.h>\n#include <stdint.h>\n#include <limits.h>\n#include <string.h>`;
  const treeNeeded = constructorArgs.some(([k,v]) => k === 'root' && Array.isArray(v));
  const ctorDecls = [];
  const ctorCall = [];
  for (const [k,v] of constructorArgs) {
    if (k === 'root' && Array.isArray(v)) { ctorDecls.push(...buildTreeDecl(k,v)); ctorCall.push(k); }
    else if (Array.isArray(v)) { const vals=v.map(scalarLiteral).join(', '); ctorDecls.push(`int ${k}[] = {${vals}};`, `int ${k}Size = ${v.length};`); ctorCall.push(k,`${k}Size`); }
    else { ctorDecls.push(`${typeof v === 'string' ? 'char*' : typeof v === 'boolean' ? 'bool' : 'int'} ${k} = ${scalarLiteral(v)};`); ctorCall.push(k); }
  }
  const body=[`int _outCount = 0;`,`printf("[");`];
  for(let i=0;i<opNames.length;i++){
    const method=opNames[i], args=opArgsList[i]||[], ret=inferReturnType(userCode,className,method);
    if(!ret) throw new Error(`C operation driver: cannot find return type for ${className}_${method}`);
    const argNames=[];
    const block=[];
    args.forEach((v,j)=>{const name=`_op${i}_arg${j}`;if(Array.isArray(v)){const vals=v.map(scalarLiteral).join(', ');block.push(`int ${name}[] = {${vals}};`,`int ${name}Size = ${v.length};`);argNames.push(name,`${name}Size`);}else{block.push(`${typeof v==='string'?'char*':typeof v==='boolean'?'bool':'int'} ${name} = ${scalarLiteral(v)};`);argNames.push(name);}});
    const call=`${className}_${method}(_instance${argNames.length?', ':''}${argNames.join(', ')}`;
    if(ret==='void'){block.push(`${call});`);if(resultMode==='all')block.push(`if (_outCount++) printf(","); printf("null");`);}
    else if(ret==='int*'||ret==='int**'||ret==='char**'||ret==='char***') throw new Error(`C operation driver: ${className}.${method}() returns "${ret}", which is not a supported operation-sequence result type (void, bool, int, long long, double, char*)`);
    else if(ret==='bool'){block.push(`bool _r = ${call}); if (_outCount++) printf(","); printf(_r ? "true" : "false");`);}
    else if(ret==='char*'){block.push(`char* _r = ${call}); if (_outCount++) printf(","); printf("\\\"%s\\\"", _r);`);}
    else if(ret==='int'){block.push(`int _r = (int) ${call}); if (_outCount++) printf(","); printf("%d", _r);`);}
    else{block.push(`${ret} _r = (${ret}) ${call}); if (_outCount++) printf(","); printf("%lld", (long long)_r);`);}
    body.push(`{\n    ${block.join('\n    ')}\n  }`);
  }
  body.push(`printf("]\\n");`);
  const helper=treeNeeded?treeHelper():'';
  const ctor=`${className}* _instance = ${className}_create(${ctorCall.join(', ')});`;
  return `${includes}\n${helper}\n${userCode}\nint main(void){\n  ${ctorDecls.join('\n  ')}\n  ${ctor}\n  ${body.join('\n  ')}\n  return 0;\n}\n`;
}