#include <stdlib.h>
typedef struct { int top; } MinStack;
MinStack* MinStack_create(void){MinStack*obj=calloc(1,sizeof(MinStack));obj->top=-1;return obj;}
void MinStack_push(MinStack*self,int val){(void)self;(void)val;}
void MinStack_pop(MinStack*self){(void)self;}
int MinStack_top(MinStack*self){(void)self;return 0;}
int MinStack_getMin(MinStack*self){(void)self;return 0;}
