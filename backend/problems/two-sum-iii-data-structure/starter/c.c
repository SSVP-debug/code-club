typedef struct {
    int _unused;
} TwoSum;

TwoSum* TwoSum_create() {
    TwoSum* obj = malloc(sizeof(TwoSum));
    return obj;
}

void TwoSum_add(TwoSum* self, int number) {
}

bool TwoSum_find(TwoSum* self, int value) {
    return false;
}