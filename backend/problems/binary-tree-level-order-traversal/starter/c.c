#include <stdlib.h>
#ifndef CODECLUB_TREENODE_DEFINED
#define CODECLUB_TREENODE_DEFINED
typedef struct TreeNode { int val; struct TreeNode* left; struct TreeNode* right; } TreeNode;
#endif
int** levelOrder(TreeNode* root, int* returnSize, int** returnColumnSizes) { (void)root; *returnSize=0; *returnColumnSizes=NULL; return NULL; }
