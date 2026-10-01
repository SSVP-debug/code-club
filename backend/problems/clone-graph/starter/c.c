#include <stdlib.h>
#ifndef CODECLUB_GRAPHNODE_DEFINED
#define CODECLUB_GRAPHNODE_DEFINED
typedef struct Node { int val; int numNeighbors; struct Node** neighbors; } Node;
#endif
Node* cloneGraph(Node* node) { (void)node; return NULL; }
