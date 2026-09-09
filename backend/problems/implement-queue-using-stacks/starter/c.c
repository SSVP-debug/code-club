typedef struct {
    int _unused;
} MyQueue;

MyQueue* MyQueue_create() {
    MyQueue* obj = malloc(sizeof(MyQueue));
    return obj;
}

void MyQueue_push(MyQueue* self, int x) {
}

int MyQueue_pop(MyQueue* self) {
    return 0;
}

int MyQueue_peek(MyQueue* self) {
    return 0;
}

bool MyQueue_empty(MyQueue* self) {
    return true;
}