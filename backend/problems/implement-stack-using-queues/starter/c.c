typedef struct {
    int _unused;
} MyStack;

MyStack* MyStack_create() {
    MyStack* obj = malloc(sizeof(MyStack));
    return obj;
}

void MyStack_push(MyStack* self, int x) {
}

int MyStack_pop(MyStack* self) {
    return 0;
}

int MyStack_top(MyStack* self) {
    return 0;
}

bool MyStack_empty(MyStack* self) {
    return false;
}