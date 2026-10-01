#include <stdlib.h>
#include <stdbool.h>
#ifndef CODECLUB_TREENODE_DEFINED
#define CODECLUB_TREENODE_DEFINED
typedef struct TreeNode { int val; struct TreeNode* left; struct TreeNode* right; } TreeNode;
#endif

typedef struct { TreeNode* root; } BSTIterator;
BSTIterator* BSTIterator_create(TreeNode* root) { BSTIterator* obj = malloc(sizeof(BSTIterator)); obj->root = root; return obj; }
int BSTIterator_next(BSTIterator* self) { (void)self; return 0; }
bool BSTIterator_hasNext(BSTIterator* self) { (void)self; return false; }
