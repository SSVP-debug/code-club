typedef struct {
    int _unused;
} FreqStack;

FreqStack* FreqStack_create() {
    FreqStack* obj = malloc(sizeof(FreqStack));
    return obj;
}

void FreqStack_push(FreqStack* self, int val) {
}

int FreqStack_pop(FreqStack* self) {
    return 0;
}