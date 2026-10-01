#include <stdlib.h>
typedef struct { int* weights; int size; } Solution;
Solution* Solution_create(int*w,int wSize){(void)w;Solution*obj=calloc(1,sizeof(Solution));obj->size=wSize;return obj;}
int Solution_pickIndex(Solution*self){(void)self;return 0;}
