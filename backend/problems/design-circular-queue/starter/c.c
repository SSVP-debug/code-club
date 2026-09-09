typedef struct {
    int k;
} MyCircularQueue;

MyCircularQueue* MyCircularQueue_create(int k) {
    MyCircularQueue* obj = malloc(sizeof(MyCircularQueue));
    obj->k = k;
    return obj;
}

bool MyCircularQueue_enQueue(MyCircularQueue* self, int value) {
    return false;
}

bool MyCircularQueue_deQueue(MyCircularQueue* self) {
    return false;
}

int MyCircularQueue_Front(MyCircularQueue* self) {
    return -1;
}

int MyCircularQueue_Rear(MyCircularQueue* self) {
    return -1;
}

bool MyCircularQueue_isEmpty(MyCircularQueue* self) {
    return false;
}

bool MyCircularQueue_isFull(MyCircularQueue* self) {
    return false;
}