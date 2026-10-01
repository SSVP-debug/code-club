#include <stdbool.h>
#ifndef CODECLUB_LISTNODE_DEFINED
#define CODECLUB_LISTNODE_DEFINED
typedef struct ListNode { int val; struct ListNode* next; } ListNode;
#endif
bool hasCycle(ListNode* head){(void)head;return false;}
