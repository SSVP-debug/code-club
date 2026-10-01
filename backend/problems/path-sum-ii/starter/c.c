#include <stdlib.h>
#ifndef CODECLUB_TREENODE_DEFINED
#define CODECLUB_TREENODE_DEFINED
typedef struct TreeNode { int val; struct TreeNode* left; struct TreeNode* right; } TreeNode;
#endif
int** pathSum(TreeNode* root,int targetSum,int*returnSize,int**returnColumnSizes){(void)root;(void)targetSum;*returnSize=0;*returnColumnSizes=NULL;return NULL;}
